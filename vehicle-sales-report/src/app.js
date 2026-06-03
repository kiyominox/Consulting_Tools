"use strict";
/* ----------------------------------------------------------------------------
   Vehicle Sales Report — standalone client-side tool
   Joins a CDK GL / Journal export (the "bible" for which deals appear) to a
   Deskit cross-reference export. GL "Reference" == Deskit "STOCK#".
   Money columns are computed from configurable GL account lists per category,
   per dealership. F&I Commission can be computed as a tiered % of F&I gross
   based on each business manager's monthly average. Config persists locally.
---------------------------------------------------------------------------- */

const CATEGORIES = [
  { key:"sale",      name:"Sale",            sign:-1, desc:"Vehicle selling-price accounts → feeds the Price column." },
  { key:"cost",      name:"Cost",            sign:+1, desc:"Vehicle cost-of-sale accounts → feeds the Cost column." },
  { key:"fiSale",    name:"F&I Sale",        sign:-1, desc:"F&I income accounts (warranty, gap, etc.) → revenue side of F&I Gross." },
  { key:"fiCost",    name:"F&I Cost",        sign:+1, desc:"F&I cost accounts → cost side of F&I Gross." },
  { key:"salesComm", name:"Sales Commission",sign:+1, desc:"Salesperson commission accounts → Sales Commission column." },
  { key:"fiComm",    name:"F&I Commission",  sign:+1, desc:"Business-manager commission → F&I Commission column (tiered % of F&I gross, or from GL accounts)." },
];
const DEALERSHIPS = ["MacDonald","Hillside"];
const LS_KEY = "vsr_config_v4";
const DEFAULT_TIERS = { t1:2000, r1:16, t2:2250, r2:18, r3:20 };

/* ---------- config model: accounts = [{n:"acct", d:"description"}] ---------- */
function blankDealerCfg(){
  const c = {};
  CATEGORIES.forEach(cat => c[cat.key] = { accounts:[], sign:cat.sign });
  c.fiComm.method = "tiered";                 // "tiered" | "accounts"
  c.fiComm.tiers  = Object.assign({}, DEFAULT_TIERS);
  return c;
}
function macDealerCfg(){
  const c = blankDealerCfg();
  const D = (typeof window!=="undefined" && window.MAC_DEFAULTS) ? window.MAC_DEFAULTS : {};
  CATEGORIES.forEach(cat=>{
    const arr = D[cat.key] || [];
    c[cat.key].accounts = arr.map(x => ({ n:String(x[0]), d: x[1]||"" }));
  });
  return c;
}
function defaultConfig(){
  return { MacDonald: macDealerCfg(), Hillside: blankDealerCfg() };
}
function coerceAccounts(arr){
  return (arr||[]).map(a => (typeof a==="object" && a!==null) ? {n:String(a.n||""),d:String(a.d||"")} : {n:String(a),d:""});
}
let CONFIG = loadConfig();
let CURRENT_DEALER = DEALERSHIPS[0];
let ACTIVE_CAT = CATEGORIES[0].key;

function loadConfig(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return defaultConfig();
    const parsed = JSON.parse(raw);
    const base = defaultConfig();
    DEALERSHIPS.forEach(d=>{
      if(parsed[d]) CATEGORIES.forEach(cat=>{
        const pc = parsed[d][cat.key];
        if(pc){
          base[d][cat.key].accounts = coerceAccounts(pc.accounts);
          if(typeof pc.sign === "number") base[d][cat.key].sign = pc.sign;
          if(cat.key==="fiComm"){
            if(pc.method==="tiered"||pc.method==="accounts") base[d].fiComm.method = pc.method;
            if(pc.tiers) base[d].fiComm.tiers = Object.assign({}, DEFAULT_TIERS, pc.tiers);
          }
        }
      });
    });
    return base;
  }catch(e){ return defaultConfig(); }
}
function saveConfig(){ localStorage.setItem(LS_KEY, JSON.stringify(CONFIG)); }

function normAcct(v){ return v==null?"":String(v).trim().toUpperCase().replace(/\s+/g,""); }
function normStock(v){ return v==null?"":String(v).trim().toUpperCase().replace(/\s+/g,""); }
function normName(v){ return v==null?"":String(v).trim().toUpperCase().replace(/\s+/g," "); }
function nonEmptyAccts(dcfg){ return dcfg.accounts.filter(a=>String(a.n).trim()!==""); }
function round2(v){ return Math.round((v + Number.EPSILON) * 100) / 100; }

/* ============================================================ SETTINGS UI */
const catTabsEl = document.getElementById("catTabs");
const catPanelsEl = document.getElementById("catPanels");

function buildCatTabs(){
  catTabsEl.innerHTML = "";
  CATEGORIES.forEach(cat=>{
    const b = document.createElement("button");
    const dc = CONFIG[CURRENT_DEALER][cat.key];
    let badge = nonEmptyAccts(dc).length;
    let label = cat.name + (badge? "  ("+badge+")":"");
    if(cat.key==="fiComm" && dc.method==="tiered") label = cat.name + "  (tiered)";
    b.textContent = label;
    b.className = cat.key===ACTIVE_CAT ? "active":"";
    b.onclick = ()=>{ ACTIVE_CAT = cat.key; buildCatTabs(); buildCatPanels(); };
    catTabsEl.appendChild(b);
  });
}

function buildTierEditor(dcfg){
  const box = document.createElement("div"); box.className="tier-box";
  box.innerHTML = "<h4>Rate by each business manager's average F&I gross per deal (this month)</h4>";
  const grid = document.createElement("div"); grid.className="tier-grid";
  const t = dcfg.tiers;
  function num(val,on,suffix){
    const wrap=document.createElement("span");
    const i=document.createElement("input"); i.type="number"; i.value=val; i.step="any";
    i.oninput=()=>on(parseFloat(i.value)); wrap.appendChild(i);
    if(suffix){ const s=document.createElement("span"); s.textContent=suffix; s.style.marginLeft="4px"; wrap.appendChild(s); }
    return wrap;
  }
  const s1=document.createElement("span"); s1.className="seg";
  s1.appendChild(document.createTextNode("avg < $")); s1.appendChild(num(t.t1,v=>t.t1=v));
  s1.appendChild(document.createTextNode("→")); s1.appendChild(num(t.r1,v=>t.r1=v,"%"));
  const s2=document.createElement("span"); s2.className="seg";
  s2.appendChild(document.createTextNode("$")); s2.appendChild(num(t.t1,v=>t.t1=v));
  s2.appendChild(document.createTextNode("–$")); s2.appendChild(num(t.t2,v=>t.t2=v));
  s2.appendChild(document.createTextNode("→"));
  s2.appendChild(num(t.r2,v=>t.r2=v,"%"));
  const s3=document.createElement("span"); s3.className="seg";
  s3.appendChild(document.createTextNode("avg > $")); s3.appendChild(num(t.t2,v=>t.t2=v));
  s3.appendChild(document.createTextNode("→")); s3.appendChild(num(t.r3,v=>t.r3=v,"%"));
  grid.appendChild(s1); grid.appendChild(s2); grid.appendChild(s3);
  box.appendChild(grid);
  const note=document.createElement("div"); note.className="muted"; note.style.cssText="font-size:12px;margin-top:8px";
  note.innerHTML="Each manager's rate is set by their month-average F&I gross, then applied to every one of their deals: "+
                 "F&I Commission = rate × that deal's F&I Gross. Business manager comes from Deskit's <b>FI MANAGER</b> field.";
  box.appendChild(note);
  return box;
}

function buildCatPanels(){
  catPanelsEl.innerHTML = "";
  CATEGORIES.forEach(cat=>{
    const dcfg = CONFIG[CURRENT_DEALER][cat.key];
    const panel = document.createElement("div");
    panel.className = "cat-panel" + (cat.key===ACTIVE_CAT?" active":"");
    if(cat.key!==ACTIVE_CAT){ catPanelsEl.appendChild(panel); return; } // lazy: only render active

    const meta = document.createElement("div");
    meta.className = "cat-meta";
    const desc = document.createElement("div"); desc.className="desc"; desc.innerHTML = cat.desc;
    const signWrap = document.createElement("div"); signWrap.className="sign-pick";
    signWrap.innerHTML = '<label>Balance type</label>';
    const sel = document.createElement("select"); sel.className="filter-input"; sel.style.minWidth="190px";
    sel.innerHTML = '<option value="-1">Credit (revenue) — negate</option><option value="1">Debit (cost/expense) — as-is</option>';
    sel.value = String(dcfg.sign);
    sel.onchange = ()=>{ dcfg.sign = parseInt(sel.value,10); };
    signWrap.appendChild(sel);
    meta.appendChild(desc); meta.appendChild(signWrap);
    panel.appendChild(meta);

    // ----- F&I Commission method switch -----
    let accountsEnabled = true;
    if(cat.key==="fiComm"){
      const mWrap=document.createElement("div"); mWrap.className="cat-meta"; mWrap.style.marginTop="-4px";
      mWrap.innerHTML='<div class="desc"><b>Calculation method</b></div>';
      const mSel=document.createElement("select"); mSel.className="filter-input"; mSel.style.minWidth="240px";
      mSel.innerHTML='<option value="tiered">Tiered % of F&I gross (by business manager)</option>'+
                     '<option value="accounts">Sum of GL commission accounts</option>';
      mSel.value=dcfg.method||"tiered";
      mSel.onchange=()=>{ dcfg.method=mSel.value; buildCatTabs(); buildCatPanels(); };
      mWrap.appendChild(mSel); panel.appendChild(mWrap);
      if((dcfg.method||"tiered")==="tiered"){ panel.appendChild(buildTierEditor(dcfg)); accountsEnabled=false; }
    }

    // ----- account list -----
    const listHdr=document.createElement("div");
    listHdr.className="muted"; listHdr.style.cssText="font-size:12px;margin-bottom:6px";
    listHdr.textContent = (cat.key==="fiComm" && !accountsEnabled)
      ? "GL accounts below are used only if you switch the method to “Sum of GL commission accounts”."
      : "GL account numbers in this category:";
    panel.appendChild(listHdr);

    const scroll = document.createElement("div"); scroll.className="acct-scroll";
    if(cat.key==="fiComm" && !accountsEnabled) scroll.style.opacity=".6";
    const list = document.createElement("div"); list.className="acct-list";
    function renderList(){
      list.innerHTML = "";
      if(dcfg.accounts.length===0){
        const empty=document.createElement("div"); empty.className="muted";
        empty.textContent="No accounts yet — add one below or paste a list."; list.appendChild(empty);
      }
      dcfg.accounts.forEach((acct,i)=>{
        const row=document.createElement("div"); row.className="acct-row";
        const inp=document.createElement("input"); inp.className="num"; inp.value=acct.n; inp.placeholder="Account #";
        inp.oninput=()=>{ acct.n=inp.value; };
        const dsc=document.createElement("input"); dsc.className="dsc"; dsc.value=acct.d; dsc.placeholder="Description (optional)";
        dsc.oninput=()=>{ acct.d=dsc.value; };
        const del=document.createElement("button"); del.className="tiny danger"; del.textContent="✕"; del.title="Remove";
        del.onclick=()=>{ dcfg.accounts.splice(i,1); renderList(); buildCatTabs(); };
        row.appendChild(inp); row.appendChild(dsc); row.appendChild(del);
        list.appendChild(row);
      });
    }
    renderList();
    scroll.appendChild(list);
    panel.appendChild(scroll);

    const actions=document.createElement("div"); actions.className="acct-actions";
    const addBtn=document.createElement("button"); addBtn.className="tiny"; addBtn.textContent="+ Add account";
    addBtn.onclick=()=>{ dcfg.accounts.push({n:"",d:""}); renderList(); buildCatTabs(); scroll.scrollTop=scroll.scrollHeight; };
    actions.appendChild(addBtn);
    panel.appendChild(actions);

    const bulk=document.createElement("details"); bulk.className="bulk";
    bulk.innerHTML="<summary>Bulk paste accounts</summary>";
    const ta=document.createElement("textarea");
    ta.placeholder="Paste account numbers — one per line, or comma/space separated.";
    bulk.appendChild(ta);
    const applyBtn=document.createElement("button"); applyBtn.className="tiny primary"; applyBtn.style.marginTop="8px";
    applyBtn.textContent="Add pasted accounts";
    applyBtn.onclick=()=>{
      const toks=ta.value.split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean);
      toks.forEach(t=>dcfg.accounts.push({n:t,d:""}));
      ta.value=""; renderList(); buildCatTabs();
    };
    bulk.appendChild(applyBtn);
    panel.appendChild(bulk);

    catPanelsEl.appendChild(panel);
  });
}

function refreshSettingsUI(){
  document.getElementById("settingsDealerName").textContent = CURRENT_DEALER;
  buildCatTabs(); buildCatPanels();
}

document.getElementById("saveCfgBtn").onclick = ()=>{
  DEALERSHIPS.forEach(d=>CATEGORIES.forEach(cat=>{
    CONFIG[d][cat.key].accounts = CONFIG[d][cat.key].accounts
      .map(a=>({n:String(a.n).trim(),d:String(a.d||"").trim()}))
      .filter(a=>a.n!=="");
  }));
  saveConfig();
  const s=document.getElementById("cfgSaveStatus"); s.textContent="✓ Saved"; s.style.color="var(--good)";
  setTimeout(()=>s.textContent="",2500);
  refreshSettingsUI();
};
document.getElementById("resetCfgBtn").onclick = ()=>{
  if(!confirm("Reset ALL account settings for BOTH dealerships back to the built-in defaults? (MacDonald accounts will be restored; Hillside will be emptied.)")) return;
  CONFIG = defaultConfig(); saveConfig(); refreshSettingsUI();
};
document.getElementById("exportCfgBtn").onclick = ()=>{
  const blob=new Blob([JSON.stringify(CONFIG,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download="vehicle-sales-report-accounts.json"; a.click();
};
document.getElementById("importCfgBtn").onclick = ()=>document.getElementById("importCfgFile").click();
document.getElementById("importCfgFile").onchange = (e)=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result); const base=defaultConfig();
      DEALERSHIPS.forEach(d=>{ if(parsed[d]) CATEGORIES.forEach(cat=>{
        const pc=parsed[d][cat.key];
        if(pc){
          base[d][cat.key].accounts=coerceAccounts(pc.accounts);
          if(typeof pc.sign==="number") base[d][cat.key].sign=pc.sign;
          if(cat.key==="fiComm"){
            if(pc.method==="tiered"||pc.method==="accounts") base[d].fiComm.method=pc.method;
            if(pc.tiers) base[d].fiComm.tiers=Object.assign({},DEFAULT_TIERS,pc.tiers);
          }
        }
      });});
      CONFIG=base; saveConfig(); refreshSettingsUI(); alert("Settings imported.");
    }catch(err){ alert("Could not read that settings file: "+err.message); }
  };
  r.readAsText(f); e.target.value="";
};
document.getElementById("dealerSel").onchange = (e)=>{
  CURRENT_DEALER=e.target.value; ACTIVE_CAT=CATEGORIES[0].key; refreshSettingsUI();
};
document.querySelectorAll("[data-toggle]").forEach(hd=>{
  hd.addEventListener("click",()=>hd.parentElement.classList.toggle("collapsed"));
});

/* ============================================================ FILE PARSING */
let glRawRows = null, glHeaders = [], glFormat = null;
let dkDeals = null;

function readSpreadsheet(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=(e)=>{ try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:"array",cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      resolve(XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null}));
    }catch(err){ reject(err); } };
    r.onerror=reject; r.readAsArrayBuffer(file);
  });
}

/* ---- Deskit ---- */
function parseDeskit(grid){
  let hr=-1;
  for(let i=0;i<Math.min(grid.length,25);i++){
    const row=(grid[i]||[]).map(c=>String(c==null?"":c).trim().toUpperCase());
    if(row.includes("DEAL#") && row.includes("STOCK#")){ hr=i; break; }
  }
  if(hr<0) throw new Error("Could not find the Deskit header row (need DEAL# and STOCK#).");
  const headers=grid[hr].map(c=>String(c==null?"":c).trim());
  const idx=name=>headers.findIndex(h=>h.toUpperCase()===name.toUpperCase());
  const col={ stock:idx("STOCK#"), make:idx("MAKE"), vehicle:idx("VEHICLE"),
    inservice:idx("INSERVICE DATE"), first:idx("FIRST NAME"), last:idx("LAST NAME"),
    sold:idx("SOLD DATE"), delivery:idx("DELIVERY DATE"),
    sp1:idx("SP1"), sm:idx("SM"), fi:idx("FI MANAGER"),
    vehType:idx("VEH TYPE"), type:idx("TYPE"), status:idx("STATUS") };
  const deals={};
  for(let i=hr+1;i<grid.length;i++){
    const row=grid[i]; if(!row) continue;
    const stock=normStock(col.stock>=0?row[col.stock]:null); if(!stock) continue;
    const g=c=>c>=0&&c<row.length?row[c]:null;
    deals[stock]={ stock:String(row[col.stock]).trim(), make:g(col.make), vehicle:g(col.vehicle),
      inservice:g(col.inservice), sold:g(col.sold), delivery:g(col.delivery),
      first:g(col.first), last:g(col.last), sp1:g(col.sp1), sm:g(col.sm), fi:g(col.fi),
      vehType:g(col.vehType), type:g(col.type), status:g(col.status) };
  }
  return deals;
}

/* ---- GL: detect CDK Journal Report vs flat GL ---- */
function gridLooksJournal(grid){
  for(const row of grid){
    if(!row) continue;
    const vals=row.map(c=>c==null?"":String(c).trim());
    if(vals.includes("Acct") && vals.includes("Amount") && vals.includes("Refer")) return true;
  }
  return false;
}
function parseJournalReport(grid){
  let cols=null; const rows=[];
  for(const row of grid){
    if(!row) continue;
    if(!cols){
      const vals=row.map(c=>c==null?"":String(c).trim());
      const ai=vals.indexOf("Acct"), mi=vals.indexOf("Amount"), ri=vals.indexOf("Refer");
      if(ai>=0&&mi>=0&&ri>=0){
        cols={ acct:ai, amount:mi, refer:ri, postdate:vals.indexOf("PostDate"),
               cntl:vals.indexOf("Cntl"), cntldesc:vals.indexOf("CntlDesc") };
      }
      continue;
    }
    const acctRaw=row[cols.acct];
    if(acctRaw==null) continue;
    const acct=String(acctRaw).trim();
    if(acct===""||acct==="Acct") continue;               // skip repeated detail headers
    const amtRaw=row[cols.amount];
    const amt=(typeof amtRaw==="number")?amtRaw:parseFloat(String(amtRaw).replace(/[$,()\s]/g,""));
    if(amtRaw==null||isNaN(amt)) continue;
    const referRaw=cols.refer>=0?row[cols.refer]:null;
    if(referRaw==null||String(referRaw).trim()==="") continue;
    rows.push({ Acct:acct, Refer:String(referRaw).trim(),
      Amount:(typeof amtRaw==="number")?amtRaw:amt,
      PostDate: cols.postdate>=0?row[cols.postdate]:null });
  }
  return { format:"journal", headers:["Refer","PostDate","Acct","Amount"], rows,
    mapping:{account:"Acct",ref:"Refer",date:"PostDate",amount:"Amount",debit:"",credit:""} };
}
function parseGLFlat(grid){
  let hr=-1,best=-1;
  for(let i=0;i<Math.min(grid.length,30);i++){
    const row=grid[i]||[];
    const strs=row.filter(c=>typeof c==="string"&&c.trim().length).length;
    const joined=row.map(c=>String(c==null?"":c).toLowerCase()).join("|");
    if(/account|acct|g\/?l|posting|reference|control|debit|credit|amount|journal/.test(joined)&&strs>best){best=strs;hr=i;}
  }
  if(hr<0) hr=grid.findIndex(r=>r&&r.some(c=>c!=null&&String(c).trim()!==""));
  if(hr<0) throw new Error("Could not locate a header row in the GL file.");
  const headers=grid[hr].map((c,i)=>String(c==null?"":c).trim()||("Column "+(i+1)));
  const rows=[];
  for(let i=hr+1;i<grid.length;i++){
    const row=grid[i]; if(!row) continue;
    if(row.every(c=>c==null||String(c).trim()==="")) continue;
    const o={}; headers.forEach((h,c)=>o[h]=c<row.length?row[c]:null); rows.push(o);
  }
  return { format:"flat", headers, rows, mapping:null };
}
function parseGL(grid){ return gridLooksJournal(grid) ? parseJournalReport(grid) : parseGLFlat(grid); }

function autodetectGLMapping(headers){
  const find=(...pats)=>{ for(const p of pats){ const i=headers.findIndex(h=>p.test(h)); if(i>=0) return headers[i]; } return ""; };
  return {
    account: find(/^acc?t?\.?\s*(no|num|#)?$/i,/account\s*(no|num|number|#)/i,/\bgl\s*(no|acct|account)/i,/account/i,/^acct/i),
    ref:     find(/reference/i,/\brefer\b/i,/\bref\b/i,/control/i,/stock/i),
    date:    find(/posting\s*date/i,/post\s*date/i,/\bdate\b/i),
    amount:  find(/^amount$/i,/net\s*amount/i,/\bamount\b/i,/\bamt\b/i),
    debit:   find(/^debit$/i,/\bdebit\b/i),
    credit:  find(/^credit$/i,/\bcredit\b/i),
  };
}
function fillMapSelect(sel,headers,chosen,allowNone){
  sel.innerHTML="";
  if(allowNone){ const o=document.createElement("option"); o.value=""; o.textContent="— none —"; sel.appendChild(o); }
  headers.forEach(h=>{ const o=document.createElement("option"); o.value=h; o.textContent=h; if(h===chosen)o.selected=true; sel.appendChild(o); });
}
function showGLMapping(headers, explicit){
  const m = explicit || autodetectGLMapping(headers);
  fillMapSelect(document.getElementById("mapAccount"),headers,m.account,false);
  fillMapSelect(document.getElementById("mapRef"),headers,m.ref,false);
  fillMapSelect(document.getElementById("mapDate"),headers,m.date,true);
  fillMapSelect(document.getElementById("mapAmount"),headers,m.amount,true);
  fillMapSelect(document.getElementById("mapDebit"),headers,m.debit,true);
  fillMapSelect(document.getElementById("mapCredit"),headers,m.credit,true);
  document.getElementById("glMapWrap").classList.remove("hide");
}

function wireDrop(dropId,inputId,nameId,onFile){
  const drop=document.getElementById(dropId), input=document.getElementById(inputId), nameEl=document.getElementById(nameId);
  function handle(file){
    if(!file) return;
    nameEl.style.color=""; nameEl.textContent="Loading "+file.name+" …";
    onFile(file).then(()=>{ drop.classList.add("loaded"); nameEl.textContent="✓ "+file.name; maybeEnableGenerate(); })
      .catch(err=>{ drop.classList.remove("loaded"); nameEl.textContent="✕ "+err.message; nameEl.style.color="var(--bad)"; });
  }
  input.addEventListener("change",e=>handle(e.target.files[0]));
  ["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("over");}));
  ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("over");}));
  drop.addEventListener("drop",e=>{ if(e.dataTransfer.files.length) handle(e.dataTransfer.files[0]); });
}
wireDrop("glDrop","glFile","glName", async (file)=>{
  const grid=await readSpreadsheet(file);
  const parsed=parseGL(grid);
  glRawRows=parsed.rows; glHeaders=parsed.headers; glFormat=parsed.format;
  showGLMapping(glHeaders, parsed.mapping);
  const note=document.getElementById("glFormatNote");
  if(parsed.format==="journal"){
    note.className="banner j";
    note.innerHTML="✓ <b>CDK Journal Report</b> detected — reading the <b>Refer Detail</b> lines ("+parsed.rows.length.toLocaleString()+" GL entries). Reference = Stock #, accounts and amounts mapped automatically.";
  }else{
    note.className="banner f";
    note.innerHTML="Flat GL layout detected — please confirm the column mapping below.";
  }
});
wireDrop("dkDrop","dkFile","dkName", async (file)=>{ dkDeals=parseDeskit(await readSpreadsheet(file)); });
function maybeEnableGenerate(){ document.getElementById("genBtn").disabled = !glRawRows; }

/* ============================================================ REPORT */
const REPORT_COLS = [
  {key:"soldDate",   label:"Sold Date",            type:"date"},
  {key:"stock",      label:"Stock #",              type:"text"},
  {key:"year",       label:"Year",                 type:"text"},
  {key:"model",      label:"Model",                type:"text"},
  {key:"vehType",    label:"Veh Type",             type:"text"},
  {key:"dealType",   label:"Deal Type",            type:"text"},
  {key:"customer",   label:"Customer Name",        type:"text"},
  {key:"daysInStock",label:"Days In Stock",        type:"int"},
  {key:"price",      label:"Price",                type:"money"},
  {key:"cost",       label:"Cost",                 type:"money"},
  {key:"frontGross", label:"Front Gross",          type:"money"},
  {key:"salesperson",label:"Salesperson",          type:"text"},
  {key:"salesComm",  label:"Sales Commission",     type:"money"},
  {key:"bizMgr",     label:"Business Manager",     type:"text"},
  {key:"fiSale",     label:"F&I Sales",            type:"money"},
  {key:"fiCost",     label:"F&I Cost",             type:"money"},
  {key:"fiGross",    label:"F&I Gross",            type:"money"},
  {key:"fiComm",     label:"F&I Commission",       type:"money"},
  {key:"salesFiComm",label:"Sales F&I Commission", type:"money"},
];
let REPORT_DATA = [];
let FI_BASIS = [];
let SORT = { key:null, dir:1 };

function toNum(v){
  if(v==null||v==="") return 0;
  if(typeof v==="number") return v;
  let s=String(v).trim(), neg=false;
  if(/^\(.*\)$/.test(s)){ neg=true; s=s.slice(1,-1); }
  s=s.replace(/[$,\s]/g,"");
  if(s.endsWith("-")){ neg=true; s=s.slice(0,-1); }
  const n=parseFloat(s); if(isNaN(n)) return 0; return neg?-n:n;
}
function parseDate(v){ if(v==null||v==="") return null; if(v instanceof Date&&!isNaN(v)) return v; const d=new Date(v); return isNaN(d)?null:d; }
function fmtDate(d){ if(!d) return ""; return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function fmtMoney(n){ if(n==null||n==="") return ""; const neg=n<0; return (neg?"-$":"$")+Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }

function getMapping(){
  const val=id=>document.getElementById(id).value;
  return { account:val("mapAccount"), ref:val("mapRef"), date:val("mapDate"),
           amount:val("mapAmount"), debit:val("mapDebit"), credit:val("mapCredit") };
}
function lineAmount(row,map){
  if(map.amount) return toNum(row[map.amount]);
  let a=0; if(map.debit) a+=toNum(row[map.debit]); if(map.credit) a-=toNum(row[map.credit]); return a;
}
function buildAccountIndex(){
  const idx={}; const dc=CONFIG[CURRENT_DEALER];
  CATEGORIES.forEach(cat=>{ (dc[cat.key].accounts||[]).forEach(a=>{ const k=normAcct(a.n); if(!k) return; (idx[k]=idx[k]||[]).push(cat.key); }); });
  return idx;
}
function parseYearModel(vehicle){
  const s=String(vehicle||"").trim(); const m=s.match(/\b(19|20)\d{2}\b/);
  let year=m?m[0]:"", model=s;
  if(m){ model=(s.slice(0,m.index)+s.slice(m.index+4)).trim().replace(/^[-\s]+/,""); }
  return {year,model};
}
function customerName(rec){ if(!rec) return ""; const f=String(rec.first||"").trim(), l=String(rec.last||"").trim(); return (f&&l)?f+" "+l:(f||l||""); }
function tierRate(avg, tiers){
  const t = tiers || DEFAULT_TIERS;
  if(avg < t.t1) return t.r1;
  if(avg <= t.t2) return t.r2;
  return t.r3;
}

function generateReport(){
  const status=document.getElementById("loadStatus");
  status.className="status info show"; status.textContent="Generating…";
  if(!glRawRows){ status.className="status err show"; status.textContent="Load the GL file first."; return; }
  const map=getMapping();
  if(!map.account||!map.ref){ status.className="status err show"; status.textContent="Pick the GL Account # and Reference columns."; return; }
  if(!map.amount&&!map.debit&&!map.credit){ status.className="status err show"; status.textContent="Pick an Amount column, or a Debit/Credit pair."; return; }

  const acctIndex=buildAccountIndex();
  const haveAnyAccts=Object.keys(acctIndex).length>0;
  const dc=CONFIG[CURRENT_DEALER];

  const byStock={}; let matchedLines=0;
  glRawRows.forEach(row=>{
    const acct=normAcct(row[map.account]);
    const stockDisp=row[map.ref]==null?"":String(row[map.ref]).trim();
    const stock=normStock(stockDisp); if(!stock) return;
    const cats=acctIndex[acct]; if(!cats||!cats.length) return;
    matchedLines++;
    const amt=lineAmount(row,map);
    const d=map.date?parseDate(row[map.date]):null;
    let rec=byStock[stock]; if(!rec){ rec=byStock[stock]={stockDisp,cats:{},dates:[]}; }
    cats.forEach(ck=>rec.cats[ck]=(rec.cats[ck]||0)+amt);
    if(d) rec.dates.push(d);
  });

  const rows=[];
  Object.keys(byStock).forEach(stock=>{
    const gl=byStock[stock]; const dk=dkDeals?dkDeals[stock]:null;
    const catVal=ck=>(gl.cats[ck]||0)*dc[ck].sign;
    const price=catVal("sale"), cost=catVal("cost");
    const fiSale=catVal("fiSale"), fiCost=catVal("fiCost");
    const fiGross=fiSale-fiCost;
    const salesComm=catVal("salesComm");
    const fiCommAcct=catVal("fiComm");
    const ym=parseYearModel(dk&&dk.vehicle);
    const soldDate=dk?parseDate(dk.sold):null;
    const inservice=dk?parseDate(dk.inservice):null;
    let postDate=null; if(gl.dates.length) postDate=gl.dates.slice().sort((a,b)=>a-b)[0];
    let daysInStock="";
    if(soldDate&&inservice) daysInStock=Math.max(0,Math.round((soldDate-inservice)/86400000));
    rows.push({
      stock: gl.stockDisp||(dk?dk.stock:stock),
      soldDate, postDate,
      year:ym.year, model:ym.model||(dk?String(dk.make||""):""),
      vehType: dk?String(dk.vehType||"").trim():"",
      dealType: dk?String(dk.type||"").trim():"",
      customer:customerName(dk), daysInStock,
      price, cost, frontGross: round2(price-cost),
      salesperson: dk?String(dk.sp1||"").trim():"",
      salesComm, bizMgr: dk?String(dk.fi||"").trim():"",
      fiSale, fiCost, fiGross, fiCommAcct, fiComm:0, salesFiComm:0,
      _matched: !!dk,
    });
  });

  // ----- F&I Commission -----
  FI_BASIS = [];
  if((dc.fiComm.method||"tiered")==="tiered"){
    const groups={};
    rows.forEach(r=>{ const k=normName(r.bizMgr); if(!k) return; (groups[k]=groups[k]||{name:r.bizMgr,deals:[]}).deals.push(r); });
    Object.keys(groups).forEach(k=>{
      const g=groups[k];
      const total=g.deals.reduce((s,r)=>s+r.fiGross,0);
      const avg=g.deals.length?total/g.deals.length:0;
      const rate=tierRate(avg, dc.fiComm.tiers);
      let comm=0;
      g.deals.forEach(r=>{ r.fiComm=round2(rate/100*r.fiGross); comm+=r.fiComm; });
      FI_BASIS.push({ name:g.name, count:g.deals.length, totalFiGross:total, avg, rate, commission:comm });
    });
    FI_BASIS.sort((a,b)=>b.count-a.count);
    rows.forEach(r=>{ if(!normName(r.bizMgr)) r.fiComm=0; });
  } else {
    rows.forEach(r=>{ r.fiComm = r.fiCommAcct; });
  }
  rows.forEach(r=>{ r.salesFiComm = round2(r.salesComm + r.fiComm); });

  REPORT_DATA=rows;
  // populate the column filter dropdowns (all selected by default)
  vehTypeFilter.setValues(rows);
  dealTypeFilter.setValues(rows);
  SORT={key:"soldDate",dir:1}; sortReport();
  const missing=rows.filter(r=>!r._matched).length;
  status.className="status ok show";
  status.textContent=`✓ ${rows.length} deal(s) from GL · ${matchedLines.toLocaleString()} matching GL lines`
    + (dkDeals?(missing?` · ⚠ ${missing} not found in Deskit`:" · all matched to Deskit"):" · (no Deskit file loaded — descriptive columns blank)")
    + (haveAnyAccts?"":" · ⚠ no accounts configured for this dealership — money columns will be 0");

  renderReport();
  const rc=document.getElementById("reportCard");
  rc.classList.remove("hide"); rc.classList.remove("collapsed");
  document.getElementById("reportDealerName").textContent=CURRENT_DEALER;
  rc.scrollIntoView({behavior:"smooth"});
}

function sortReport(){
  if(!SORT.key) return;
  const col=REPORT_COLS.find(c=>c.key===SORT.key);
  REPORT_DATA.sort((a,b)=>{
    let av=a[SORT.key], bv=b[SORT.key];
    if(col.type==="date"){ av=av?av.getTime():-Infinity; bv=bv?bv.getTime():-Infinity; }
    else if(col.type==="money"||col.type==="int"){ av=av===""?-Infinity:+av; bv=bv===""?-Infinity:+bv; }
    else { av=String(av||"").toLowerCase(); bv=String(bv||"").toLowerCase(); }
    if(av<bv) return -SORT.dir; if(av>bv) return SORT.dir; return 0;
  });
}

function rowVisible(r){
  if(document.getElementById("onlyMatched").checked && !r._matched) return false;
  if(!vehTypeFilter.pass(r)) return false;
  if(!dealTypeFilter.pass(r)) return false;
  const filter=document.getElementById("reportFilter").value.trim().toLowerCase();
  if(filter){
    const hay=[r.stock,r.customer,r.salesperson,r.bizMgr,r.model,r.year,r.vehType,r.dealType].join(" ").toLowerCase();
    if(!hay.includes(filter)) return false;
  }
  return true;
}

function renderReport(){
  const table=document.getElementById("reportTable");
  const thead=table.querySelector("thead"), tbody=table.querySelector("tbody"), tfoot=table.querySelector("tfoot");

  thead.innerHTML="";
  const htr=document.createElement("tr");
  REPORT_COLS.forEach(c=>{
    const th=document.createElement("th");
    if(c.type==="money"||c.type==="int") th.className="num";
    th.textContent=c.label;
    if(SORT.key===c.key){ const a=document.createElement("span"); a.className="arrow"; a.textContent=SORT.dir>0?"▲":"▼"; th.appendChild(a); }
    th.onclick=()=>{ if(SORT.key===c.key) SORT.dir*=-1; else {SORT.key=c.key;SORT.dir=1;} sortReport(); renderReport(); };
    htr.appendChild(th);
  });
  thead.appendChild(htr);

  tbody.innerHTML="";
  const totals={}; let shown=0; const vis=[];
  REPORT_DATA.forEach(r=>{
    if(!rowVisible(r)) return;
    shown++; vis.push(r);
    const tr=document.createElement("tr"); if(!r._matched) tr.className="missing";
    REPORT_COLS.forEach(c=>{
      const td=document.createElement("td"); let v=r[c.key];
      if(c.type==="date"){ td.textContent=fmtDate(v); }
      else if(c.type==="money"){ td.className="num"; td.textContent=fmtMoney(v); if(v<0) td.classList.add("neg"); totals[c.key]=(totals[c.key]||0)+(+v||0); }
      else if(c.type==="int"){ td.className="num"; td.textContent=(v===""?"":v); if(v!=="") totals[c.key]=(totals[c.key]||0)+(+v||0); }
      else { td.textContent=v==null?"":v; if(c.key==="stock"&&!r._matched){ const p=document.createElement("span"); p.className="pill"; p.style.marginLeft="6px"; p.textContent="not in Deskit"; td.appendChild(p);} }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  tfoot.innerHTML="";
  const ftr=document.createElement("tr");
  REPORT_COLS.forEach((c,i)=>{
    const td=document.createElement("td");
    if(i===0){ td.textContent="TOTALS ("+shown+" deals)"; }
    else if(c.type==="money"){ td.className="num"; td.textContent=fmtMoney(totals[c.key]||0); }
    else if(c.type==="int"){ td.className="num"; td.textContent=totals[c.key]!=null?Math.round(totals[c.key]):""; }
    ftr.appendChild(td);
  });
  tfoot.appendChild(ftr);

  const totFront=(totals.price||0)-(totals.cost||0);
  const cards=[
    {lab:"Deals", val:shown},
    {lab:"Total Price", val:fmtMoney(totals.price||0)},
    {lab:"Front Gross", val:fmtMoney(totFront)},
    {lab:"F&I Gross", val:fmtMoney(totals.fiGross||0)},
    {lab:"Total Commission", val:fmtMoney(totals.salesFiComm||0)},
  ];
  document.getElementById("summaryCards").innerHTML=cards.map(c=>`<div class="scard"><div class="lab">${c.lab}</div><div class="val">${c.val}</div></div>`).join("");

  const dc=CONFIG[CURRENT_DEALER];
  const counts=CATEGORIES.map(cat=>`${cat.name}: ${cat.key==="fiComm"&&dc.fiComm.method==="tiered"?"tiered":nonEmptyAccts(dc[cat.key]).length}`).join(" · ");
  document.getElementById("reportLegend").innerHTML=
    `Money columns computed from <b>${CURRENT_DEALER}</b> account lists (${counts}). `+
    `Highlighted rows are deals present in the GL but not found in Deskit. `+
    `F&amp;I Gross = F&amp;I Sale − F&amp;I Cost. Sales F&amp;I Commission = Sales Commission + F&amp;I Commission.`;

  renderFiBasis();
  renderDashboard(vis);
  const dcard=document.getElementById("dashboardCard");
  dcard.classList.remove("hide");
  document.getElementById("dashDealerName").textContent=CURRENT_DEALER;
}

/* ============================================================ METRICS + DASHBOARD */
function summarize(rows){
  const t={count:rows.length,price:0,cost:0,front:0,fiSale:0,fiCost:0,fi:0,salesComm:0,fiComm:0,
           newCount:0,usedCount:0,cpoCount:0};
  rows.forEach(r=>{
    t.price+=r.price; t.cost+=r.cost; t.front+=r.frontGross;
    t.fiSale+=r.fiSale; t.fiCost+=r.fiCost; t.fi+=r.fiGross;
    t.salesComm+=r.salesComm; t.fiComm+=r.fiComm;
    const v=String(r.vehType||"").toUpperCase();
    if(v==="NEW") t.newCount++; else if(v==="USED") t.usedCount++; else if(v==="CPO") t.cpoCount++;
  });
  t.total=t.front+t.fi; t.totalComm=t.salesComm+t.fiComm;
  t.avgFront=t.count?t.front/t.count:0; t.avgFi=t.count?t.fi/t.count:0; t.avgTotal=t.count?t.total/t.count:0;
  return t;
}
function groupSummary(rows, keyFn, blankLabel){
  const m=new Map();
  rows.forEach(r=>{
    let k=keyFn(r); if(k===""||k==null) k=blankLabel||"(none)";
    let g=m.get(k);
    if(!g){ g={name:k,count:0,front:0,fi:0,total:0,price:0,cost:0,salesComm:0,fiComm:0}; m.set(k,g); }
    g.count++; g.front+=r.frontGross; g.fi+=r.fiGross; g.total+=r.frontGross+r.fiGross;
    g.price+=r.price; g.cost+=r.cost; g.salesComm+=r.salesComm; g.fiComm+=r.fiComm;
  });
  const arr=[...m.values()];
  arr.forEach(g=>{ g.avgFront=g.count?g.front/g.count:0; g.avgFi=g.count?g.fi/g.count:0; g.avgTotal=g.count?g.total/g.count:0; });
  arr.sort((a,b)=>b.total-a.total);
  return arr;
}

const DASH_TABLES = [
  {title:"By Salesperson",       key:"salesperson", blank:"(no salesperson)"},
  {title:"By Business Manager",  key:"bizMgr",      blank:"(no manager)"},
  {title:"By Vehicle Type",      key:"vehType",     blank:"(blank)"},
  {title:"By Deal Type",         key:"dealType",    blank:"(blank)"},
];

function renderDashboard(rows){
  const t=summarize(rows);
  const note=document.getElementById("dashScopeNote");
  note.innerHTML = `Reflects the <b>${rows.length}</b> deal(s) currently shown (Veh Type / Deal Type / search / Deskit filters all apply). `+
                   `Adjust the filters above to slice by new/used, manager, etc.`;

  const cards=[
    {lab:"Deals", val:t.count.toLocaleString(), sub:`New ${t.newCount} · Used ${t.usedCount} · CPO ${t.cpoCount}`, accent:true},
    {lab:"Total Gross", val:fmtMoney(t.total), sub:`${fmtMoney(t.avgTotal)} / deal (PVR)`, accent:true},
    {lab:"Front Gross", val:fmtMoney(t.front), sub:`${fmtMoney(t.avgFront)} / deal`},
    {lab:"F&I Gross", val:fmtMoney(t.fi), sub:`${fmtMoney(t.avgFi)} / deal`},
    {lab:"Total Sales", val:fmtMoney(t.price), sub:`Cost ${fmtMoney(t.cost)}`},
    {lab:"Sales Commission", val:fmtMoney(t.salesComm)},
    {lab:"F&I Commission", val:fmtMoney(t.fiComm), sub:`Total comp ${fmtMoney(t.totalComm)}`},
  ];
  document.getElementById("dashCards").innerHTML = cards.map(c=>
    `<div class="scard${c.accent?" accent":""}"><div class="lab">${c.lab}</div>`+
    `<div class="val">${c.val}</div>${c.sub?`<div class="sub">${c.sub}</div>`:""}</div>`).join("");

  const wrap=document.getElementById("dashTables");
  wrap.innerHTML = DASH_TABLES.map(def=>{
    const groups=groupSummary(rows, r=>r[def.key], def.blank);
    const tot=groups.reduce((a,g)=>({count:a.count+g.count,front:a.front+g.front,fi:a.fi+g.fi,total:a.total+g.total}),{count:0,front:0,fi:0,total:0});
    const body=groups.map(g=>`<tr><td>${escapeHtml(g.name)}</td><td>${g.count}</td>`+
      `<td>${fmtMoney(g.front)}</td><td>${fmtMoney(g.avgFront)}</td>`+
      `<td>${fmtMoney(g.fi)}</td><td>${fmtMoney(g.avgFi)}</td>`+
      `<td>${fmtMoney(g.total)}</td><td>${fmtMoney(g.avgTotal)}</td></tr>`).join("");
    const avgTot=tot.count?tot.total/tot.count:0;
    return `<div class="dash-table"><h3>${def.title}</h3><div class="twrap"><table class="grp">`+
      `<thead><tr><th>${def.title.replace(/^By /,"")}</th><th>Deals</th><th>Front</th><th>Avg Front</th>`+
      `<th>F&I</th><th>Avg F&I</th><th>Total</th><th>Avg Total</th></tr></thead>`+
      `<tbody>${body}</tbody>`+
      `<tfoot><tr><td>Total</td><td>${tot.count}</td><td>${fmtMoney(tot.front)}</td><td></td>`+
      `<td>${fmtMoney(tot.fi)}</td><td></td><td>${fmtMoney(tot.total)}</td><td>${fmtMoney(avgTot)}</td></tr></tfoot>`+
      `</table></div></div>`;
  }).join("");
}
function escapeHtml(s){ return String(s==null?"":s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }

function renderFiBasis(){
  const el=document.getElementById("fiBasis");
  const dc=CONFIG[CURRENT_DEALER];
  if((dc.fiComm.method||"tiered")!=="tiered" || !FI_BASIS.length){ el.innerHTML=""; return; }
  const t=dc.fiComm.tiers;
  let rows=FI_BASIS.map(b=>`<tr><td>${b.name}</td><td class="num">${b.count}</td>`+
    `<td class="num">${fmtMoney(b.totalFiGross)}</td><td class="num">${fmtMoney(b.avg)}</td>`+
    `<td class="num">${b.rate}%</td><td class="num">${fmtMoney(b.commission)}</td></tr>`).join("");
  const totComm=FI_BASIS.reduce((s,b)=>s+b.commission,0);
  el.innerHTML=`<details class="fibasis" open><summary>F&I Commission basis — per business manager `+
    `(rates: &lt;$${t.t1}=${t.r1}%, $${t.t1}–$${t.t2}=${t.r2}%, &gt;$${t.t2}=${t.r3}%)</summary>`+
    `<table class="basis"><thead><tr><th>Business Manager</th><th class="num">Deals</th>`+
    `<th class="num">Total F&I Gross</th><th class="num">Avg / Deal</th><th class="num">Rate</th><th class="num">F&I Commission</th></tr></thead>`+
    `<tbody>${rows}</tbody><tfoot><tr><th>Total</th><th class="num"></th><th class="num"></th><th class="num"></th><th class="num"></th><th class="num">${fmtMoney(totComm)}</th></tr></tfoot></table></details>`;
}

document.getElementById("genBtn").onclick=generateReport;
document.getElementById("reportFilter").addEventListener("input",renderReport);
document.getElementById("onlyMatched").addEventListener("change",renderReport);
document.getElementById("printBtn").onclick=()=>window.print();

/* ----- reusable column filter (checkbox dropdown) ----- */
function makeColumnFilter(opts){
  const btn=document.getElementById(opts.btnId);
  const menu=document.getElementById(opts.menuId);
  let values=[]; let sel=new Set();
  const label=v=> v===""? "(blank)" : v;
  function updateBtn(){
    const total=values.length, s=sel.size;
    const txt = total===0 ? opts.title : (s===total ? opts.title+": All" : `${opts.title}: ${s} of ${total}`);
    btn.innerHTML = txt + " &#9662;";
  }
  function build(){
    menu.innerHTML="";
    const ctrl=document.createElement("div"); ctrl.className="dt-controls";
    const all=document.createElement("button"); all.className="tiny"; all.textContent="Select all";
    all.onclick=(e)=>{ e.stopPropagation(); sel=new Set(values); build(); updateBtn(); renderReport(); };
    const clr=document.createElement("button"); clr.className="tiny"; clr.textContent="Clear";
    clr.onclick=(e)=>{ e.stopPropagation(); sel=new Set(); build(); updateBtn(); renderReport(); };
    ctrl.appendChild(all); ctrl.appendChild(clr); menu.appendChild(ctrl);
    if(!values.length){
      const e=document.createElement("div"); e.className="menu-section"; e.textContent="Generate a report first"; menu.appendChild(e); return;
    }
    values.forEach(v=>{
      const lab=document.createElement("label"); lab.className="menu-check";
      const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=sel.has(v);
      cb.onchange=()=>{ if(cb.checked) sel.add(v); else sel.delete(v); updateBtn(); renderReport(); };
      const span=document.createElement("span"); span.textContent=label(v);
      lab.appendChild(cb); lab.appendChild(span); menu.appendChild(lab);
    });
  }
  btn.onclick=(e)=>{ e.stopPropagation(); menu.classList.toggle("hide"); };
  document.addEventListener("click",(e)=>{ if(!menu.classList.contains("hide") && !menu.contains(e.target) && e.target!==btn) menu.classList.add("hide"); });
  return {
    setValues(rows){
      values = Array.from(new Set(rows.map(r=>r[opts.key]||""))).sort((a,b)=>{
        if(a===b) return 0; if(a==="") return 1; if(b==="") return -1;
        return a.toLowerCase()<b.toLowerCase()?-1:1;
      });
      sel = new Set(values); build(); updateBtn();
    },
    pass(r){ return !values.length || sel.has(r[opts.key]||""); },
    init(){ build(); updateBtn(); },
  };
}
const vehTypeFilter  = makeColumnFilter({btnId:"vehTypeBtn",  menuId:"vehTypeMenu",  key:"vehType",  title:"Veh Type"});
const dealTypeFilter = makeColumnFilter({btnId:"dealTypeBtn", menuId:"dealTypeMenu", key:"dealType", title:"Deal Type"});

/* ----- Export (All / In-Deskit-only, as Excel or CSV) ----- */
function exportRowsForScope(scope){
  return REPORT_DATA.filter(r => scope==="shown" ? rowVisible(r) : true);
}
function exportFileBase(scope){
  const tag = scope==="shown" ? "Shown" : "All";
  return `Vehicle_Sales_Report_${CURRENT_DEALER}_${tag}_${fmtDate(new Date())}`;
}
function exportCSV(scope){
  const esc=v=>{ const s=String(v==null?"":v); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
  const lines=[REPORT_COLS.map(c=>esc(c.label)).join(",")];
  exportRowsForScope(scope).forEach(r=>{ lines.push(REPORT_COLS.map(c=>{ let v=r[c.key];
    if(c.type==="date") v=fmtDate(v); else if(c.type==="money") v=(v==null||v===""?"":(+v).toFixed(2)); return esc(v); }).join(",")); });
  const blob=new Blob(["﻿"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=exportFileBase(scope)+".csv"; a.click();
}
/* styled .xlsx via ExcelJS — a Summary sheet of metrics + a formatted Deals sheet */
const XL = { navy:"FF1E3A8A", blue:"FF1D4ED8", soft:"FFF1F5F9", band:"FFF8FAFC",
             white:"FFFFFFFF", total:"FFEEF2FF", grey:"FF94A3B8" };
function xlBorderAll(){ const s={style:"thin",color:{argb:XL.soft}}; return {top:s,left:s,bottom:s,right:s}; }
function numFmtFor(type){ return type==="money"?"#,##0.00":type==="int"?"#,##0":type==="date"?"yyyy-mm-dd":null; }

async function exportXLSX(scope){
  const rows=exportRowsForScope(scope);
  const wb=new ExcelJS.Workbook();
  wb.creator="Vehicle Sales Report"; wb.created=new Date();
  buildSummarySheet(wb, rows, scope);
  buildDetailSheet(wb, rows);
  const buf=await wb.xlsx.writeBuffer();
  const blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=exportFileBase(scope)+".xlsx"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}

function buildDetailSheet(wb, rows){
  const ws=wb.addWorksheet("Deals",{views:[{state:"frozen",ySplit:1}]});
  ws.columns=REPORT_COLS.map(c=>({header:c.label,key:c.key,
    width: c.type==="money"?14 : c.type==="date"?12 : c.type==="int"?12
         : (c.key==="customer"||c.key==="model")?24 : (c.key==="salesperson"||c.key==="bizMgr")?18
         : Math.max(11,c.label.length+2)}));
  rows.forEach(r=>{
    const o={};
    REPORT_COLS.forEach(c=>{ let v=r[c.key];
      if(c.type==="date") o[c.key]=(v instanceof Date)?v:null;
      else if(c.type==="money") o[c.key]=(v==null||v==="")?null:round2(+v);
      else if(c.type==="int") o[c.key]=(v===""||v==null)?null:+v;
      else o[c.key]= v==null?"":String(v);
    });
    ws.addRow(o);
  });
  const hr=ws.getRow(1); hr.height=22;
  hr.eachCell(c=>{ c.font={bold:true,color:{argb:XL.white}};
    c.fill={type:"pattern",pattern:"solid",fgColor:{argb:XL.navy}};
    c.alignment={vertical:"middle",horizontal:"left"}; c.border=xlBorderAll(); });
  REPORT_COLS.forEach((c,i)=>{ const f=numFmtFor(c.type); if(f) ws.getColumn(i+1).numFmt=f; });
  for(let ri=2; ri<=rows.length+1; ri++){
    const row=ws.getRow(ri);
    const band = (ri%2===1);
    row.eachCell(c=>{ c.border=xlBorderAll(); if(band) c.fill={type:"pattern",pattern:"solid",fgColor:{argb:XL.band}}; });
  }
  // totals row (money columns only)
  const totals={}; rows.forEach(r=>REPORT_COLS.forEach(c=>{ if(c.type==="money") totals[c.key]=(totals[c.key]||0)+(+r[c.key]||0); }));
  const tvals=REPORT_COLS.map((c,i)=> i===0?`TOTALS (${rows.length} deals)` : (c.type==="money"?round2(totals[c.key]||0):null));
  const tr=ws.addRow(tvals);
  tr.eachCell((c,i)=>{ c.font={bold:true}; c.fill={type:"pattern",pattern:"solid",fgColor:{argb:XL.total}};
    c.border={top:{style:"medium",color:{argb:XL.blue}}};
    if(REPORT_COLS[i-1] && REPORT_COLS[i-1].type==="money") c.numFmt="#,##0.00"; });
  ws.autoFilter={from:{row:1,column:1},to:{row:1,column:REPORT_COLS.length}};
}

function buildSummarySheet(wb, rows, scope){
  const ws=wb.addWorksheet("Summary",{views:[{showGridLines:false}]});
  const NCOL=8;
  ws.columns=[{width:28},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14},{width:14}];
  let row=1;
  ws.mergeCells(row,1,row,NCOL); let c=ws.getCell(row,1);
  c.value="Vehicle Sales Report"; c.font={bold:true,size:20,color:{argb:XL.white}};
  c.alignment={vertical:"middle",horizontal:"left",indent:1};
  c.fill={type:"pattern",pattern:"solid",fgColor:{argb:XL.navy}}; ws.getRow(row).height=34; row++;
  ws.mergeCells(row,1,row,NCOL); c=ws.getCell(row,1);
  const scopeTxt = scope==="shown" ? "Filtered view (deals shown)" : "All deals";
  c.value=`${CURRENT_DEALER}    •    ${scopeTxt}    •    ${rows.length} deals    •    generated ${fmtDate(new Date())}`;
  c.font={color:{argb:XL.white}}; c.alignment={horizontal:"left",indent:1};
  c.fill={type:"pattern",pattern:"solid",fgColor:{argb:XL.blue}}; ws.getRow(row).height=20; row+=2;

  const t=summarize(rows);
  row=addKpiBlock(ws,row,t); row++;
  DASH_TABLES.forEach(def=>{
    const groups=groupSummary(rows, r=>r[def.key], def.blank);
    row=addGroupTable(ws,row,def.title,def.title.replace(/^By /,""),groups); row++;
  });
  ws.mergeCells(row,1,row,NCOL); c=ws.getCell(row,1);
  c.value="Generated by the Vehicle Sales Report tool."; c.font={italic:true,size:10,color:{argb:XL.grey}};
}

function addKpiBlock(ws,row,t){
  ws.mergeCells(row,1,row,2); let h=ws.getCell(row,1); h.value="Key Metrics";
  h.font={bold:true,size:12,color:{argb:XL.white}}; h.fill={type:"pattern",pattern:"solid",fgColor:{argb:XL.blue}};
  h.alignment={indent:1}; ws.getRow(row).height=18; row++;
  const kpis=[
    ["Deals", t.count, "int"],
    ["New / Used / CPO", `${t.newCount} / ${t.usedCount} / ${t.cpoCount}`, "text"],
    ["Total Sales", t.price, "money"],
    ["Total Cost", t.cost, "money"],
    ["Front Gross", t.front, "money"],
    ["F&I Gross", t.fi, "money"],
    ["Total Gross", t.total, "money"],
    ["Avg Front / Deal", t.avgFront, "money"],
    ["Avg F&I / Deal", t.avgFi, "money"],
    ["Avg Total Gross / Deal (PVR)", t.avgTotal, "money"],
    ["Sales Commission", t.salesComm, "money"],
    ["F&I Commission", t.fiComm, "money"],
    ["Total Commission", t.totalComm, "money"],
  ];
  kpis.forEach((k,idx)=>{
    const lc=ws.getCell(row,1), vc=ws.getCell(row,2);
    lc.value=k[0]; vc.value=k[1];
    if(k[2]==="money") vc.numFmt="#,##0.00"; else if(k[2]==="int") vc.numFmt="#,##0";
    vc.alignment={horizontal:"right"};
    lc.border=xlBorderAll(); vc.border=xlBorderAll();
    if(idx%2===0){ const fill={type:"pattern",pattern:"solid",fgColor:{argb:XL.band}}; lc.fill=fill; vc.fill=fill; }
    row++;
  });
  return row;
}

function addGroupTable(ws,row,title,firstCol,groups){
  ws.mergeCells(row,1,row,8); let tc=ws.getCell(row,1); tc.value=title;
  tc.font={bold:true,size:12}; tc.fill={type:"pattern",pattern:"solid",fgColor:{argb:XL.soft}};
  tc.alignment={indent:1}; ws.getRow(row).height=18; row++;
  const headers=[firstCol,"Deals","Front Gross","Avg Front","F&I Gross","Avg F&I","Total Gross","Avg Total"];
  headers.forEach((hh,i)=>{ const cell=ws.getCell(row,i+1); cell.value=hh;
    cell.font={bold:true,color:{argb:XL.white}}; cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:XL.navy}};
    cell.border=xlBorderAll(); cell.alignment={horizontal:i===0?"left":"right"}; });
  row++;
  groups.forEach((g,idx)=>{
    const vals=[g.name,g.count,round2(g.front),round2(g.avgFront),round2(g.fi),round2(g.avgFi),round2(g.total),round2(g.avgTotal)];
    vals.forEach((v,i)=>{ const cell=ws.getCell(row,i+1); cell.value=v; cell.border=xlBorderAll();
      if(i>=2) cell.numFmt="#,##0.00"; else if(i===1) cell.numFmt="#,##0";
      cell.alignment={horizontal:i===0?"left":"right"};
      if(idx%2===0) cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:XL.band}};
    });
    row++;
  });
  const tot=groups.reduce((a,g)=>({count:a.count+g.count,front:a.front+g.front,fi:a.fi+g.fi,total:a.total+g.total}),{count:0,front:0,fi:0,total:0});
  const avgTot=tot.count?tot.total/tot.count:0;
  const tvals=["Total",tot.count,round2(tot.front),null,round2(tot.fi),null,round2(tot.total),round2(avgTot)];
  tvals.forEach((v,i)=>{ const cell=ws.getCell(row,i+1); cell.value=v; cell.font={bold:true};
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:XL.total}};
    cell.border={top:{style:"thin",color:{argb:XL.blue}}};
    if(i>=2&&v!=null) cell.numFmt="#,##0.00"; else if(i===1) cell.numFmt="#,##0";
    cell.alignment={horizontal:i===0?"left":"right"};
  });
  row++;
  return row;
}

async function doExport(scope,fmt){
  if(!REPORT_DATA.length){ alert("Generate a report first."); return; }
  try{ if(fmt==="csv") exportCSV(scope); else await exportXLSX(scope); }
  catch(err){ alert("Export failed: "+(err&&err.message||err)); }
}
const exportBtn=document.getElementById("exportBtn");
const exportMenu=document.getElementById("exportMenu");
exportBtn.onclick=(e)=>{ e.stopPropagation(); exportMenu.classList.toggle("hide"); };
exportMenu.querySelectorAll(".menu-item").forEach(b=>{
  b.onclick=()=>{ exportMenu.classList.add("hide"); doExport(b.dataset.scope, b.dataset.fmt); };
});
document.addEventListener("click",(e)=>{ if(!exportMenu.classList.contains("hide") && !exportMenu.contains(e.target) && e.target!==exportBtn) exportMenu.classList.add("hide"); });

/* init */
refreshSettingsUI(); maybeEnableGenerate(); vehTypeFilter.init(); dealTypeFilter.init();
