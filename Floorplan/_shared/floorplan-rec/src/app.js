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
  var MAP_FIELDS = ["sch.vin", "sch.account", "sch.amount", "sch.stock", "sch.desc",
                    "stmt.vin", "stmt.amount", "stmt.stock", "stmt.desc", "opt.match"];

  // ------------------------------------------------------------------- state
  var state = {
    schedule: null,   // {headers:[], rows:[[]], name}
    statement: null,  // {headers:[], rows:[[]], name}
    map: {},          // field -> column index (or value for opt.match)
    autoMap: { schedule: false, statement: false },
    result: null,     // computed reconciliation
    activeTab: "off"
  };

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
        var data = e.target.result, wb;
        if (/\.(csv|tsv|txt)$/.test(name)) {
          wb = XLSX.read(data, { type: "binary", raw: true });
        } else {
          wb = XLSX.read(new Uint8Array(data), { type: "array" });
        }
        cb(chooseSheet(wb));
      } catch (err) { cb(null, err); }
    };
    if (/\.(csv|tsv|txt)$/.test(name)) reader.readAsBinaryString(file);
    else reader.readAsArrayBuffer(file);
  }

  // pick the sheet whose best VIN column covers the most rows
  function chooseSheet(wb) {
    var best = null, bestScore = -1;
    wb.SheetNames.forEach(function (sn) {
      var aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, blankrows: false, defval: "" });
      if (!aoa.length) return;
      var parsed = parseAoa(aoa);
      if (!parsed) return;
      var vinCol = scoreVinColumn(parsed.headers, parsed.rows);
      var cover = vinCol < 0 ? 0 : parsed.rows.reduce(function (a, r) { return a + (looksLikeVin(r[vinCol]) ? 1 : 0); }, 0);
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

  function scoreVinColumn(headers, rows) {
    var best = -1, bestScore = 0;
    for (var c = 0; c < headers.length; c++) {
      var vals = colValues(rows, c), hit = 0, n = 0;
      for (var i = 0; i < vals.length; i++) { if (vals[i] === "" || vals[i] == null) continue; n++; if (looksLikeVin(vals[i])) hit++; }
      if (n === 0) continue;
      var frac = hit / n;
      var hdrBonus = /vin|serial/i.test(headers[c]) ? 0.25 : 0;
      var score = frac + hdrBonus;
      if (frac >= 0.4 && score > bestScore) { bestScore = score; best = c; }
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

  // ============================================================ auto-mapping
  function autoMap(side) {
    var d = state[side];
    if (!d) return;
    var H = d.headers, R = d.rows;
    if (side === "schedule") {
      setMap("sch.vin", scoreVinColumn(H, R));
      setMap("sch.account", scoreAccountColumn(H, R));
      setMap("sch.amount", scoreAmountColumn(H, R, /balance|amount|net|principal|outstanding/i, /interest|fee|payment|due|rate|days/i));
      setMap("sch.stock", scoreLabelColumn(H, R, /stock/i));
      setMap("sch.desc", scoreLabelColumn(H, R, /desc|model|make/i));
      state.autoMap.schedule = true;
    } else {
      setMap("stmt.vin", scoreVinColumn(H, R));
      setMap("stmt.amount", scoreAmountColumn(H, R, /ending\s*balance|current\s*principal|principal|balance|outstanding/i, /interest|fee|payment|due|original|beginning|advance|rate|daily|maturit/i));
      setMap("stmt.stock", scoreLabelColumn(H, R, /stock/i));
      setMap("stmt.desc", scoreLabelColumn(H, R, /desc|model|make/i));
      state.autoMap.statement = true;
    }
  }
  function setMap(field, idx) { state.map[field] = idx; }

  // ============================================================ reconcile
  function aggregate(d, vinCol, amtCol, stockCol, descCol, acctFilter, acctCol) {
    var byVin = {};
    for (var i = 0; i < d.rows.length; i++) {
      var row = d.rows[i];
      var vin = normVin(row[vinCol]);
      if (!vin) continue;
      if (acctFilter != null && acctCol >= 0 && String(row[acctCol]).trim() !== acctFilter) continue;
      var amt = toNum(row[amtCol]);
      if (!byVin[vin]) byVin[vin] = { vin: vin, amt: 0, stock: "", desc: "", lines: 0, raw: String(row[vinCol]) };
      byVin[vin].amt += amt;
      byVin[vin].lines++;
      if (stockCol >= 0 && row[stockCol] && !byVin[vin].stock) byVin[vin].stock = String(row[stockCol]).trim();
      if (descCol >= 0 && row[descCol] && !byVin[vin].desc) byVin[vin].desc = String(row[descCol]).trim();
    }
    return byVin;
  }

  // build per-account summary on the schedule, flag the floorplan account
  function accountSummary(d, amtCol, acctCol) {
    if (acctCol < 0) return null;
    var acc = {};
    for (var i = 0; i < d.rows.length; i++) {
      var a = String(d.rows[i][acctCol]).trim();
      if (!a) continue;
      var amt = toNum(d.rows[i][amtCol]);
      if (!acc[a]) acc[a] = { acct: a, total: 0, lines: 0, veh: 0 };
      acc[a].total += amt;
      acc[a].lines++;
      if (Math.abs(amt) >= VEH_MIN && Math.abs(amt) <= VEH_MAX) acc[a].veh++;
    }
    var list = Object.keys(acc).map(function (k) { return acc[k]; });
    // floorplan account: the one with the most vehicle-sized lines (tie → largest |total|)
    var fp = null;
    list.forEach(function (a) {
      if (a.veh === 0) return;
      if (!fp || a.veh > fp.veh || (a.veh === fp.veh && Math.abs(a.total) > Math.abs(fp.total))) fp = a;
    });
    list.forEach(function (a) { a.isFp = (fp && a.acct === fp.acct); });
    return { list: list, fp: fp ? fp.acct : null };
  }

  function findMatch(key, otherKeys, mode) {
    if (otherKeys.has(key)) return key;
    if (mode === "full") return null;
    function tryLen(n) {
      if (key.length < n) return null;
      var suf = key.slice(-n), hit = null, count = 0;
      otherKeys.forEach(function (k) { if (k.length >= n && k.slice(-n) === suf) { hit = k; count++; } });
      return count === 1 ? hit : null;
    }
    if (mode === "8") return tryLen(8);
    if (mode === "6") return tryLen(6);
    return tryLen(8) || tryLen(6);                 // auto
  }

  function reconcile() {
    if (!state.schedule || !state.statement) { toast("Load both files first"); return; }
    var m = state.map;
    if (m["sch.vin"] == null || m["sch.vin"] < 0) { toast("Pick the schedule VIN column"); return; }
    if (m["stmt.vin"] == null || m["stmt.vin"] < 0) { toast("Pick the statement VIN column"); return; }
    if (m["sch.amount"] == null || m["sch.amount"] < 0) { toast("Pick the schedule floorplan balance column"); return; }
    if (m["stmt.amount"] == null || m["stmt.amount"] < 0) { toast("Pick the statement balance column"); return; }

    var acctCol = (m["sch.account"] == null) ? -1 : m["sch.account"];
    var summary = accountSummary(state.schedule, m["sch.amount"], acctCol);
    var fpAcct = summary ? summary.fp : null;

    var sch = aggregate(state.schedule, m["sch.vin"], m["sch.amount"], num(m["sch.stock"]), num(m["sch.desc"]), fpAcct, acctCol);
    var stmt = aggregate(state.statement, m["stmt.vin"], m["stmt.amount"], num(m["stmt.stock"]), num(m["stmt.desc"]), null, -1);

    var mode = m["opt.match"] || "auto";
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
      } else {
        schOnly.push({ vin: s.raw || s.vin, stock: s.stock, desc: s.desc, sch: Math.abs(s.amt), stmt: 0, diff: round2(Math.abs(s.amt)) });
      }
    });
    Object.keys(stmt).forEach(function (k) {
      if (used.has(k)) return;
      var t = stmt[k];
      stmtOnly.push({ vin: t.raw || t.vin, stock: t.stock, desc: t.desc, sch: 0, stmt: Math.abs(t.amt), diff: round2(-Math.abs(t.amt)) });
    });

    var schTotal = matched.reduce(function (a, r) { return a + r.sch; }, 0) + schOnly.reduce(function (a, r) { return a + r.sch; }, 0);
    var stmtTotal = matched.reduce(function (a, r) { return a + r.stmt; }, 0) + stmtOnly.reduce(function (a, r) { return a + r.stmt; }, 0);
    var off = matched.filter(function (r) { return !r.balanced; });

    state.result = {
      matched: matched, off: off, schOnly: schOnly, stmtOnly: stmtOnly,
      schTotal: round2(schTotal), stmtTotal: round2(stmtTotal), variance: round2(schTotal - stmtTotal),
      summary: summary, fpAcct: fpAcct
    };
    renderResults();
    save();
  }
  function num(v) { return (v == null) ? -1 : v; }
  function round2(n) { return Math.round(n * 100) / 100; }

  // ============================================================ rendering
  function renderBand() {
    var r = state.result;
    $("vSchedule").textContent = r ? fmt(r.schTotal) : "$0.00";
    $("vStatement").textContent = r ? fmt(r.stmtTotal) : "$0.00";
    $("vVariance").textContent = r ? fmt(r.variance) : "$0.00";
    $("vScheduleSub").textContent = r && r.fpAcct ? "floorplan acct " + r.fpAcct : "floorplan account";
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
    if (!r || !r.summary || !r.summary.list.length) return;
    r.summary.list.sort(function (a, b) { return Math.abs(b.total) - Math.abs(a.total); }).forEach(function (a) {
      var c = el("div", "acct-chip" + (a.isFp ? " fp" : ""));
      c.innerHTML = "<div class='muted' style='font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;font-weight:700'>" +
        (a.isFp ? "Floorplan account" : "Account " + a.acct) + "</div><b>" + a.acct + "</b> &middot; " +
        fmt(a.total) + " <span class='muted'>(" + a.lines + " lines)</span>";
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
    $("schAcctHint").textContent = state.result.fpAcct ? "Floorplan account detected: " + state.result.fpAcct : "";
  }

  // ============================================================ mapping UI
  function buildMapUI() {
    document.querySelectorAll("select[data-map]").forEach(function (sel) {
      var field = sel.getAttribute("data-map");
      if (field === "opt.match") { sel.value = state.map["opt.match"] || "auto"; sel.onchange = function () { state.map["opt.match"] = sel.value; }; return; }
      var side = field.indexOf("sch.") === 0 ? "schedule" : "statement";
      var d = state[side];
      sel.innerHTML = "";
      var none = el("option", null, "— none —"); none.value = "-1"; sel.appendChild(none);
      if (d) d.headers.forEach(function (h, i) { var o = el("option", null, (h || "(col " + (i + 1) + ")") + "  [" + colLetter(i) + "]"); o.value = String(i); sel.appendChild(o); });
      var v = state.map[field];
      sel.value = (v == null || v < 0) ? "-1" : String(v);
      sel.onchange = function () { state.map[field] = parseInt(sel.value, 10); };
    });
    $("mapping").classList.toggle("hidden", !(state.schedule && state.statement));
  }
  function colLetter(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  // ============================================================ file flow
  function onFile(side, file) {
    readFile(file, function (parsed, err) {
      if (err || !parsed) { toast("Could not read that file"); return; }
      state[side] = { headers: parsed.headers, rows: parsed.rows, name: file.name };
      autoMap(side);
      var fn = $("fname" + cap(side)); fn.textContent = file.name + "  (" + parsed.rows.length + " rows)"; fn.classList.remove("hidden");
      $("drop" + cap(side)).classList.add("loaded");
      buildMapUI();
      save();
      toast(cap(side) + " loaded — " + parsed.rows.length + " rows");
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function wireDrop(which) {
    var drop = $("drop" + cap(which));
    var input = $("file" + cap(which));
    input.addEventListener("change", function () { if (input.files[0]) onFile(which, input.files[0]); });
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) onFile(which, e.dataTransfer.files[0]); });
  }

  // ============================================================ persistence
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        schedule: state.schedule, statement: state.statement, map: state.map, result: state.result, activeTab: state.activeTab
      }));
    } catch (e) { /* quota — ignore */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY); if (!raw) return;
      var s = JSON.parse(raw);
      state.schedule = s.schedule; state.statement = s.statement; state.map = s.map || {}; state.result = s.result; state.activeTab = s.activeTab || "off";
      if (state.schedule) { $("fnameSchedule").textContent = state.schedule.name; $("fnameSchedule").classList.remove("hidden"); $("dropSchedule").classList.add("loaded"); }
      if (state.statement) { $("fnameStatement").textContent = state.statement.name; $("fnameStatement").classList.remove("hidden"); $("dropStatement").classList.add("loaded"); }
      buildMapUI();
      if (state.result) renderResults();
    } catch (e) { /* corrupt — ignore */ }
  }
  function resetAll() {
    if (!confirm("Clear all loaded files and results?")) return;
    localStorage.removeItem(LS_KEY);
    state = { schedule: null, statement: null, map: {}, autoMap: { schedule: false, statement: false }, result: null, activeTab: "off" };
    ["Schedule", "Statement"].forEach(function (s) { $("fname" + s).classList.add("hidden"); $("drop" + s).classList.remove("loaded"); });
    $("mapping").classList.add("hidden"); $("results").classList.add("hidden");
    renderBand();
    toast("Reset");
  }

  function exportJson() {
    var blob = new Blob([JSON.stringify({ schedule: state.schedule, statement: state.statement, map: state.map }, null, 2)], { type: "application/json" });
    downloadBlob(blob, "floorplan-rec-backup.json");
  }
  function importJson(file) {
    var r = new FileReader();
    r.onload = function (e) {
      try {
        var s = JSON.parse(e.target.result);
        state.schedule = s.schedule; state.statement = s.statement; state.map = s.map || {};
        if (state.schedule) { $("fnameSchedule").textContent = state.schedule.name || "restored"; $("fnameSchedule").classList.remove("hidden"); $("dropSchedule").classList.add("loaded"); }
        if (state.statement) { $("fnameStatement").textContent = state.statement.name || "restored"; $("fnameStatement").classList.remove("hidden"); $("dropStatement").classList.add("loaded"); }
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
      ["Floorplan account", r.fpAcct || "(single account)"],
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
    // a compact Honda-style statement and a matching CDK-style schedule with
    // one off-balance unit, one sold (schedule-only) and one newly floored (statement-only).
    var stmtHeaders = ["Invoice Date", "Invoice Number", "Description", "Serial No/VIN", "Stock/Lease No", "Original Amount", "Beginning Balance", "Interest Amount", "Ending Balance"];
    var stmtRows = [
      ["2026-02-24", "947", "2026 Honda RIDGELINE", "5FPYK3F57TB000947", "H30289", 43000, 43000, 23.26, 43000],
      ["2026-02-25", "1605", "2026 Honda ACCORD", "1HGCY2F86TA001605", "H30290", 38277.70, 38277.70, 160.45, 38277.70],
      ["2026-03-25", "3665", "2026 Honda ACCORD", "1HGCY2F54TA003665", "H30295", 33832.98, 0, 32.02, 33832.98],
      ["2026-02-24", "5961", "2026 Honda CR-V", "5J6RS4H73TL005961", "H30714", 37500, 37500, 157.19, 37500],
      ["2026-02-10", "6200", "2026 Honda CR-V", "7FARS4H78TE006200", "H30794", 37500, 37500, 121.69, 35000]   // off by 2,500
    ];
    var schHeaders = ["Account", "Stock #", "VIN", "Vehicle", "Floorplan Balance"];
    var schRows = [
      ["302000", "H30289", "5FPYK3F57TB000947", "26 RIDGELINE", -43000],
      ["302000", "H30290", "1HGCY2F86TA001605", "26 ACCORD", -38277.70],
      ["302000", "H30295", "1HGCY2F54TA003665", "26 ACCORD", -33832.98],
      ["302000", "H30714", "5J6RS4H73TL005961", "26 CR-V", -37500],
      ["302000", "H30794", "7FARS4H78TE006200", "26 CR-V", -37500],          // schedule says 37,500; bank 35,000
      ["302000", "H30501", "5FNYF6H59TB099999", "26 PILOT", -41000],          // on schedule, not on statement (sold)
      ["120100", "", "", "Down payment clearing", -250],                       // a second, non-floorplan account
      ["120100", "", "", "Misc", 175]
    ];
    state.schedule = { headers: schHeaders, rows: schRows, name: "SAMPLE — schedule.csv" };
    state.statement = { headers: stmtHeaders, rows: stmtRows.concat([["2026-03-30", "9001", "2026 Honda HRV", "3CZRZ2H50TM008888", "H30999", 31000, 0, 5, 31000]]), name: "SAMPLE — statement.csv" };
    autoMap("schedule"); autoMap("statement");
    ["Schedule", "Statement"].forEach(function (s) {
      var d = state[s.toLowerCase()];
      $("fname" + s).textContent = d.name + "  (" + d.rows.length + " rows)"; $("fname" + s).classList.remove("hidden"); $("drop" + s).classList.add("loaded");
    });
    buildMapUI();
    reconcile();
    toast("Sample loaded & reconciled");
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
    load();
    renderBand();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
