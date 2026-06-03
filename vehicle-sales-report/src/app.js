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
let DEAL_TYPES = [];
let DEAL_TYPE_SEL = new Set();
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
  // distinct deal types for the filter dropdown (all selected by default)
  DEAL_TYPES = Array.from(new Set(rows.map(r=>r.dealType||""))).sort((a,b)=>{
    if(a===b) return 0; if(a==="") return 1; if(b==="") return -1;
    return a.toLowerCase()<b.toLowerCase()?-1:1;
  });
  DEAL_TYPE_SEL = new Set(DEAL_TYPES);
  buildDealTypeMenu(); updateDealTypeBtn();
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

function renderReport(){
  const table=document.getElementById("reportTable");
  const thead=table.querySelector("thead"), tbody=table.querySelector("tbody"), tfoot=table.querySelector("tfoot");
  const filter=document.getElementById("reportFilter").value.trim().toLowerCase();
  const onlyMatched=document.getElementById("onlyMatched").checked;

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
  const totals={}; let shown=0;
  REPORT_DATA.forEach(r=>{
    if(onlyMatched && !r._matched) return;
    if(DEAL_TYPES.length && !DEAL_TYPE_SEL.has(r.dealType||"")) return;
    if(filter){
      const hay=[r.stock,r.customer,r.salesperson,r.bizMgr,r.model,r.year].join(" ").toLowerCase();
      if(!hay.includes(filter)) return;
    }
    shown++;
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
}

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

/* ----- Deal Type filter (checkbox dropdown) ----- */
const dealTypeBtn=document.getElementById("dealTypeBtn");
const dealTypeMenu=document.getElementById("dealTypeMenu");
function dtLabel(t){ return t===""? "(blank)" : t; }
function updateDealTypeBtn(){
  const total=DEAL_TYPES.length, sel=DEAL_TYPE_SEL.size;
  let txt = total===0 ? "Deal Type" : (sel===total ? "Deal Type: All" : `Deal Type: ${sel} of ${total}`);
  dealTypeBtn.innerHTML = txt + " &#9662;";
}
function buildDealTypeMenu(){
  dealTypeMenu.innerHTML="";
  const ctrl=document.createElement("div"); ctrl.className="dt-controls";
  const all=document.createElement("button"); all.className="tiny"; all.textContent="Select all";
  all.onclick=(e)=>{ e.stopPropagation(); DEAL_TYPE_SEL=new Set(DEAL_TYPES); buildDealTypeMenu(); updateDealTypeBtn(); renderReport(); };
  const clr=document.createElement("button"); clr.className="tiny"; clr.textContent="Clear";
  clr.onclick=(e)=>{ e.stopPropagation(); DEAL_TYPE_SEL=new Set(); buildDealTypeMenu(); updateDealTypeBtn(); renderReport(); };
  ctrl.appendChild(all); ctrl.appendChild(clr); dealTypeMenu.appendChild(ctrl);
  if(!DEAL_TYPES.length){
    const e=document.createElement("div"); e.className="menu-section"; e.textContent="Generate a report first"; dealTypeMenu.appendChild(e); return;
  }
  DEAL_TYPES.forEach(t=>{
    const lab=document.createElement("label"); lab.className="menu-check";
    const cb=document.createElement("input"); cb.type="checkbox"; cb.checked=DEAL_TYPE_SEL.has(t);
    cb.onchange=()=>{ if(cb.checked) DEAL_TYPE_SEL.add(t); else DEAL_TYPE_SEL.delete(t); updateDealTypeBtn(); renderReport(); };
    const span=document.createElement("span"); span.textContent=dtLabel(t);
    lab.appendChild(cb); lab.appendChild(span); dealTypeMenu.appendChild(lab);
  });
}
dealTypeBtn.onclick=(e)=>{ e.stopPropagation(); dealTypeMenu.classList.toggle("hide"); };
document.addEventListener("click",(e)=>{ if(!dealTypeMenu.classList.contains("hide") && !dealTypeMenu.contains(e.target) && e.target!==dealTypeBtn) dealTypeMenu.classList.add("hide"); });

/* ----- Export (All / In-Deskit-only, as Excel or CSV) ----- */
function exportRowsForScope(scope){
  return REPORT_DATA.filter(r => scope==="matched" ? r._matched : true);
}
function exportFileBase(scope){
  const tag = scope==="matched" ? "InDeskit" : "All";
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
function exportXLSX(scope){
  const aoa=[REPORT_COLS.map(c=>c.label)];
  exportRowsForScope(scope).forEach(r=>{
    aoa.push(REPORT_COLS.map(c=>{
      let v=r[c.key];
      if(c.type==="date") return (v instanceof Date)? v : "";
      if(c.type==="money") return (v==null||v==="")? "" : round2(+v);
      if(c.type==="int") return (v===""||v==null)? "" : +v;
      return v==null? "" : String(v);
    }));
  });
  const ws=XLSX.utils.aoa_to_sheet(aoa,{cellDates:true});
  // column widths + number/date formats
  ws["!cols"]=REPORT_COLS.map(c=>({wch: c.type==="money"?14 : c.type==="date"?12 : Math.max(10,c.label.length+2)}));
  const last=aoa.length-1;
  REPORT_COLS.forEach((c,ci)=>{
    if(c.type!=="money"&&c.type!=="date") return;
    for(let ri=1;ri<=last;ri++){
      const addr=XLSX.utils.encode_cell({r:ri,c:ci}); const cell=ws[addr];
      if(!cell||cell.v===""||cell.v==null) continue;
      cell.z = c.type==="money" ? "#,##0.00" : "yyyy-mm-dd";
    }
  });
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,CURRENT_DEALER.slice(0,28)||"Report");
  XLSX.writeFile(wb, exportFileBase(scope)+".xlsx");
}
function doExport(scope,fmt){
  if(!REPORT_DATA.length){ alert("Generate a report first."); return; }
  if(fmt==="csv") exportCSV(scope); else exportXLSX(scope);
}
const exportBtn=document.getElementById("exportBtn");
const exportMenu=document.getElementById("exportMenu");
exportBtn.onclick=(e)=>{ e.stopPropagation(); exportMenu.classList.toggle("hide"); };
exportMenu.querySelectorAll(".menu-item").forEach(b=>{
  b.onclick=()=>{ exportMenu.classList.add("hide"); doExport(b.dataset.scope, b.dataset.fmt); };
});
document.addEventListener("click",(e)=>{ if(!exportMenu.classList.contains("hide") && !exportMenu.contains(e.target) && e.target!==exportBtn) exportMenu.classList.add("hide"); });

/* init */
refreshSettingsUI(); maybeEnableGenerate(); buildDealTypeMenu(); updateDealTypeBtn();
