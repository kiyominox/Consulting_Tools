"""
Parts Inventory / GL Reconciliation – Flask web app.

Run:
    python app.py
Then open http://127.0.0.1:5000 in your browser.
"""

import json
import os
import re
from datetime import date, datetime
from pathlib import Path

import pandas as pd
from flask import (
    Flask, render_template, request, redirect, url_for, jsonify, flash, abort
)
from werkzeug.utils import secure_filename

from core import (
    load_gl, classify_gl, calculate_rec, apply_review_decisions,
    safe, ytd_rad, month_label, month_key, parse_month_str, INPUT_FIELDS,
)

# ---------------------------------------------------------------------------

APP_ROOT  = Path(__file__).parent.resolve()
DATA_DIR  = APP_ROOT / 'data'
GL_PATH   = DATA_DIR / 'gl_uploaded.xlsx'
STATE_PATH = DATA_DIR / 'state.json'

DATA_DIR.mkdir(exist_ok=True)

app = Flask(__name__)
app.secret_key = 'parts-rec-dev-key-change-for-prod'
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024  # 64 MB upload limit


# ---------------------------------------------------------------------------
# State persistence
# ---------------------------------------------------------------------------

def load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text())
        except Exception:
            pass
    return {
        'inputs':            {},   # {'YYYY-MM': {dealership, inventory, ...}}
        'rad':               {},   # {'YYYY-MM': float}
        'review_decisions':  {},   # {'YYYY-MM': {row_id: 'step11'|'step13'|'ignore'}}
        'gl_filename':       None,
        'gl_uploaded_at':    None,
    }


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2, default=str))


# ---------------------------------------------------------------------------
# GL caching (only re-parse when file changes)
# ---------------------------------------------------------------------------

_gl_cache = {'mtime': None, 'df': None}


def get_gl_df():
    if not GL_PATH.exists():
        return None
    mtime = GL_PATH.stat().st_mtime
    if _gl_cache['mtime'] != mtime:
        _gl_cache['df'] = load_gl(GL_PATH)
        _gl_cache['mtime'] = mtime
    return _gl_cache['df']


# ---------------------------------------------------------------------------
# Building a reconciliation result
# ---------------------------------------------------------------------------

def build_rec(state: dict, mkey: str):
    """Compute the rec for one month.  Returns dict or None if inputs missing."""
    inputs = state['inputs'].get(mkey)
    if not inputs:
        return None
    year, month = parse_month_str(mkey)

    gl_df = get_gl_df()
    if gl_df is None:
        s1_df = s2_df = rv_df = pd.DataFrame()
    else:
        s1_df, s2_df, rv_df = classify_gl(gl_df, year, month)
        decisions = state.get('review_decisions', {}).get(mkey, {})
        s1_df, s2_df, rv_df = apply_review_decisions(s1_df, s2_df, rv_df, decisions)

    s1_total = float(s1_df['Amount $'].sum()) if not s1_df.empty else 0.0
    s2_total = float(s2_df['Amount $'].sum()) if not s2_df.empty else 0.0
    rad_y    = ytd_rad(state.get('rad', {}), year, month)

    calc = calculate_rec(inputs, s1_total, s2_total, rad_y)
    return dict(year=year, month=month, label=month_label(year, month),
                calc=calc, inputs=inputs,
                s1_df=s1_df, s2_df=s2_df, rv_df=rv_df,
                review_count=len(rv_df), rad_ytd=rad_y)


def build_all_recs(state: dict):
    keys = sorted(state['inputs'].keys())
    return [r for r in (build_rec(state, k) for k in keys) if r]


# ---------------------------------------------------------------------------
# Routes — Dashboard
# ---------------------------------------------------------------------------

@app.route('/')
def dashboard():
    state = load_state()
    recs = build_all_recs(state)
    gl_df = get_gl_df()
    gl_info = None
    if gl_df is not None:
        date_col = pd.to_datetime(gl_df['Acctg. Date'], errors='coerce')
        gl_info = {
            'filename':   state.get('gl_filename'),
            'uploaded':   state.get('gl_uploaded_at'),
            'row_count':  len(gl_df),
            'date_min':   date_col.min().strftime('%b %d, %Y') if pd.notna(date_col.min()) else 'n/a',
            'date_max':   date_col.max().strftime('%b %d, %Y') if pd.notna(date_col.max()) else 'n/a',
            'accounts':   sorted(gl_df['Account'].dropna().unique().tolist()),
        }
    return render_template('dashboard.html', recs=recs, gl_info=gl_info, state=state)


# ---------------------------------------------------------------------------
# Routes — GL upload
# ---------------------------------------------------------------------------

@app.route('/upload-gl', methods=['POST'])
def upload_gl():
    f = request.files.get('gl_file')
    if not f or not f.filename:
        flash('No file selected', 'error')
        return redirect(url_for('dashboard'))
    if not f.filename.lower().endswith(('.xlsx', '.xls')):
        flash('GL file must be .xlsx or .xls', 'error')
        return redirect(url_for('dashboard'))

    f.save(GL_PATH)
    state = load_state()
    state['gl_filename']    = secure_filename(f.filename)
    state['gl_uploaded_at'] = datetime.now().isoformat(timespec='seconds')
    save_state(state)
    _gl_cache['mtime'] = None  # force reload

    try:
        df = get_gl_df()
        flash(f'GL Detail uploaded: {len(df):,} rows', 'success')
    except Exception as e:
        flash(f'Could not parse GL file: {e}', 'error')
    return redirect(url_for('dashboard'))


# ---------------------------------------------------------------------------
# Routes — Monthly input editing
# ---------------------------------------------------------------------------

@app.route('/inputs')
def inputs_list():
    state = load_state()
    return render_template('inputs_list.html',
                            inputs=state['inputs'],
                            rad=state.get('rad', {}))


@app.route('/inputs/new')
def inputs_new():
    # blank form, no mkey yet
    return render_template('inputs_edit.html', mkey='', existing={}, is_new=True)


@app.route('/inputs/<mkey>', methods=['GET', 'POST'])
def inputs_edit(mkey):
    state = load_state()
    if request.method == 'POST':
        new_mkey = request.form.get('month', mkey).strip()
        if not re.match(r'^\d{4}-\d{2}$', new_mkey):
            flash('Month must be in YYYY-MM format', 'error')
            return redirect(url_for('inputs_edit', mkey=mkey or 'new'))

        data = {'dealership': request.form.get('dealership', '').strip()}
        for field in INPUT_FIELDS:
            if field == 'dealership':
                continue
            v = request.form.get(field, '').strip()
            data[field] = safe(v) if v else 0.0

        # Handle rename
        if mkey and mkey != new_mkey and mkey in state['inputs']:
            del state['inputs'][mkey]
        state['inputs'][new_mkey] = data

        # Also accept a RAD value on the same form
        rad_v = request.form.get('rad', '').strip()
        if rad_v:
            state.setdefault('rad', {})[new_mkey] = safe(rad_v)
        elif new_mkey in state.get('rad', {}) and rad_v == '':
            # only clear if explicitly cleared
            pass

        save_state(state)
        flash(f'Saved inputs for {month_label(*parse_month_str(new_mkey))}', 'success')
        return redirect(url_for('month_detail', mkey=new_mkey))

    existing = state['inputs'].get(mkey, {})
    rad_val  = state.get('rad', {}).get(mkey, '')
    return render_template('inputs_edit.html', mkey=mkey, existing=existing,
                           rad_val=rad_val, is_new=False)


@app.route('/inputs/<mkey>/delete', methods=['POST'])
def inputs_delete(mkey):
    state = load_state()
    state['inputs'].pop(mkey, None)
    state.get('rad', {}).pop(mkey, None)
    state.get('review_decisions', {}).pop(mkey, None)
    save_state(state)
    flash(f'Deleted {mkey}', 'success')
    return redirect(url_for('dashboard'))


# ---------------------------------------------------------------------------
# Routes — RAD
# ---------------------------------------------------------------------------

@app.route('/rad', methods=['GET', 'POST'])
def rad_edit():
    state = load_state()
    if request.method == 'POST':
        rad = {}
        for key, val in request.form.items():
            if key.startswith('rad_'):
                mk = key[4:]
                if re.match(r'^\d{4}-\d{2}$', mk):
                    val = val.strip()
                    if val:
                        rad[mk] = safe(val)
        state['rad'] = rad
        save_state(state)
        flash('RAD values saved', 'success')
        return redirect(url_for('rad_edit'))

    # Build a sensible range of months to display
    months = set(state.get('rad', {}).keys()) | set(state.get('inputs', {}).keys())
    if months:
        years = sorted({int(m.split('-')[0]) for m in months})
        all_months = [month_key(y, m) for y in years for m in range(1, 13)]
    else:
        today = date.today()
        all_months = [month_key(today.year, m) for m in range(1, 13)]

    return render_template('rad.html', months=sorted(set(all_months)),
                            rad=state.get('rad', {}))


# ---------------------------------------------------------------------------
# Routes — Single month detail
# ---------------------------------------------------------------------------

@app.route('/month/<mkey>')
def month_detail(mkey):
    state = load_state()
    rec = build_rec(state, mkey)
    if rec is None:
        flash(f'No inputs saved for {mkey}', 'error')
        return redirect(url_for('inputs_edit', mkey=mkey))
    return render_template('month_detail.html', rec=rec, state=state, mkey=mkey)


# ---------------------------------------------------------------------------
# Routes — Review entries
# ---------------------------------------------------------------------------

@app.route('/review/<mkey>', methods=['GET', 'POST'])
def review(mkey):
    state = load_state()

    if request.method == 'POST':
        decisions = state.setdefault('review_decisions', {}).setdefault(mkey, {})
        for key, val in request.form.items():
            if key.startswith('row_'):
                row_id = key[4:]
                if val in ('step11', 'step13', 'ignore', 'review'):
                    if val == 'review':
                        decisions.pop(row_id, None)
                    else:
                        decisions[row_id] = val
        save_state(state)
        flash('Review decisions saved', 'success')
        return redirect(url_for('review', mkey=mkey))

    gl_df = get_gl_df()
    if gl_df is None:
        flash('Upload a GL Detail file first', 'error')
        return redirect(url_for('dashboard'))

    year, month = parse_month_str(mkey)
    s1_df, s2_df, rv_df_raw = classify_gl(gl_df, year, month)
    decisions = state.get('review_decisions', {}).get(mkey, {})

    # Build display list — keep ALL originally-review entries so user can change mind
    rows = []
    for _, r in rv_df_raw.iterrows():
        rows.append({
            'row_id':              r['_row_id'],
            'account':             r.get('Account', ''),
            'journal':             r.get('Journal', ''),
            'reference':           r.get('Reference', ''),
            'acctg_date':          pd.Timestamp(r['Acctg. Date']).date() if not pd.isna(r['Acctg. Date']) else None,
            'amount':              float(r.get('Amount $', 0) or 0),
            'control':             '' if pd.isna(r.get('Control')) else str(r.get('Control', '')),
            'control2':            '' if pd.isna(r.get('Control2')) else str(r.get('Control2', '')),
            'posting_description': '' if pd.isna(r.get('Posting Description')) else str(r.get('Posting Description', '')),
            'decision':            decisions.get(r['_row_id'], 'review'),
        })
    rows.sort(key=lambda x: (x['acctg_date'] or date(1900,1,1), x['reference']))

    return render_template('review.html', mkey=mkey,
                            label=month_label(year, month), rows=rows,
                            decisions=decisions)


# ---------------------------------------------------------------------------
# Routes — Reset
# ---------------------------------------------------------------------------

@app.route('/reset', methods=['POST'])
def reset_all():
    confirm = request.form.get('confirm', '').strip().lower()
    if confirm != 'reset':
        flash('Type "reset" to confirm', 'error')
        return redirect(url_for('dashboard'))
    if STATE_PATH.exists():
        STATE_PATH.unlink()
    if GL_PATH.exists():
        GL_PATH.unlink()
    _gl_cache['mtime'] = None
    flash('All data cleared', 'success')
    return redirect(url_for('dashboard'))


# ---------------------------------------------------------------------------
# Template filters
# ---------------------------------------------------------------------------

@app.template_filter('money')
def fmt_money(v):
    if v is None or v == '':
        return ''
    try:
        n = float(v)
    except (TypeError, ValueError):
        return ''
    sign = '-' if n < 0 else ''
    return f'{sign}${abs(n):,.2f}'


@app.template_filter('pct')
def fmt_pct(v):
    if v is None or v == '':
        return ''
    try:
        return f'{float(v):.2%}'
    except (TypeError, ValueError):
        return ''


@app.template_filter('mlabel')
def fmt_mlabel(mkey):
    try:
        y, m = parse_month_str(mkey)
        return month_label(y, m)
    except Exception:
        return mkey


@app.template_filter('vrclass')
def variance_class(v):
    if v is None:
        return ''
    n = float(v)
    a = abs(n)
    if a < 1:
        return 'var-zero'
    if a < 100:
        return 'var-small'
    if a < 1000:
        return 'var-medium'
    return 'var-large'


# ---------------------------------------------------------------------------

if __name__ == '__main__':
    print('Starting Parts Rec web app at http://127.0.0.1:5000')
    print(f'Data directory: {DATA_DIR}')
    app.run(debug=True, host='127.0.0.1', port=5000)
