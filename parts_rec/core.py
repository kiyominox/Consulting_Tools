"""
Parts Inventory / GL Reconciliation – pure logic module.

Shared by the CLI (parts_rec.py) and the web app (app.py).
No Excel formatting or file-format concerns belong here.
"""

import calendar
from datetime import date
from typing import Optional

import pandas as pd


# ---------------------------------------------------------------------------
# Month parsing
# ---------------------------------------------------------------------------

MONTH_MAP = {
    'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
    'JUL': 7, 'AUG': 8, 'SEP': 9, 'SEPT': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12,
    'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4, 'JUNE': 6,
    'JULY': 7, 'AUGUST': 8, 'SEPTEMBER': 9, 'OCTOBER': 10,
    'NOVEMBER': 11, 'DECEMBER': 12,
}

_ABBR_LIST = sorted(MONTH_MAP.keys(), key=len, reverse=True)

# Sales journals — inventory consumption (RO charges, counter invoices, warranty).
# Excluded from timing-difference analysis.
SALES_JOURNALS = {'60', '61', '62'}


def _infer_year(control_month: int, acctg_dt) -> Optional[int]:
    """For a bare month name, infer the most likely year given the accounting date."""
    ref = date(acctg_dt.year, acctg_dt.month, 1)
    best_year = None
    best_diff = float('inf')
    for offset in (-1, 0, 1):
        yr = acctg_dt.year + offset
        try:
            cand = date(yr, control_month, 1)
        except ValueError:
            continue
        delta = (cand - ref).days
        if -550 <= delta <= 62:
            if abs(delta) < best_diff:
                best_diff = abs(delta)
                best_year = yr
    return best_year


def parse_control_month(control_val, acctg_dt):
    """
    Parse a single control / control2 value into (year, month) or None.

    Handles:
      - Bare month names:        NOV, DEC, SEPT, MARCH, …
      - Month + 2-digit year:    JAN25, NOV24, SEPT24
      - Month + 4-digit year:    JAN2025
    Returns None for invoice references and blank/trivial values.
    """
    if control_val is None:
        return None
    try:
        if pd.isna(control_val):
            return None
    except (TypeError, ValueError):
        pass
    s = str(control_val).strip().upper()
    if s in ('', 'NONE', '0', 'N/A', 'NAN'):
        return None

    for abbr in _ABBR_LIST:
        if not s.startswith(abbr):
            continue
        rest = s[len(abbr):]
        month_num = MONTH_MAP[abbr]

        if rest == '':
            yr = _infer_year(month_num, acctg_dt)
            return (yr, month_num) if yr else None

        if rest.isdigit():
            if len(rest) == 2:
                return (2000 + int(rest), month_num)
            if len(rest) == 4:
                return (int(rest), month_num)

        break

    return None


def get_control_ym(row, acctg_dt):
    """Try Control then Control2."""
    ym = parse_control_month(row.get('Control'), acctg_dt)
    if ym is None:
        ym = parse_control_month(row.get('Control2'), acctg_dt)
    return ym


def _has_nontrivial_control(row) -> bool:
    for field in ('Control', 'Control2'):
        raw = row.get(field, '')
        try:
            if pd.isna(raw):
                continue
        except (TypeError, ValueError):
            pass
        v = str(raw).strip().upper()
        if v and v not in ('NONE', '0', 'N/A', '', 'NAN'):
            return True
    return False


def last_day(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def month_label(year: int, month: int) -> str:
    return date(year, month, 1).strftime('%b %Y')


def parse_month_str(s: str) -> tuple[int, int]:
    """Parse 'YYYY-MM' or 'YYYY/MM' → (year, month)."""
    s = str(s).strip()
    for sep in ('-', '/'):
        if sep in s:
            parts = s.split(sep)
            return int(parts[0]), int(parts[1])
    raise ValueError(f'Cannot parse month "{s}" – expected YYYY-MM')


def month_key(year: int, month: int) -> str:
    return f'{year:04d}-{month:02d}'


# ---------------------------------------------------------------------------
# GL loading
# ---------------------------------------------------------------------------

def load_gl(path) -> pd.DataFrame:
    """Read a CDK Drive GL Detail Excel export and normalise column names."""
    df = pd.read_excel(path, dtype={'Account': str, 'Journal': str})
    df.columns = [str(c).strip() for c in df.columns]
    if 'Control2' not in df.columns:
        df['Control2'] = ''
    return df


def gl_row_id(row) -> str:
    """Stable id for a GL row — used to persist review decisions."""
    ref = str(row.get('Reference', '') or '')
    dt  = row.get('Acctg. Date')
    if hasattr(dt, 'strftime'):
        dt_s = dt.strftime('%Y-%m-%d')
    else:
        dt_s = str(dt or '')
    amt = row.get('Amount $', 0)
    try:
        amt_s = f'{float(amt):.2f}'
    except (TypeError, ValueError):
        amt_s = '0.00'
    ctrl = str(row.get('Control', '') or '')
    return f'{ref}|{dt_s}|{amt_s}|{ctrl}'


# ---------------------------------------------------------------------------
# GL classification
# ---------------------------------------------------------------------------

def classify_gl(gl_df: pd.DataFrame, rec_year: int, rec_month: int):
    """
    Return (section1_df, section2_df, review_df) for a reconciliation month.

    section1  – Posted in rec month, Control = future month
                → Step 13 "Parts in Accounting but not in Inventory"
                → SUBTRACT from GL side

    section2  – Posted AFTER rec month, Control = rec month or earlier
                → Step 11 "Misc. Vendor Purchases (In Physical, Not in GL)"
                → ADD to GL side

    review    – Posted AFTER rec month, has non-trivial Control that does not
                parse as a month (e.g. JE references, invoice numbers).  Sales
                journals (60/61/62) are excluded.
    """
    rec_start = date(rec_year, rec_month, 1)
    rec_end   = date(rec_year, rec_month, last_day(rec_year, rec_month))

    s1, s2, rv = [], [], []

    for _, row in gl_df.iterrows():
        raw_dt = row.get('Acctg. Date')
        if pd.isna(raw_dt):
            continue

        journal = str(row.get('Journal', '') or '').strip()
        if journal in SALES_JOURNALS:
            continue

        acctg_dt   = pd.Timestamp(raw_dt)
        acctg_date = acctg_dt.date()

        ym = get_control_ym(row, acctg_dt)
        record = row.to_dict()
        record['_row_id'] = gl_row_id(row)

        if rec_start <= acctg_date <= rec_end:
            if ym and ym > (rec_year, rec_month):
                s1.append(record)

        elif acctg_date > rec_end:
            if ym and ym <= (rec_year, rec_month):
                s2.append(record)
            elif ym is None and _has_nontrivial_control(row):
                rv.append(record)

    cols = list(gl_df.columns) + ['_row_id']
    empty = pd.DataFrame(columns=cols)
    s1_df = pd.DataFrame(s1) if s1 else empty.copy()
    s2_df = pd.DataFrame(s2) if s2 else empty.copy()
    rv_df = pd.DataFrame(rv) if rv else empty.copy()
    return s1_df, s2_df, rv_df


def apply_review_decisions(s1_df, s2_df, rv_df, decisions: dict):
    """
    Move review entries between sections based on user decisions.

    `decisions` maps {row_id → 'step11' | 'step13' | 'ignore'}.
    Returns updated (s1_df, s2_df, rv_df).
    """
    if rv_df.empty or not decisions:
        return s1_df, s2_df, rv_df

    keep_mask = []
    to_s1, to_s2 = [], []
    for _, row in rv_df.iterrows():
        decision = decisions.get(row['_row_id'], 'review')
        if decision == 'step11':
            to_s2.append(row.to_dict())
            keep_mask.append(False)
        elif decision == 'step13':
            to_s1.append(row.to_dict())
            keep_mask.append(False)
        elif decision == 'ignore':
            keep_mask.append(False)
        else:
            keep_mask.append(True)

    if to_s1:
        s1_df = pd.concat([s1_df, pd.DataFrame(to_s1)], ignore_index=True)
    if to_s2:
        s2_df = pd.concat([s2_df, pd.DataFrame(to_s2)], ignore_index=True)
    rv_df = rv_df[keep_mask].reset_index(drop=True)
    return s1_df, s2_df, rv_df


# ---------------------------------------------------------------------------
# Reconciliation calculation
# ---------------------------------------------------------------------------

INPUT_FIELDS = [
    'dealership',
    'inventory', 'tires', 'oil',
    'paint', 'cores_new', 'cores_used', 'npn', 'bowman',
    'returns_11933', 'claims',
    'open_ros_service', 'counter_tickets_parts',
    'mfg_packing_slips', 'prepaid_special_orders',
    'inv_adjustments_rpm', 'oil_shop_supply_adj',
    'gl_24200', 'gl_24300', 'gl_24401', 'gl_other',
]


def safe(val) -> float:
    if val is None or val == '':
        return 0.0
    try:
        if pd.isna(val):
            return 0.0
    except (TypeError, ValueError):
        pass
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def ytd_rad(rad_by_month: dict, rec_year: int, rec_month: int) -> float:
    """Sum RAD entries from January of rec_year through rec_month inclusive."""
    total = 0.0
    for m in range(1, rec_month + 1):
        total += safe(rad_by_month.get(month_key(rec_year, m)))
    return total


def calculate_rec(inputs: dict, s1_total: float, s2_total: float,
                  ytd_rad_value: float) -> dict:
    """Build all rec line items from inputs + auto totals + YTD RAD."""

    inv   = safe(inputs.get('inventory'))
    tires = safe(inputs.get('tires'))
    oil   = safe(inputs.get('oil'))
    total_inv = inv + tires + oil

    paint      = safe(inputs.get('paint'))
    cores_new  = safe(inputs.get('cores_new'))
    cores_used = safe(inputs.get('cores_used'))
    npn        = safe(inputs.get('npn'))
    bowman     = safe(inputs.get('bowman'))
    returns    = safe(inputs.get('returns_11933'))
    claims     = safe(inputs.get('claims'))
    ro_svc     = safe(inputs.get('open_ros_service'))
    ro_ctr     = safe(inputs.get('counter_tickets_parts'))
    open_ros   = ro_svc + ro_ctr

    step8 = (total_inv + paint + cores_new + cores_used + npn + bowman
             + returns + claims + open_ros)

    gl_24200 = safe(inputs.get('gl_24200'))
    gl_24300 = safe(inputs.get('gl_24300'))
    gl_24401 = safe(inputs.get('gl_24401'))
    gl_other = safe(inputs.get('gl_other'))
    gl_total = gl_24200 + gl_24300 + gl_24401 + gl_other

    mfg_slips = safe(inputs.get('mfg_packing_slips'))
    prepaid   = safe(inputs.get('prepaid_special_orders'))
    inv_adj   = safe(inputs.get('inv_adjustments_rpm'))
    oil_adj   = safe(inputs.get('oil_shop_supply_adj'))

    step17 = (gl_total + mfg_slips + s2_total + prepaid - s1_total
              + inv_adj + oil_adj + ytd_rad_value)
    step19 = step17 - step8
    step19_pct = (step19 / gl_total) if gl_total else None

    return dict(
        inventory=inv, tires=tires, oil=oil, total_inv=total_inv,
        paint=paint, cores_new=cores_new, cores_used=cores_used,
        npn=npn, bowman=bowman, returns=returns, claims=claims,
        ro_svc=ro_svc, ro_ctr=ro_ctr, open_ros=open_ros, step8=step8,
        gl_24200=gl_24200, gl_24300=gl_24300, gl_24401=gl_24401,
        gl_other=gl_other, gl_total=gl_total,
        mfg_slips=mfg_slips, s2_total=s2_total, prepaid=prepaid,
        s1_total=s1_total, inv_adj=inv_adj, oil_adj=oil_adj,
        rad_ytd=ytd_rad_value,
        step17=step17, step19=step19, step19_pct=step19_pct,
    )
