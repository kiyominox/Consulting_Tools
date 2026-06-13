/* Floorplan Reconciliation — offline single-file tool.
 *
 * Matches a bank floorplan statement against the CDK floorplan schedule on VIN
 * (full or partial), identifies the floorplan account on the schedule by its
 * vehicle-sized credit balances, and reports per-unit and total variances.
 * No network calls — all parsing/matching happens in the browser. */
(function () {
  "use strict";

  // ----------------------------------------------------------------- constants
  var LS_KEY = "floorplan-rec-v1";
  var VEH_MIN = 3000, VEH_MAX = 300000;        // plausible per-unit floorplan balance
  var EPS = 0.005;                              // "balanced" tolerance

  // ------------------------------------------------------------------- state
  // Both sides are ADDITIVE lists of files. Each file is normalized to unit
  // records via its own column map, so files with different layouts still
  // combine. The schedule may carry several floorplan accounts; each is a
  // toggle the user can include/exclude.
  var state = {
    schedule: [],     // [{id,name,headers,rows,map:{vin,account,amount,stock,desc}}]
    statement: [],    // [{id,name,headers,rows,map:{vin,amount,stock,desc}}]
    acctOverride: {}, // schedule account -> true/false include override (else auto)
    matchMode: "auto",
    result: null,     // computed reconciliation
    activeTab: "off"
  };
  var _uid = 0;

  // ============================================================ DOM helpers
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove("show"); }, 2200); }
  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    var s = (Math.abs(n)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? "-$" : "$") + s;
  }

  // ============================================================ value parsing
  function toNum(v) {
    if (typeof v === "number") return v;
    if (v == null) return 0;
    var s = String(v).trim();
    if (!s) return 0;
    var neg = /^\(.*\)$/.test(s);                 // accounting parens = negative
    s = s.replace(/[()$,\s]/g, "");
    var n = parseFloat(s);
    if (isNaN(n)) return 0;
    return neg ? -n : n;
  }
  function normVin(v) {
    if (v == null) return "";
    return String(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function looksLikeVin(v) {
    var s = normVin(v);
    if (s.length < 11 || s.length > 17) return false;
    return /[A-Z]/.test(s) && /[0-9]/.test(s);
  }
  // serial-like: a full VIN OR a partial serial (CDK schedules print only the
  // last 6 of the VIN, e.g. "757192"/"022896"). Excludes age/year (1–4 digits).
  function serialLike(v) {
    var s = normVin(v);
    if (s.length < 5 || s.length > 17) return false;
    return /[0-9]/.test(s);
  }
  function looksLikeAccount(v) {
    if (v == null || v === "") return false;
    var s = String(v).trim();
    return /^\d{4,7}$/.test(s);                    // GL accounts: 4–7 digit integers
  }

  // ============================================================ file reading
  function readFile(file, cb) {
    var name = file.name.toLowerCase();
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = e.target.result;
        if (/\.pdf$/.test(name)) { extractPdf(new Uint8Array(data)).then(function (parsed) { cb(parsed); }, function (err) { cb(null, err); }); return; }
        var wb;
        if (/\.(csv|tsv|txt)$/.test(name)) wb = XLSX.read(data, { type: "binary", raw: true });
        else wb = XLSX.read(new Uint8Array(data), { type: "array" });
        cb(chooseSheet(wb));
      } catch (err) { cb(null, err); }
    };
    if (/\.(csv|tsv|txt)$/.test(name)) reader.readAsBinaryString(file);
    else reader.readAsArrayBuffer(file);
  }

  // ---- PDF: reconstruct a table grid from text positions (fully offline) ----
  var _pdfReady = false;
  function initPdf() {
    if (_pdfReady || typeof pdfjsLib === "undefined") return _pdfReady;
    try {
      var src = document.getElementById("pdfWorkerSrc").textContent;
      var blob = new Blob([src], { type: "application/javascript" });
      pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      _pdfReady = true;
    } catch (e) { _pdfReady = false; }
    return _pdfReady;
  }

  function extractPdf(bytes) {
    if (typeof pdfjsLib === "undefined") return Promise.reject(new Error("PDF support not loaded"));
    initPdf();
    return pdfjsLib.getDocument({ data: bytes }).promise.then(function (pdf) {
      var pages = [];
      var seq = Promise.resolve();
      for (var p = 1; p <= pdf.numPages; p++) {
        (function (pn) { seq = seq.then(function () { return pdf.getPage(pn).then(function (page) { return page.getTextContent().then(function (tc) { pages.push(tc.items); }); }); }); })(p);
      }
      return seq.then(function () { return parseAoa(pdfItemsToGrid(pages)); });
    });
  }

  // group text items into rows (by y) and columns (by clustered x) → array-of-arrays
  function pdfItemsToGrid(pages) {
    var items = [];
    pages.forEach(function (pageItems) {
      pageItems.forEach(function (it) {
        var s = (it.str || "").trim();
        if (!s) return;
        var x = it.transform[4], y = it.transform[5];
        items.push({ x: x, y: y, w: it.width || 0, s: s, page: items._pg || 0 });
      });
    });
    if (!items.length) return [];
    // column boundaries: cluster all left-x values across the doc
    var xs = items.map(function (i) { return i.x; }).sort(function (a, b) { return a - b; });
    var cols = [], cur = xs[0], group = [xs[0]];
    for (var i = 1; i < xs.length; i++) {
      if (xs[i] - cur > 14) { cols.push(median(group)); group = []; }
      group.push(xs[i]); cur = xs[i];
    }
    if (group.length) cols.push(median(group));
    function colIndex(x) { var best = 0, bd = Infinity; for (var c = 0; c < cols.length; c++) { var d = Math.abs(cols[c] - x); if (d < bd) { bd = d; best = c; } } return best; }
    // rows: bucket by rounded y (3px tolerance), descending y = top→bottom
    var rowsMap = {};
    items.forEach(function (it) {
      var key = Math.round(it.y / 3) * 3;
      (rowsMap[key] = rowsMap[key] || []).push(it);
    });
    var ys = Object.keys(rowsMap).map(Number).sort(function (a, b) { return b - a; });
    var aoa = [];
    ys.forEach(function (yk) {
      var line = rowsMap[yk].sort(function (a, b) { return a.x - b.x; });
      var row = new Array(cols.length).fill("");
      line.forEach(function (it) { var ci = colIndex(it.x); row[ci] = row[ci] ? (row[ci] + " " + it.s) : it.s; });
      aoa.push(row);
    });
    return aoa;
  }
  function median(arr) { var a = arr.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; }

  // pick the sheet whose best VIN column covers the most rows
  function chooseSheet(wb) {
    var best = null, bestScore = -1;
    wb.SheetNames.forEach(function (sn) {
      var aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, blankrows: false, defval: "" });
      if (!aoa.length) return;
      var parsed = parseAoa(aoa);
      if (!parsed) return;
      var vinCol = scoreVinColumn(parsed.headers, parsed.rows);
      var cover = vinCol < 0 ? 0 : parsed.rows.reduce(function (a, r) { return a + (serialLike(r[vinCol]) ? 1 : 0); }, 0);
      if (cover > bestScore) { bestScore = cover; best = parsed; }
    });
    return best;
  }

  // turn an array-of-arrays into {headers, rows} by locating the header row
  function parseAoa(aoa) {
    if (!aoa || !aoa.length) return null;
    var limit = Math.min(aoa.length, 20), headerIdx = 0, bestScore = -1;
    for (var i = 0; i < limit; i++) {
      var row = aoa[i] || [];
      var labels = 0, nums = 0;
      for (var c = 0; c < row.length; c++) {
        var v = row[c];
        if (v == null || v === "") continue;
        if (typeof v === "number") nums++;
        else if (/^[\s\d.,$%()/-]+$/.test(String(v))) nums++;
        else labels++;
      }
      var score = labels - nums * 0.5;            // header rows are text-heavy
      if (labels >= 3 && score > bestScore) { bestScore = score; headerIdx = i; }
    }
    var headerRow = (aoa[headerIdx] || []).map(function (h) { return String(h == null ? "" : h).replace(/[\r\n]+/g, " ").replace(/_x000D_/g, "").trim(); });
    var width = headerRow.length;
    var rows = [];
    for (var r = headerIdx + 1; r < aoa.length; r++) {
      var rr = aoa[r] || [];
      var filled = 0;
      for (var k = 0; k < rr.length; k++) if (rr[k] != null && rr[k] !== "") filled++;
      if (filled >= Math.max(2, width * 0.25)) {
        var out = [];
        for (var w = 0; w < width; w++) out[w] = rr[w] == null ? "" : rr[w];
        rows.push(out);
      }
    }
    return { headers: headerRow, rows: rows };
  }

  // ============================================================ column scoring
  function colValues(rows, idx) { return rows.map(function (r) { return r[idx]; }); }

  // Find the VIN/serial column. A header literally named VIN/Serial wins (this
  // is how every CDK schedule and lender statement labels it, and lets us pick
  // up partial-serial columns of pure digits); otherwise fall back to a
  // full-VIN content heuristic.
  function scoreVinColumn(headers, rows) {
    var byHeader = -1, byHeaderScore = 0;
    for (var c = 0; c < headers.length; c++) {
      if (!/vin|serial/i.test(headers[c] || "")) continue;
      var vals = colValues(rows, c), hit = 0, n = 0;
      for (var i = 0; i < vals.length; i++) { if (vals[i] === "" || vals[i] == null) continue; n++; if (serialLike(vals[i])) hit++; }
      if (n === 0) continue;
      var frac = hit / n;
      if (frac >= 0.5 && frac > byHeaderScore) { byHeaderScore = frac; byHeader = c; }
    }
    if (byHeader >= 0) return byHeader;
    // fallback: best full-VIN column by content
    var best = -1, bestScore = 0;
    for (var c2 = 0; c2 < headers.length; c2++) {
      var v2 = colValues(rows, c2), h2 = 0, n2 = 0;
      for (var j = 0; j < v2.length; j++) { if (v2[j] === "" || v2[j] == null) continue; n2++; if (looksLikeVin(v2[j])) h2++; }
      if (n2 === 0) continue;
      var f2 = h2 / n2;
      if (f2 >= 0.4 && f2 > bestScore) { bestScore = f2; best = c2; }
    }
    return best;
  }

  // fraction of non-zero numeric values that sit in the per-vehicle range
  function vehicleScore(rows, idx) {
    var vals = colValues(rows, idx), inRange = 0, nonZero = 0, anyNum = 0;
    for (var i = 0; i < vals.length; i++) {
      var n = toNum(vals[i]);
      if (vals[i] === "" || vals[i] == null) continue;
      if (typeof vals[i] === "number" || /\d/.test(String(vals[i]))) anyNum++;
      if (n === 0) continue;
      nonZero++;
      if (Math.abs(n) >= VEH_MIN && Math.abs(n) <= VEH_MAX) inRange++;
    }
    if (anyNum < rows.length * 0.3) return 0;       // mostly text → not an amount col
    if (nonZero === 0) return 0;
    return inRange / nonZero;
  }

  function scoreAmountColumn(headers, rows, preferRe, avoidRe) {
    var best = -1, bestScore = -1;
    for (var c = 0; c < headers.length; c++) {
      var vs = vehicleScore(rows, c);
      if (vs <= 0) continue;
      var h = headers[c] || "";
      var score = vs;
      if (preferRe && preferRe.test(h)) score += 0.6;
      if (avoidRe && avoidRe.test(h)) score -= 0.8;
      // reward columns that actually carry balances (sum magnitude)
      var sum = Math.abs(colValues(rows, c).reduce(function (a, v) { return a + toNum(v); }, 0));
      if (sum > 0) score += Math.min(0.2, sum / 1e8);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  function scoreAccountColumn(headers, rows) {
    var best = -1, bestScore = 0;
    for (var c = 0; c < headers.length; c++) {
      var vals = colValues(rows, c), hit = 0, n = 0, distinct = {};
      for (var i = 0; i < vals.length; i++) { if (vals[i] === "" || vals[i] == null) continue; n++; if (looksLikeAccount(vals[i])) { hit++; distinct[String(vals[i]).trim()] = 1; } }
      if (n === 0) continue;
      var d = Object.keys(distinct).length;
      var frac = hit / n;
      if (frac >= 0.6 && d >= 1 && d <= 40 && !looksLikeVinCol(vals)) {
        var score = frac + (/account|acct|gl/i.test(headers[c]) ? 0.3 : 0) - d * 0.005;
        if (score > bestScore) { bestScore = score; best = c; }
      }
    }
    return best;
  }
  function looksLikeVinCol(vals) { var h = 0, n = 0; for (var i = 0; i < vals.length; i++) { if (vals[i] === "" || vals[i] == null) continue; n++; if (looksLikeVin(vals[i])) h++; } return n > 0 && h / n > 0.5; }

  function scoreLabelColumn(headers, rows, re) {
    for (var c = 0; c < headers.length; c++) if (re.test(headers[c] || "")) return c;
    return -1;
  }

  // fraction of NON-BLANK non-zero values that are vehicle-sized (no density
  // guard) — wide-format floorplan columns are sparse (each unit sits in one).
  function vehicleFracNonBlank(rows, idx) {
    var vals = colValues(rows, idx), nz = 0, inR = 0;
    for (var i = 0; i < vals.length; i++) {
      if (vals[i] === "" || vals[i] == null) continue;
      var n = toNum(vals[i]); if (n === 0) continue;
      nz++; if (Math.abs(n) >= VEH_MIN && Math.abs(n) <= VEH_MAX) inR++;
    }
    return nz ? inR / nz : 0;
  }
  // A schedule may hold several floorplan balance columns side by side (wide
  // format: e.g. "New FP Balance" + "Used FP Balance"). Returns the primary
  // balance column plus any extra columns whose header clearly names a
  // balance/floorplan and that carry vehicle-sized values (even if sparse).
  function scoreAmountColumns(headers, rows, preferRe, avoidRe) {
    var set = {};
    var primary = scoreAmountColumn(headers, rows, preferRe, avoidRe);
    if (primary >= 0) set[primary] = 1;
    var strong = /floor|floorplan|\bfp\b|balance|\bbal\b|principal|outstanding/i;
    for (var c = 0; c < headers.length; c++) {
      if (set[c]) continue;
      var h = headers[c] || "";
      if (avoidRe && avoidRe.test(h)) continue;
      if (strong.test(h) && vehicleFracNonBlank(rows, c) >= 0.5) set[c] = 1;
    }
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }

  // ============================================================ auto-mapping
  function autoMapFor(H, R, side) {
    if (side === "schedule") return {
      vin: scoreVinColumn(H, R),
      account: scoreAccountColumn(H, R),
      amounts: scoreAmountColumns(H, R, /balance|amount|net|principal|outstanding/i, /interest|fee|payment|due|rate|days/i),
      stock: scoreLabelColumn(H, R, /stock|^vehicle$/i),
      desc: scoreLabelColumn(H, R, /desc|model|^mdl$|make/i)
    };
    return {
      vin: scoreVinColumn(H, R),
      account: -1,
      amount: scoreAmountColumn(H, R, /ending\s*balance|current\s*principal|principal|balance|outstanding/i, /interest|fee|payment|due|original|beginning|advance|rate|daily|maturit/i),
      stock: scoreLabelColumn(H, R, /stock/i),
      desc: scoreLabelColumn(H, R, /desc|model|make/i)
    };
  }

  // flatten every loaded file on a side into normalized unit records, using each
  // file's own column map (so files with different layouts still combine).
  function balanceCols(f, side) {
    var m = f.map;
    var cols = side === "schedule"
      ? (Array.isArray(m.amounts) ? m.amounts : (m.amount >= 0 ? [m.amount] : []))
      : (m.amount >= 0 ? [m.amount] : []);
    return cols.filter(function (x) { return x != null && x >= 0; });
  }
  function recordsFor(side) {
    var out = [];
    state[side].forEach(function (f) {
      var m = f.map, R = f.rows, H = f.headers || [];
      var cols = balanceCols(f, side), wide = cols.length > 1;   // wide = several balance columns side by side
      for (var i = 0; i < R.length; i++) {
        var row = R[i];
        if (m.vin < 0 || !serialLike(row[m.vin])) continue;      // skip totals / non-unit rows
        for (var a = 0; a < cols.length; a++) {
          var ac = cols[a], cell = row[ac];
          if (wide && (cell === "" || cell == null)) continue;   // wide: only the populated balance column for this unit
          out.push({
            vin: normVin(row[m.vin]), raw: String(row[m.vin]),
            // wide → each balance column is its own floorplan account (named by header);
            // otherwise use the account column if mapped.
            account: wide ? (String(H[ac] || "").trim() || ("Balance " + colLetter(ac)))
                          : ((m.account >= 0 && row[m.account] != null) ? String(row[m.account]).trim() : ""),
            amount: toNum(cell),
            stock: (m.stock >= 0 && row[m.stock] != null) ? String(row[m.stock]).trim() : "",
            desc: (m.desc >= 0 && row[m.desc] != null) ? String(row[m.desc]).trim() : ""
          });
        }
      }
    });
    return out;
  }
  function aggregateRecords(records) {
    var byVin = {};
    records.forEach(function (r) {
      if (!byVin[r.vin]) byVin[r.vin] = { vin: r.vin, raw: r.raw, amt: 0, stock: "", desc: "", lines: 0 };
      byVin[r.vin].amt += r.amount;
      byVin[r.vin].lines++;
      if (r.stock && !byVin[r.vin].stock) byVin[r.vin].stock = r.stock;
      if (r.desc && !byVin[r.vin].desc) byVin[r.vin].desc = r.desc;
    });
    return byVin;
  }

  // ============================================================ reconcile
  // Per-account summary over the combined schedule. An account is "floorplan"
  // when most of its lines are vehicle-sized; records from a file with no
  // account column ("(blank)") are always included. User overrides win.
  function accountSummary(records) {
    var hasAcct = records.some(function (r) { return r.account !== ""; });
    if (!hasAcct) return { list: [], hasAcct: false, fpSet: null };
    var acc = {};
    records.forEach(function (r) {
      var a = r.account || "(blank)";
      if (!acc[a]) acc[a] = { acct: a, total: 0, lines: 0, veh: 0 };
      acc[a].total += r.amount; acc[a].lines++;
      if (Math.abs(r.amount) >= VEH_MIN && Math.abs(r.amount) <= VEH_MAX) acc[a].veh++;
    });
    var list = Object.keys(acc).map(function (k) { return acc[k]; });
    list.forEach(function (a) { a.fpDefault = (a.acct === "(blank)") || (a.veh > 0 && a.veh / a.lines >= 0.5); });
    if (!list.some(function (a) { return a.fpDefault; })) {       // nothing obvious → the most vehicle-sized account
      var top = null; list.forEach(function (a) { if (a.veh > 0 && (!top || a.veh > top.veh)) top = a; });
      if (top) top.fpDefault = true;
    }
    var fpSet = {};
    list.forEach(function (a) {
      a.included = (a.acct in state.acctOverride) ? !!state.acctOverride[a.acct] : a.fpDefault;
      if (a.included) fpSet[a.acct] = true;
    });
    return { list: list, hasAcct: true, fpSet: fpSet };
  }

  function findMatch(key, otherKeys, mode) {
    if (otherKeys.has(key)) return key;
    if (mode === "full") return null;
    // exact last-N comparison (both sides trimmed to N)
    function tryLen(n) {
      if (key.length < n) return null;
      var suf = key.slice(-n), hit = null, count = 0;
      otherKeys.forEach(function (k) { if (k.length >= n && k.slice(-n) === suf) { hit = k; count++; } });
      return count === 1 ? hit : null;
    }
    if (mode === "8") return tryLen(8);
    if (mode === "6") return tryLen(6);
    // auto: one side may be a partial serial — match when the shorter key is a
    // suffix of the longer (or they share a long-enough tail), uniquely.
    function contain(minLen) {
      if (key.length < minLen) return null;
      var hit = null, count = 0;
      otherKeys.forEach(function (k) {
        var ok = (k === key) ||
                 (k.length > key.length && k.length >= minLen && k.slice(-key.length) === key) ||
                 (key.length > k.length && k.length >= minLen && key.slice(-k.length) === k);
        if (ok) { hit = k; count++; }
      });
      return count === 1 ? hit : null;
    }
    return tryLen(8) || contain(6) || contain(5);
  }

  function reconcile() {
    if (!state.schedule.length || !state.statement.length) { toast("Load at least one schedule and one statement file"); return; }
    var schRec = recordsFor("schedule"), stmtRec = recordsFor("statement");
    if (!schRec.length) { toast("No schedule units found — check the VIN column mapping"); return; }
    if (!stmtRec.length) { toast("No statement units found — check the VIN column mapping"); return; }

    var summary = accountSummary(schRec);
    var schUse = summary.hasAcct ? schRec.filter(function (r) { return summary.fpSet[r.account || "(blank)"]; }) : schRec;

    var sch = aggregateRecords(schUse), stmt = aggregateRecords(stmtRec);

    var mode = state.matchMode || "auto";
    var schKeys = Object.keys(sch), stmtKeySet = new Set(Object.keys(stmt));
    var used = new Set();
    var matched = [], schOnly = [], stmtOnly = [];

    schKeys.forEach(function (k) {
      var s = sch[k];
      var mk = findMatch(k, stmtKeySet, mode);
      if (mk && !used.has(mk)) {
        used.add(mk);
        var t = stmt[mk];
        var schAbs = Math.abs(s.amt), stmtAbs = Math.abs(t.amt);
        var diff = round2(schAbs - stmtAbs);
        matched.push({
          vin: s.raw || s.vin, stock: s.stock || t.stock, desc: s.desc || t.desc,
          sch: schAbs, stmt: stmtAbs, diff: diff, balanced: Math.abs(diff) < EPS
        });
      } else if (Math.abs(s.amt) >= EPS) {           // ignore zero-balance (paid/sold) units
        schOnly.push({ vin: s.raw || s.vin, stock: s.stock, desc: s.desc, sch: Math.abs(s.amt), stmt: 0, diff: round2(Math.abs(s.amt)) });
      }
    });
    Object.keys(stmt).forEach(function (k) {
      if (used.has(k)) return;
      var t = stmt[k];
      if (Math.abs(t.amt) < EPS) return;             // bank still lists sold units at $0 — not on the floorplan
      stmtOnly.push({ vin: t.raw || t.vin, stock: t.stock, desc: t.desc, sch: 0, stmt: Math.abs(t.amt), diff: round2(-Math.abs(t.amt)) });
    });

    var schTotal = matched.reduce(function (a, r) { return a + r.sch; }, 0) + schOnly.reduce(function (a, r) { return a + r.sch; }, 0);
    var stmtTotal = matched.reduce(function (a, r) { return a + r.stmt; }, 0) + stmtOnly.reduce(function (a, r) { return a + r.stmt; }, 0);
    var off = matched.filter(function (r) { return !r.balanced; });
    var fpAccts = summary.hasAcct ? Object.keys(summary.fpSet) : [];

    state.result = {
      matched: matched, off: off, schOnly: schOnly, stmtOnly: stmtOnly,
      schTotal: round2(schTotal), stmtTotal: round2(stmtTotal), variance: round2(schTotal - stmtTotal),
      summary: summary, fpAccts: fpAccts
    };
    renderResults();
    save();
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  // ============================================================ rendering
  function renderBand() {
    var r = state.result;
    $("vSchedule").textContent = r ? fmt(r.schTotal) : "$0.00";
    $("vStatement").textContent = r ? fmt(r.stmtTotal) : "$0.00";
    $("vVariance").textContent = r ? fmt(r.variance) : "$0.00";
    $("vScheduleSub").textContent = r && r.fpAccts && r.fpAccts.length
      ? (r.fpAccts.length === 1 ? "floorplan acct " + r.fpAccts[0] : r.fpAccts.length + " floorplan accounts")
      : "floorplan units";
    var unitCount = r ? (r.off.length + r.schOnly.length + r.stmtOnly.length) : 0;
    $("vUnits").textContent = unitCount;
    $("vUnitsSub").textContent = r ? (r.off.length + " off + " + r.schOnly.length + " sched-only + " + r.stmtOnly.length + " stmt-only") : "units needing attention";
    var cell = $("vVarCell");
    var bal = r ? Math.abs(r.variance) < EPS : true;
    cell.classList.toggle("balanced", bal);
  }

  function renderAccts() {
    var strip = $("acctStrip"); strip.innerHTML = "";
    var r = state.result;
    if (!r || !r.summary || !r.summary.hasAcct || !r.summary.list.length) return;
    var note = el("div", "muted", "Click an account to include or exclude it from the floorplan reconciliation.");
    note.style.cssText = "flex-basis:100%;font-size:11.5px;margin:0 0 2px";
    strip.appendChild(note);
    r.summary.list.slice().sort(function (a, b) { return Math.abs(b.total) - Math.abs(a.total); }).forEach(function (a) {
      var c = el("button", "acct-chip" + (a.included ? " fp" : " ex")); c.type = "button";
      c.innerHTML = "<div class='muted' style='font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:700'>" +
        (a.included ? "Floorplan account" : "Excluded") + "</div><b>" + a.acct + "</b> &middot; " +
        fmt(a.total) + " <span class='muted'>(" + a.lines + " lines &middot; " + a.veh + " vehicle-sized)</span>";
      c.onclick = function () { state.acctOverride[a.acct] = !a.included; reconcile(); };
      strip.appendChild(c);
    });
  }

  var TABS = [
    { id: "off", label: "Out of balance", warn: true, get: function (r) { return r.off; } },
    { id: "schOnly", label: "On schedule, not statement", warn: true, get: function (r) { return r.schOnly; } },
    { id: "stmtOnly", label: "On statement, not schedule", warn: true, get: function (r) { return r.stmtOnly; } },
    { id: "matched", label: "All matched", warn: false, get: function (r) { return r.matched; } }
  ];

  function renderTabs() {
    var tabs = $("tabs"); tabs.innerHTML = "";
    var r = state.result;
    TABS.forEach(function (t) {
      var rows = t.get(r);
      var b = el("div", "tab" + (t.warn && rows.length ? " warn" : "") + (state.activeTab === t.id ? " active" : ""));
      b.appendChild(el("span", null, t.label));
      b.appendChild(el("span", "cnt", String(rows.length)));
      b.onclick = function () { state.activeTab = t.id; renderTabs(); renderTable(); };
      tabs.appendChild(b);
    });
  }

  function renderTable() {
    var r = state.result;
    var tab = TABS.filter(function (t) { return t.id === state.activeTab; })[0] || TABS[0];
    var rows = tab.get(r);
    var thead = $("resultTable").querySelector("thead");
    var tbody = $("resultTable").querySelector("tbody");
    thead.innerHTML = "<tr><th>VIN / Serial</th><th>Stock #</th><th>Description</th><th class='r'>Schedule</th><th class='r'>Statement</th><th class='r'>Difference</th><th>Status</th></tr>";
    tbody.innerHTML = "";
    if (!rows.length) { tbody.innerHTML = "<tr><td colspan='7' class='empty'>Nothing here — this bucket is clean. 🎉</td></tr>"; return; }
    rows.forEach(function (row) {
      var tr = el("tr", Math.abs(row.diff) >= EPS ? "off" : "");
      tr.appendChild(el("td", null, row.vin));
      tr.appendChild(el("td", null, row.stock || "—"));
      tr.appendChild(el("td", null, row.desc || "—"));
      tr.appendChild(el("td", "r num", fmt(row.sch)));
      tr.appendChild(el("td", "r num", fmt(row.stmt)));
      tr.appendChild(el("td", "r num", fmt(row.diff)));
      var st = el("td");
      var status, cls;
      if (row.sch && !row.stmt) { status = "Sched only"; cls = "warn"; }
      else if (!row.sch && row.stmt) { status = "Stmt only"; cls = "warn"; }
      else if (Math.abs(row.diff) < EPS) { status = "Balanced"; cls = "ok"; }
      else { status = "Off " + fmt(row.diff); cls = "off"; }
      st.appendChild(el("span", "pill " + cls, status));
      tr.appendChild(st);
      tbody.appendChild(tr);
    });
  }

  function renderResults() {
    if (!state.result) return;
    $("results").classList.remove("hidden");
    renderBand(); renderAccts(); renderTabs(); renderTable();
    var fa = state.result.fpAccts || [];
    $("schAcctHint").textContent = fa.length ? "Floorplan accounts included: " + fa.join(", ") : "";
  }

  // ============================================================ mapping UI
  function buildMapUI() {
    ["schedule", "statement"].forEach(function (side) {
      var host = $("mapGrid" + cap(side));
      host.innerHTML = "";
      if (!state[side].length) { host.innerHTML = "<div class='hint'>No files loaded yet.</div>"; return; }
      state[side].forEach(function (f) { host.appendChild(fileMapCard(side, f)); });
    });
    var ms = $("matchMode"); ms.value = state.matchMode || "auto"; ms.onchange = function () { state.matchMode = ms.value; };
    $("mapping").classList.toggle("hidden", !(state.schedule.length && state.statement.length));
  }
  function colSelectEl(f, getIdx, setIdx) {
    var sel = el("select");
    var none = el("option", null, "— none —"); none.value = "-1"; sel.appendChild(none);
    f.headers.forEach(function (h, i) { var o = el("option", null, (h || "(col " + (i + 1) + ")") + "  [" + colLetter(i) + "]"); o.value = String(i); sel.appendChild(o); });
    var v = getIdx(); sel.value = (v == null || v < 0) ? "-1" : String(v);
    sel.onchange = function () { setIdx(parseInt(sel.value, 10)); };
    return sel;
  }
  function fileMapCard(side, f) {
    var card = el("div", "mapcard");
    card.appendChild(el("div", "mapcard-name", f.name));
    function simpleRow(label, key) {
      var row = el("div", "maprow");
      row.appendChild(el("label", null, label));
      row.appendChild(colSelectEl(f, function () { return f.map[key]; }, function (v) { f.map[key] = v; }));
      card.appendChild(row);
    }
    simpleRow("VIN / serial", "vin");
    if (side === "schedule") {
      simpleRow("Account # (optional)", "account");
      if (!Array.isArray(f.map.amounts)) f.map.amounts = (f.map.amount >= 0 ? [f.map.amount] : []);
      if (!f.map.amounts.length) f.map.amounts = [-1];
      var balWrap = el("div", "balcols");
      (function renderBal() {
        balWrap.innerHTML = "";
        f.map.amounts.forEach(function (idx, k) {
          var row = el("div", "maprow");
          row.appendChild(el("label", null, k === 0 ? "Floorplan balance" : "+ balance col"));
          row.appendChild(colSelectEl(f, function () { return f.map.amounts[k]; }, function (v) {
            if (v < 0 && f.map.amounts.length > 1) { f.map.amounts.splice(k, 1); renderBal(); }
            else f.map.amounts[k] = v;
          }));
          balWrap.appendChild(row);
        });
        var addRow = el("div", "maprow");
        var add = el("button", "ghost tiny", "+ add balance column"); add.type = "button";
        add.onclick = function () { f.map.amounts.push(-1); renderBal(); };
        addRow.appendChild(add); balWrap.appendChild(addRow);
      })();
      card.appendChild(balWrap);
      simpleRow("Stock #", "stock");
      simpleRow("Description", "desc");
    } else {
      simpleRow("Principal balance", "amount");
      simpleRow("Stock #", "stock");
      simpleRow("Description", "desc");
    }
    return card;
  }
  function colLetter(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  // ============================================================ file flow
  function renderFileList(side) {
    var host = $("fileList" + cap(side)); host.innerHTML = "";
    state[side].forEach(function (f) {
      var item = el("div", "fileitem");
      item.appendChild(el("span", "fi-name", f.name));
      item.appendChild(el("span", "fi-rows muted", f.rows.length + " rows"));
      var x = el("button", "fi-x", "✕"); x.type = "button"; x.title = "Remove file"; x.setAttribute("aria-label", "Remove " + f.name);
      x.onclick = function () { removeFile(side, f.id); };
      item.appendChild(x);
      host.appendChild(item);
    });
    $("drop" + cap(side)).classList.toggle("loaded", state[side].length > 0);
  }
  function removeFile(side, id) {
    state[side] = state[side].filter(function (f) { return f.id !== id; });
    renderFileList(side); buildMapUI(); save();
  }
  function onFiles(side, files) {
    var arr = Array.prototype.slice.call(files); if (!arr.length) return;
    var remaining = arr.length, added = 0;
    arr.forEach(function (file) {
      readFile(file, function (parsed, err) {
        remaining--;
        if (!err && parsed) {
          state[side].push({ id: ++_uid, name: file.name, headers: parsed.headers, rows: parsed.rows, map: autoMapFor(parsed.headers, parsed.rows, side) });
          added++;
        } else { toast("Could not read " + file.name); }
        if (remaining === 0) {
          renderFileList(side); buildMapUI(); save();
          if (added) toast(added + " " + side + " file" + (added > 1 ? "s" : "") + " loaded");
        }
      });
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function wireDrop(which) {
    var drop = $("drop" + cap(which));
    var input = $("file" + cap(which));
    input.addEventListener("change", function () { if (input.files.length) { onFiles(which, input.files); input.value = ""; } });
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); if (e.dataTransfer.files.length) onFiles(which, e.dataTransfer.files); });
  }

  // ============================================================ persistence
  function syncUid() { state.schedule.concat(state.statement).forEach(function (f) { if (f && f.id > _uid) _uid = f.id; }); }
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        schedule: state.schedule, statement: state.statement, acctOverride: state.acctOverride,
        matchMode: state.matchMode, result: state.result, activeTab: state.activeTab
      }));
    } catch (e) { /* quota — ignore */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY); if (!raw) return;
      var s = JSON.parse(raw);
      state.schedule = Array.isArray(s.schedule) ? s.schedule : [];
      state.statement = Array.isArray(s.statement) ? s.statement : [];
      state.acctOverride = s.acctOverride || {};
      state.matchMode = s.matchMode || "auto";
      state.result = s.result || null;
      state.activeTab = s.activeTab || "off";
      syncUid();
      renderFileList("schedule"); renderFileList("statement");
      buildMapUI();
      if (state.result) renderResults();
    } catch (e) { /* corrupt — ignore */ }
  }
  function resetAll() {
    if (!confirm("Clear all loaded files and results?")) return;
    localStorage.removeItem(LS_KEY);
    state = { schedule: [], statement: [], acctOverride: {}, matchMode: "auto", result: null, activeTab: "off" };
    renderFileList("schedule"); renderFileList("statement");
    buildMapUI();
    $("results").classList.add("hidden");
    renderBand();
    toast("Reset");
  }

  function exportJson() {
    var blob = new Blob([JSON.stringify({ schedule: state.schedule, statement: state.statement, acctOverride: state.acctOverride, matchMode: state.matchMode }, null, 2)], { type: "application/json" });
    downloadBlob(blob, "floorplan-rec-backup.json");
  }
  function importJson(file) {
    var r = new FileReader();
    r.onload = function (e) {
      try {
        var s = JSON.parse(e.target.result);
        state.schedule = Array.isArray(s.schedule) ? s.schedule : [];
        state.statement = Array.isArray(s.statement) ? s.statement : [];
        state.acctOverride = s.acctOverride || {};
        state.matchMode = s.matchMode || "auto";
        syncUid();
        renderFileList("schedule"); renderFileList("statement");
        buildMapUI(); save(); toast("Restored");
      } catch (err) { toast("Bad backup file"); }
    };
    r.readAsText(file);
  }

  // ============================================================ exports
  function downloadBlob(blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  function exportXlsx() {
    if (!state.result) { toast("Run reconcile first"); return; }
    var r = state.result;
    var wb = new ExcelJS.Workbook();
    var title = { bold: true, size: 13 };
    var hdrFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F74CF" } };
    var hdrFont = { bold: true, color: { argb: "FFFFFFFF" } };

    function sheet(name, rows) {
      var ws = wb.addWorksheet(name);
      ws.columns = [
        { header: "VIN / Serial", key: "vin", width: 22 },
        { header: "Stock #", key: "stock", width: 12 },
        { header: "Description", key: "desc", width: 26 },
        { header: "Schedule", key: "sch", width: 15 },
        { header: "Statement", key: "stmt", width: 15 },
        { header: "Difference", key: "diff", width: 15 }
      ];
      ws.getRow(1).eachCell(function (c) { c.fill = hdrFill; c.font = hdrFont; });
      rows.forEach(function (row) {
        var rr = ws.addRow({ vin: row.vin, stock: row.stock || "", desc: row.desc || "", sch: row.sch, stmt: row.stmt, diff: row.diff });
        ["sch", "stmt", "diff"].forEach(function (k) { rr.getCell(k).numFmt = '#,##0.00;[Red](#,##0.00)'; });
        if (Math.abs(row.diff) >= EPS) rr.getCell("diff").font = { color: { argb: "FFC0392B" }, bold: true };
      });
      return ws;
    }

    var ws = wb.addWorksheet("Summary");
    ws.mergeCells("A1:B1"); ws.getCell("A1").value = "Floorplan Reconciliation"; ws.getCell("A1").font = title;
    var rows = [
      ["Date", new Date().toLocaleDateString()],
      ["Floorplan accounts", (r.fpAccts && r.fpAccts.length) ? r.fpAccts.join(", ") : "(all units)"],
      ["Schedule files", state.schedule.map(function (f) { return f.name; }).join(" | ") || "—"],
      ["Statement files", state.statement.map(function (f) { return f.name; }).join(" | ") || "—"],
      ["Schedule total", r.schTotal],
      ["Statement total", r.stmtTotal],
      ["Variance", r.variance],
      ["Units out of balance", r.off.length],
      ["On schedule, not statement", r.schOnly.length],
      ["On statement, not schedule", r.stmtOnly.length]
    ];
    rows.forEach(function (rw, i) { var rr = ws.getRow(i + 3); rr.getCell(1).value = rw[0]; rr.getCell(1).font = { bold: true }; rr.getCell(2).value = rw[1]; if (typeof rw[1] === "number") rr.getCell(2).numFmt = '#,##0.00;[Red](#,##0.00)'; });
    ws.getColumn(1).width = 28; ws.getColumn(2).width = 18;

    sheet("Out of balance", r.off);
    sheet("Sched not on stmt", r.schOnly);
    sheet("Stmt not on sched", r.stmtOnly);
    sheet("All matched", r.matched);

    wb.xlsx.writeBuffer().then(function (buf) {
      downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Floorplan Reconciliation.xlsx");
    });
  }

  // ============================================================ sample data
  function loadSample() {
    // Two schedule files (a NEW-vehicle floorplan account and a USED-vehicle one,
    // plus a non-floorplan contracts-in-transit account that auto-excludes) and one
    // pooled bank statement — with one off-balance unit, one sold (schedule-only)
    // and one newly floored (statement-only). CDK schedules print the last 6 of
    // the VIN under "Serial"; the bank shows the full VIN.
    // File 1 — long format: one balance column + an account column (new floorplan
    // account 511171, plus a non-floorplan contracts-in-transit account that auto-excludes).
    var schHeaders = ["Account", "Stock", "Year", "Model", "Serial", "Sold Date", "Amount $"];
    var schNew = [
      ["511171", "T30289", "26", "RAV4", "000947", "", -43000],
      ["511171", "T30290", "26", "CAMRY", "001605", "", -38277.70],
      ["511171", "T30295", "26", "CAMRY", "003665", "", -33832.98],
      ["230100", "T44021", "", "Contract in transit", "880123", "", -250]    // not floorplan → auto-excluded
    ];
    // File 2 — WIDE format: two floorplan balance columns side by side (used + demo).
    var wideHeaders = ["Stock", "Year", "Model", "Serial", "Used FP Balance", "Demo FP Balance"];
    var schWide = [
      ["T30714", "26", "TACOMA", "005961", -37500, ""],
      ["T30794", "26", "TACOMA", "006200", -37500, ""],            // schedule 37,500; bank 35,000
      ["T30501", "26", "4RUNNER", "099999", -41000, ""],          // sold → on schedule, not statement
      ["T30888", "26", "SUPRA", "007777", "", -52000]             // a demo-floorplan unit
    ];
    var stmtHeaders = ["Invoice Date", "Invoice Number", "Description", "Serial No/VIN", "Stock/Lease No", "Original Amount", "Beginning Balance", "Interest Amount", "Ending Balance"];
    var stmtRows = [
      ["2026-02-24", "947", "2026 Toyota RAV4", "5FPYK3F57TB000947", "T30289", 43000, 43000, 23.26, 43000],
      ["2026-02-25", "1605", "2026 Toyota CAMRY", "1HGCY2F86TA001605", "T30290", 38277.70, 38277.70, 160.45, 38277.70],
      ["2026-03-25", "3665", "2026 Toyota CAMRY", "1HGCY2F54TA003665", "T30295", 33832.98, 0, 32.02, 33832.98],
      ["2026-02-24", "5961", "2026 Toyota TACOMA", "5J6RS4H73TL005961", "T30714", 37500, 37500, 157.19, 37500],
      ["2026-02-10", "6200", "2026 Toyota TACOMA", "7FARS4H78TE006200", "T30794", 37500, 37500, 121.69, 35000],
      ["2026-03-01", "7777", "2026 Toyota SUPRA", "JTDKARFU7T3007777", "T30888", 52000, 52000, 40.10, 52000],
      ["2026-03-30", "9001", "2026 Toyota HIGHLANDER", "3CZRZ2H50TM008888", "T30999", 31000, 0, 5, 31000]   // newly floored → statement only
    ];
    state = { schedule: [], statement: [], acctOverride: {}, matchMode: "auto", result: null, activeTab: "off" };
    state.schedule.push({ id: ++_uid, name: "SAMPLE — Rivendell Toyota new floorplan (long).csv", headers: schHeaders, rows: schNew, map: autoMapFor(schHeaders, schNew, "schedule") });
    state.schedule.push({ id: ++_uid, name: "SAMPLE — Rivendell Toyota used+demo floorplan (wide).csv", headers: wideHeaders, rows: schWide, map: autoMapFor(wideHeaders, schWide, "schedule") });
    state.statement.push({ id: ++_uid, name: "SAMPLE — Bank of Braavos Floorplan statement.csv", headers: stmtHeaders, rows: stmtRows, map: autoMapFor(stmtHeaders, stmtRows, "statement") });
    renderFileList("schedule"); renderFileList("statement");
    buildMapUI();
    reconcile();
    toast("Sample loaded & reconciled");
  }

  // ============================================================ keyboard nav
  function wireEnterNav(root) {
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.isComposing) return;
      var el = e.target;
      if (!el.matches("input:not([type=checkbox]):not([type=radio]):not([type=file]),select")) return;
      e.preventDefault();
      var all = Array.prototype.slice.call(root.querySelectorAll("input:not([type=hidden]):not([disabled]),select,textarea"))
        .filter(function (x) { return x.offsetParent !== null; });
      var i = all.indexOf(el), next = all[i + (e.shiftKey ? -1 : 1)];
      if (next) { next.focus(); if (next.select) try { next.select(); } catch (_) { } }
    });
  }

  // ============================================================ wire up
  function init() {
    wireDrop("schedule"); wireDrop("statement");
    $("btnReconcile").onclick = reconcile;
    $("btnSample").onclick = loadSample;
    $("btnReset").onclick = resetAll;
    $("btnExportJson").onclick = exportJson;
    $("btnImportJson").onclick = function () { $("jsonFile").click(); };
    $("jsonFile").addEventListener("change", function () { if (this.files[0]) importJson(this.files[0]); });
    $("btnPrint").onclick = function () { window.print(); };
    $("btnXlsx").onclick = exportXlsx;
    wireEnterNav($("mapping"));
    wireEnterNav(document.querySelector(".uploads"));
    load();
    renderBand();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
