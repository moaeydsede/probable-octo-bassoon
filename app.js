/* =======================
   نظام محاسبة (Static) v2
   - LocalStorage
   - Roles: admin / user
   - بدون ضرائب
   - مخزون + مستودعات + حركة مادة + جرد + دفتر أستاذ + قيود يومية + مراكز كلفة
======================= */

const APP_KEY = "erp_alameen9_lite_v2";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const fmt = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0,10);

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>t.classList.add("hidden"), 2400);
}
function safeParse(x, fallback){ try{ return JSON.parse(x);}catch{ return fallback; } }

function loadState(){
  const raw = localStorage.getItem(APP_KEY);
  return safeParse(raw, null);
}
function saveState(st){
  st.meta = st.meta || {};
  st.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(APP_KEY, JSON.stringify(st));
}

function seedIfEmpty(){
  let st = loadState();
  if(st) return st;

  st = {
    meta: { version: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    company: { name: "شركة تجريبية", phone: "", address: "", note: "شكراً لتعاملكم معنا" },
    users: [{ username:"admin", password:"admin123", role:"admin" }],

    accounts: [
      { id:"1100", name:"الصندوق", type:"أصل", opening:0 },
      { id:"1200", name:"البنك", type:"أصل", opening:0 },
      { id:"1300", name:"المخزون", type:"أصل", opening:0 },
      { id:"2100", name:"الموردون", type:"التزام", opening:0 },
      { id:"2200", name:"العملاء", type:"أصل", opening:0 },
      { id:"4100", name:"المبيعات", type:"إيراد", opening:0 },
      { id:"5200", name:"تكلفة بضاعة مباعة", type:"مصروف", opening:0 },
      { id:"4190", name:"خصم ممنوح", type:"مصروف", opening:0 },
      { id:"5190", name:"خصم مكتسب", type:"إيراد", opening:0 },
    ],

    costCenters: [
      { code:"CC-001", name:"الإدارة" },
      { code:"CC-002", name:"المبيعات" }
    ],

    items: [
      { code:"ITM-001", name:"مادة 1", unit:"قطعة", salePrice:100, purchasePrice:70 },
      { code:"ITM-002", name:"مادة 2", unit:"علبة", salePrice:250, purchasePrice:190 },
    ],

    warehouses: [
      { code:"WH-001", name:"المستودع الرئيسي" }
    ],

    sales: [],
    purchases: [],
    vouchers: [],
    journals: [],
    moves: [],

    session: { user: null }
  };

  saveState(st);
  return st;
}

let state = seedIfEmpty();

/* ============ Auth ============ */
function currentUser(){ return state.session?.user || null; }
function setSession(user){
  state.session.user = user ? { username:user.username, role:user.role } : null;
  saveState(state);
}
function login(username, password){
  username = (username||"").trim();
  const u = state.users.find(x=>x.username===username && x.password===password);
  if(!u) return false;
  setSession(u);
  return true;
}
function logout(){
  setSession(null);
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
  $("#loginPassword").value = "";
  $("#loginUsername").value = "";
  toast("تم تسجيل الخروج");
}

/* ============ Nav ============ */
const NAV = [
  // رئيسية
  { id:"dashboard", title:"الرئيسية", view:"view_dashboard", roles:["admin","user"], section:"الرئيسية" },

  // ملفات / إعدادات
  { id:"company", title:"بيانات الشركة", view:"view_company", roles:["admin"], section:"ملفات" },
  { id:"accounts", title:"دليل الحسابات", view:"view_accounts", roles:["admin"], section:"ملفات" },
  { id:"items", title:"دليل المواد", view:"view_items", roles:["admin"], section:"ملفات" },
  { id:"wh", title:"المستودعات", view:"view_wh", roles:["admin"], section:"المستودعات" },

  // حركات
  { id:"sales", title:"فواتير المبيعات", view:"view_sales", roles:["admin","user"], badgeKey:"sales", section:"المبيعات" },
  { id:"purchases", title:"فواتير المشتريات", view:"view_purchases", roles:["admin","user"], badgeKey:"purchases", section:"المشتريات" },
  { id:"vouchers", title:"السندات", view:"view_vouchers", roles:["admin","user"], badgeKey:"vouchers", section:"السندات" },

  // مخزون وتقارير
  { id:"moves", title:"حركة مادة", view:"view_moves", roles:["admin"], section:"المستودعات" },
  { id:"stocktake", title:"جرد مواد", view:"view_stocktake", roles:["admin"], section:"المستودعات" },

  // حسابات وتقارير
  { id:"cc", title:"مراكز الكلفة", view:"view_cc", roles:["admin"], section:"الحسابات" },
  { id:"journal", title:"قيود يومية", view:"view_journal", roles:["admin"], section:"الحسابات" },
  { id:"gl", title:"دفتر الأستاذ", view:"view_gl", roles:["admin"], section:"التقارير" },
  { id:"statement", title:"كشف حساب", view:"view_statement", roles:["admin"], section:"التقارير" },

  // صلاحيات
  { id:"users", title:"المستخدمون", view:"view_users", roles:["admin"], section:"الصلاحيات" },
];

function allowedNav(){
  const role = currentUser()?.role;
  return NAV.filter(n => n.roles.includes(role));
}
function updateBadges(){
  const bSales = $("#badge_sales");
  const bPurch = $("#badge_purchases");
  const bV = $("#badge_vouchers");
  if(bSales) bSales.textContent = String(state.sales.length);
  if(bPurch) bPurch.textContent = String(state.purchases.length);
  if(bV) bV.textContent = String(state.vouchers.length);
}
function renderNav(){
  const nav = $("#nav");
  nav.innerHTML = "";
  const items = allowedNav();

  // group by section
  const order = ["الرئيسية","المبيعات","المشتريات","السندات","المستودعات","الحسابات","التقارير","الصلاحيات","ملفات"];
  const groups = new Map();
  for(const it of items){
    const sec = it.section || "عام";
    if(!groups.has(sec)) groups.set(sec, []);
    groups.get(sec).push(it);
  }

  const secs = Array.from(groups.keys()).sort((a,b)=>{
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if(ia===-1 && ib===-1) return a.localeCompare(b);
    if(ia===-1) return 1;
    if(ib===-1) return -1;
    return ia-ib;
  });

  for(const sec of secs){
    const wrap = document.createElement("div");
    wrap.className = "group";

    const head = document.createElement("div");
    head.className = "ghead";
    head.innerHTML = `<span>${sec}</span><span class="car">▾</span>`;
    wrap.appendChild(head);

    const body = document.createElement("div");
    body.className = "gbody";
    wrap.appendChild(body);

    const list = groups.get(sec).slice().sort((a,b)=>a.title.localeCompare(b.title));
    // keep dashboard first inside its section
    list.sort((a,b)=> (a.id==="dashboard" ? -1 : (b.id==="dashboard"?1:0)));

    for(const it of list){
      const a = document.createElement("a");
      a.href = "#"+it.id;
      a.dataset.nav = it.id;
      a.innerHTML = `<span>${it.title}</span>` + (it.badgeKey ? `<span class="badge" id="badge_${it.badgeKey}">0</span>` : "");
      a.addEventListener("click", (e)=>{
        e.preventDefault();
        go(it.id);
        closeSidebarOnMobile(); setDrawerDim(false);
      });
      body.appendChild(a);
    }

    let collapsed = false;
    head.addEventListener("click", ()=>{
      collapsed = !collapsed;
      body.style.display = collapsed ? "none" : "grid";
      head.querySelector(".car").textContent = collapsed ? "▸" : "▾";
    });

    nav.appendChild(wrap);
  }

  updateBadges();
}
function setActiveNav(id){
  // sidebar links
  $$("#nav a").forEach(a => a.classList.toggle("active", a.dataset.nav===id));

  // modulebar buttons (desktop)
  $$(".modulebar .mbtn").forEach(b => b.classList.toggle("active", b.dataset.go===id));

  // bottom bar buttons (mobile)
  setActiveBottom(id);
}
function showView(viewId){
  $$(".view").forEach(v => v.classList.add("hidden"));
  $("#"+viewId).classList.remove("hidden");
}
function closeSidebarOnMobile(){
  if(window.matchMedia("(max-width: 980px)").matches){
    $("#sidebar").classList.remove("open");
    setDrawerDim(false);
  }
}

function ensureDrawerDim(){
  if(document.querySelector(".drawer-dim")) return;
  const dim = document.createElement("div");
  dim.className = "drawer-dim";
  dim.addEventListener("click", ()=>{
    $("#sidebar").classList.remove("open");
    setDrawerDim(false);
    dim.classList.remove("show");
  });
  document.body.appendChild(dim);
}
function setDrawerDim(show){
  const dim = document.querySelector(".drawer-dim");
  if(!dim) return;
  dim.classList.toggle("show", !!show);
}

function go(navId){
  const item = NAV.find(x=>x.id===navId);
  if(!item) return;
  const role = currentUser()?.role;
  if(!item.roles.includes(role)){ toast("لا تملك صلاحية"); return; }
  setActiveNav(navId);
  showView(item.view);

  if(navId==="dashboard") renderDashboard();
  if(navId==="company") renderCompany();
  if(navId==="accounts") renderAccounts();
  if(navId==="items") renderItems();
  if(navId==="wh") renderWh();
  if(navId==="sales") renderSales();
  if(navId==="purchases") renderPurchases();
  if(navId==="vouchers") renderVouchers();
  if(navId==="moves") renderMovesSetup();
  if(navId==="stocktake") renderStocktakeSetup();
  if(navId==="cc") renderCC();
  if(navId==="journal") renderJournal();
  if(navId==="gl") renderGLSetup();
  if(navId==="statement") renderStatementSetup();
  if(navId==="users") renderUsers();

  location.hash = navId;
}

/* Sidebar toggle */
$("#btnMenu").addEventListener("click", ()=>{
  ensureDrawerDim();
  const s = $("#sidebar");
  s.classList.toggle("open");
  setDrawerDim(s.classList.contains("open"));
});
/* Module bar quick navigation */
$$('.mbtn').forEach(b=>{
  b.addEventListener('click', ()=>{
    const id = b.dataset.go;
    if(id) go(id);
  });
});

/* Backup/Restore */
$("#btnBackup").addEventListener("click", ()=>{
  if(!currentUser()) return;
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ERP_Backup_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("تم إنشاء النسخة الاحتياطية");
});
$("#btnRestore").addEventListener("click", ()=> $("#fileRestore").click());
$("#fileRestore").addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  e.target.value = "";
  if(!file) return;
  if(currentUser()?.role !== "admin"){ toast("الاستعادة للأدمن فقط"); return; }
  const text = await file.text();
  const data = safeParse(text, null);
  if(!data || !data.users || !data.company){ toast("ملف غير صالح"); return; }
  state = data;
  saveState(state);
  toast("تمت الاستعادة");
  bootApp();
});

/* Login */
$("#btnLogin").addEventListener("click", ()=>{
  const u = $("#loginUsername").value;
  const p = $("#loginPassword").value;
  if(!login(u,p)){ toast("بيانات الدخول غير صحيحة"); return; }
  bootApp();
});
$("#loginPassword").addEventListener("keydown", (e)=>{ if(e.key==="Enter") $("#btnLogin").click(); });
$("#loginUsername").addEventListener("keydown", (e)=>{ if(e.key==="Enter") $("#btnLogin").click(); });
$("#btnLogout").addEventListener("click", logout);

/* Helpers */
function money(n){ return fmt.format(Number(n||0)); }
function parseMoney(x){
  const v = Number(String(x||"").replace(/[^\d.]/g,""));
  return isFinite(v) ? v : 0;
}
function accountName(id){
  const a = state.accounts.find(x=>x.id===id);
  return a ? a.name : id;
}
function ccName(code){
  const c = state.costCenters.find(x=>x.code===code);
  return c ? c.name : "";
}
function whName(code){
  const w = state.warehouses.find(x=>x.code===code);
  return w ? w.name : code;
}
function itemByCode(code){
  return state.items.find(x=>x.code===code);
}
function uid(prefix="ID"){
  return prefix + "-" + Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function pickAccountOptions(selectEl, includeBlank=true){
  const acc = [...state.accounts].sort((a,b)=> a.id.localeCompare(b.id));
  selectEl.innerHTML = includeBlank ? `<option value="">اختر...</option>` : "";
  for(const a of acc){
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = `${a.id} — ${a.name}`;
    selectEl.appendChild(opt);
  }
}
function pickItemOptions(selectEl, includeBlank=true){
  const items = [...state.items].sort((a,b)=> a.code.localeCompare(b.code));
  selectEl.innerHTML = includeBlank ? `<option value="">اختر مادة...</option>` : "";
  for(const it of items){
    const opt = document.createElement("option");
    opt.value = it.code;
    opt.textContent = `${it.code} — ${it.name}`;
    selectEl.appendChild(opt);
  }
}
function pickWhOptions(selectEl, includeAll=true){
  const wh = [...state.warehouses].sort((a,b)=> a.code.localeCompare(b.code));
  selectEl.innerHTML = includeAll ? `<option value="">الكل</option>` : "";
  for(const w of wh){
    const opt = document.createElement("option");
    opt.value = w.code;
    opt.textContent = `${w.code} — ${w.name}`;
    selectEl.appendChild(opt);
  }
}
function pickCCOptions(selectEl, includeBlank=true){
  const cc = [...state.costCenters].sort((a,b)=> a.code.localeCompare(b.code));
  selectEl.innerHTML = includeBlank ? `<option value="">بدون</option>` : "";
  for(const c of cc){
    const opt = document.createElement("option");
    opt.value = c.code;
    opt.textContent = `${c.code} — ${c.name}`;
    selectEl.appendChild(opt);
  }
}

/* Modal */
function openModal(title, bodyHTML, footButtons){
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = bodyHTML;
  const foot = $("#modalFoot");
  foot.innerHTML = "";
  for(const b of (footButtons||[])){
    const btn = document.createElement("button");
    btn.className = "btn " + (b.kind||"");
    btn.textContent = b.text;
    btn.addEventListener("click", b.onClick);
    foot.appendChild(btn);
  }
  $("#modal").classList.remove("hidden");
}
function closeModal(){
  $("#modal").classList.add("hidden");
  $("#modalBody").innerHTML = "";
  $("#modalFoot").innerHTML = "";
}
$("#btnModalClose").addEventListener("click", closeModal);
$("#modal").addEventListener("click", (e)=>{ if(e.target.id==="modal") closeModal(); });

/* Printing */
function openPrintWindow(title, html){
  const c = state.company || {};
  const safe = (s)=> String(s||"").replace(/[<>]/g, "");
  const w = window.open("", "_blank");
  const doc = `
  <!doctype html><html lang="ar" dir="rtl"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${safe(title)}</title>
    <style>
      body{font-family: Arial, "Noto Kufi Arabic", sans-serif; margin:18px; color:#111}
      .head{display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:14px}
      .box{border:1px solid #ddd; border-radius:12px; padding:12px}
      h1{font-size:18px; margin:0 0 6px}
      .muted{color:#555; font-size:12px}
      table{width:100%; border-collapse:collapse; margin-top:12px}
      th,td{border:1px solid #ddd; padding:8px; font-size:12px; text-align:right}
      th{background:#f5f5f5}
      .tot{margin-top:12px; display:flex; gap:10px; flex-wrap:wrap}
      .tot .pill{border:1px solid #ddd; border-radius:999px; padding:8px 10px; font-size:12px}
      @page{size:A4; margin:14mm}
      @media print{button{display:none}}
    </style>
  </head><body>
    <button onclick="window.print()" style="padding:8px 12px;border-radius:10px;border:1px solid #ddd;background:#fff;cursor:pointer">طباعة</button>
    <div class="head">
      <div class="box">
        <h1>${safe(c.name||"الشركة")}</h1>
        <div class="muted">${safe(c.address||"")}</div>
        <div class="muted">${safe(c.phone||"")}</div>
      </div>
      <div class="box">
        <h1>${safe(title)}</h1>
        <div class="muted">تاريخ الطباعة: ${new Date().toLocaleString("ar-EG")}</div>
      </div>
    </div>
    ${html}
    <div class="muted" style="margin-top:18px">${safe(c.note||"")}</div>
  </body></html>`;
  w.document.open(); w.document.write(doc); w.document.close();
}

/* ================= Inventory (Avg cost) ================= */
function avgCostForItemInWh(itemCode, whCode){
  const moves = state.moves.filter(m=>m.itemCode===itemCode && m.warehouse===whCode);
  let qtyIn=0, costSum=0, qtyOut=0;
  for(const m of moves){
    if(m.inOut==="IN"){ qtyIn += Number(m.qty||0); costSum += Number(m.qty||0)*Number(m.cost||0); }
    if(m.inOut==="OUT"){ qtyOut += Number(m.qty||0); }
  }
  const onHand = qtyIn - qtyOut;
  const avg = qtyIn>0 ? (costSum/qtyIn) : Number(itemByCode(itemCode)?.purchasePrice||0);
  return { avg: isFinite(avg)?avg:0, onHand };
}
function stockForItem(itemCode, whCode){
  const whs = whCode ? [whCode] : state.warehouses.map(w=>w.code);
  let onHand=0;
  for(const w of whs){
    onHand += avgCostForItemInWh(itemCode, w).onHand;
  }
  return onHand;
}
function inventoryValue(){
  let total=0;
  for(const w of state.warehouses){
    for(const it of state.items){
      const info = avgCostForItemInWh(it.code, w.code);
      total += Math.max(0, info.onHand) * info.avg;
    }
  }
  return total;
}
function addMove({date, doc, docNo, inOut, warehouse, itemCode, qty, cost, note}){
  state.moves.push({
    id: uid("MV"),
    date, doc, docNo,
    inOut,
    warehouse,
    itemCode,
    qty: Number(qty||0),
    cost: Number(cost||0),
    note: note||""
  });
}

/* ================= Journals ================= */
function nextJournalNo(){
  const last = state.journals.length ? Number(state.journals[state.journals.length-1].no) : 0;
  return String(last+1).padStart(6,"0");
}
function postJournal({date, note, system=false, docRef="", lines}){
  state.journals.push({
    no: nextJournalNo(),
    date,
    note,
    system,
    docRef,
    lines: lines.map(l=>({
      account: l.account,
      debit: Number(l.debit||0),
      credit: Number(l.credit||0),
      cc: l.cc || ""
    }))
  });
}
function ledgerRows(){
  const rows = [];
  for(const a of state.accounts){
    const op = Number(a.opening||0);
    if(op!==0){
      rows.push({
        date: "0000-01-01",
        ref: "افتتاحي",
        note: "رصيد افتتاحي",
        account: a.id,
        cc: "",
        debit: op>0 ? op : 0,
        credit: op<0 ? Math.abs(op) : 0
      });
    }
  }
  for(const j of state.journals){
    for(const l of (j.lines||[])){
      rows.push({
        date: j.date,
        ref: `قيد #${j.no}${j.docRef?(" • "+j.docRef):""}`,
        note: j.note,
        account: l.account,
        cc: l.cc || "",
        debit: Number(l.debit||0),
        credit: Number(l.credit||0)
      });
    }
  }
  return rows;
}

/* ================= Dashboard ================= */
function renderDashboard(){
  const salesNet = state.sales.reduce((s,x)=> s + Number(x.net||0), 0);
  const purchNet = state.purchases.reduce((s,x)=> s + Number(x.net||0), 0);
  $("#kpiSales").textContent = money(salesNet);
  $("#kpiPurchases").textContent = money(purchNet);
  $("#kpiStockValue").textContent = money(inventoryValue());
  $("#kpiUpdated").textContent = (state.meta?.updatedAt ? new Date(state.meta.updatedAt).toLocaleString("ar-EG") : "—");

  const recentMoves = [...state.moves].slice(-6).reverse();
  $("#recentMoves").innerHTML = recentMoves.length ? "" : `<div class="muted small">لا يوجد بعد</div>`;
  for(const m of recentMoves){
    const it = itemByCode(m.itemCode);
    const div = document.createElement("div");
    div.className="row";
    div.innerHTML = `<div><b>${m.inOut==="IN"?"دخول":"خروج"}</b> — ${it?it.name:m.itemCode}<div class="muted small">${m.date} • ${whName(m.warehouse)}</div></div><div class="mono">${money(m.qty)}</div>`;
    $("#recentMoves").appendChild(div);
  }

  const recentDocs = [
    ...state.sales.slice(-2).map(x=>({t:"مبيعات", no:x.no, date:x.date, v:x.net})),
    ...state.purchases.slice(-2).map(x=>({t:"مشتريات", no:x.no, date:x.date, v:x.net})),
    ...state.vouchers.slice(-2).map(x=>({t:"سند "+x.type, no:x.no, date:x.date, v:x.amount})),
  ].sort((a,b)=> (a.date<b.date?1:-1)).slice(0,6);

  $("#recentDocs").innerHTML = recentDocs.length ? "" : `<div class="muted small">لا يوجد بعد</div>`;
  for(const d of recentDocs){
    const div=document.createElement("div");
    div.className="row";
    div.innerHTML = `<div><b>${d.t}</b> — #${d.no}<div class="muted small">${d.date}</div></div><div class="mono">${money(d.v)}</div>`;
    $("#recentDocs").appendChild(div);
  }
}

/* ================= Company ================= */
function renderCompany(){
  const c = state.company || {};
  $("#companyName").value = c.name || "";
  $("#companyPhone").value = c.phone || "";
  $("#companyAddress").value = c.address || "";
  $("#companyNote").value = c.note || "";
}
$("#btnSaveCompany").addEventListener("click", ()=>{
  state.company = {
    name: $("#companyName").value.trim() || "الشركة",
    phone: $("#companyPhone").value.trim(),
    address: $("#companyAddress").value.trim(),
    note: $("#companyNote").value.trim()
  };
  saveState(state);
  $("#companyNameTop").textContent = state.company.name || "الشركة";
  toast("تم حفظ بيانات الشركة");
});

/* ================= Accounts ================= */
function renderAccounts(){
  const q = ($("#accountsSearch").value||"").trim();
  const rows = [...state.accounts].filter(a=>!q || (a.id+a.name+a.type).includes(q)).sort((a,b)=>a.id.localeCompare(b.id));
  const tbody = $("#accountsTable tbody"); tbody.innerHTML="";
  for(const a of rows){
    const tr=document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${a.id}</td>
      <td>${a.name}</td>
      <td><span class="chip">${a.type}</span></td>
      <td class="mono">${money(a.opening||0)}</td>
      <td class="ta-left">
        <div class="chips">
          <button class="btn" data-edit="${a.id}">تعديل</button>
          <button class="btn danger" data-del="${a.id}">حذف</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("button[data-edit]").forEach(b=> b.addEventListener("click", ()=> openAccountModal(b.dataset.edit)));
  tbody.querySelectorAll("button[data-del]").forEach(b=> b.addEventListener("click", ()=> deleteAccount(b.dataset.del)));
}
$("#accountsSearch").addEventListener("input", renderAccounts);
$("#btnAddAccount").addEventListener("click", ()=> openAccountModal(null));

function accountIsUsed(id){
  const inJ = state.journals.some(j => (j.lines||[]).some(l=>l.account===id));
  const usedCore = ["1100","2100","2200","4100","4190","5190","1300","5200"].includes(id);
  return inJ || usedCore;
}
function openAccountModal(id){
  const isEdit = !!id;
  const a = isEdit ? state.accounts.find(x=>x.id===id) : { id:"", name:"", type:"أصل", opening:0 };
  const body = `
    <div class="form-grid">
      <div class="field"><label>رقم الحساب</label>
        <input id="m_acc_id" type="text" value="${a.id}" placeholder="مثال: 2200" ${isEdit?"disabled":""}/>
      </div>
      <div class="field"><label>اسم الحساب</label>
        <input id="m_acc_name" type="text" value="${a.name}" placeholder="مثال: العملاء"/>
      </div>
      <div class="field"><label>النوع</label>
        <select id="m_acc_type">
          ${["أصل","التزام","إيراد","مصروف","حقوق"].map(t=>`<option ${a.type===t?"selected":""}>${t}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>الرصيد الافتتاحي</label>
        <input id="m_acc_open" type="number" step="0.01" value="${Number(a.opening||0)}"/>
      </div>
    </div>`;
  openModal(isEdit?"تعديل حساب":"إضافة حساب", body, [
    { text:"حفظ", kind:"primary", onClick: ()=>{
      const id2=$("#m_acc_id").value.trim();
      const name=$("#m_acc_name").value.trim();
      const type=$("#m_acc_type").value;
      const opening=parseMoney($("#m_acc_open").value);
      if(!id2 || !name){ toast("أكمل البيانات"); return; }
      if(!isEdit && state.accounts.some(x=>x.id===id2)){ toast("رقم الحساب موجود"); return; }
      if(isEdit){
        const idx=state.accounts.findIndex(x=>x.id===id);
        state.accounts[idx] = { id:id, name, type, opening };
      }else{
        state.accounts.push({ id:id2, name, type, opening });
      }
      saveState(state); closeModal();
      renderAccounts(); renderStatementSetup(); renderGLSetup();
      toast("تم الحفظ");
    }},
    { text:"إلغاء", onClick: closeModal }
  ]);
}
function deleteAccount(id){
  if(accountIsUsed(id)){ toast("لا يمكن حذف الحساب لأنه مستخدم"); return; }
  openModal("تأكيد الحذف", `<div class="muted">حذف الحساب <b>${id}</b>؟</div>`, [
    { text:"حذف", kind:"danger", onClick: ()=>{
      state.accounts = state.accounts.filter(x=>x.id!==id);
      saveState(state); closeModal();
      renderAccounts(); renderStatementSetup(); renderGLSetup();
      toast("تم الحذف");
    }},
    { text:"إلغاء", onClick: closeModal }
  ]);
}
$("#btnPrintAccounts").addEventListener("click", ()=>{
  const rows=[...state.accounts].sort((a,b)=>a.id.localeCompare(b.id));
  const html = `<table><thead><tr><th>رقم</th><th>اسم الحساب</th><th>النوع</th><th>الرصيد الافتتاحي</th></tr></thead>
    <tbody>${rows.map(a=>`<tr><td>${a.id}</td><td>${a.name}</td><td>${a.type}</td><td>${money(a.opening||0)}</td></tr>`).join("")}</tbody></table>`;
  openPrintWindow("دليل الحسابات", html);
});

/* ================= Items ================= */
function renderItems(){
  const q=($("#itemsSearch").value||"").trim().toLowerCase();
  const rows=[...state.items].filter(it=>!q || (it.code+it.name+it.unit).toLowerCase().includes(q)).sort((a,b)=>a.code.localeCompare(b.code));
  const tbody=$("#itemsTable tbody"); tbody.innerHTML="";
  for(const it of rows){
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td class="mono">${it.code}</td>
      <td>${it.name}</td>
      <td>${it.unit}</td>
      <td class="mono">${money(it.salePrice||0)}</td>
      <td class="mono">${money(it.purchasePrice||0)}</td>
      <td class="ta-left"><div class="chips">
        <button class="btn" data-edit="${it.code}">تعديل</button>
        <button class="btn danger" data-del="${it.code}">حذف</button>
      </div></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("button[data-edit]").forEach(b=> b.addEventListener("click", ()=> openItemModal(b.dataset.edit)));
  tbody.querySelectorAll("button[data-del]").forEach(b=> b.addEventListener("click", ()=> deleteItem(b.dataset.del)));
}
$("#itemsSearch").addEventListener("input", renderItems);
$("#btnAddItem").addEventListener("click", ()=> openItemModal(null));
function itemIsUsed(code){
  return state.moves.some(m=>m.itemCode===code);
}
function openItemModal(code){
  const isEdit=!!code;
  const it=isEdit ? state.items.find(x=>x.code===code) : { code:"", name:"", unit:"قطعة", salePrice:0, purchasePrice:0 };
  const body=`
    <div class="form-grid">
      <div class="field"><label>كود المادة</label>
        <input id="m_it_code" type="text" value="${it.code}" placeholder="ITM-003" ${isEdit?"disabled":""}/>
      </div>
      <div class="field"><label>اسم المادة</label>
        <input id="m_it_name" type="text" value="${it.name}" />
      </div>
      <div class="field"><label>الوحدة</label>
        <input id="m_it_unit" type="text" value="${it.unit}" />
      </div>
      <div class="field"><label>سعر البيع</label>
        <input id="m_it_sale" type="number" step="0.01" value="${Number(it.salePrice||0)}"/>
      </div>
      <div class="field"><label>سعر الشراء</label>
        <input id="m_it_pur" type="number" step="0.01" value="${Number(it.purchasePrice||0)}"/>
      </div>
    </div>`;
  openModal(isEdit?"تعديل مادة":"إضافة مادة", body, [
    { text:"حفظ", kind:"primary", onClick: ()=>{
      const code2=$("#m_it_code").value.trim();
      const name=$("#m_it_name").value.trim();
      if(!code2 || !name){ toast("أكمل البيانات"); return; }
      const unit=$("#m_it_unit").value.trim() || "قطعة";
      const salePrice=parseMoney($("#m_it_sale").value);
      const purchasePrice=parseMoney($("#m_it_pur").value);
      if(!isEdit && state.items.some(x=>x.code===code2)){ toast("الكود موجود"); return; }
      if(isEdit){
        const idx=state.items.findIndex(x=>x.code===code);
        state.items[idx] = { code:code, name, unit, salePrice, purchasePrice };
      }else{
        state.items.push({ code:code2, name, unit, salePrice, purchasePrice });
      }
      saveState(state); closeModal();
      renderItems(); toast("تم الحفظ");
    }},
    { text:"إلغاء", onClick: closeModal }
  ]);
}
function deleteItem(code){
  if(itemIsUsed(code)){ toast("لا يمكن حذف المادة لأنها مستخدمة بالحركات"); return; }
  openModal("تأكيد الحذف", `<div class="muted">حذف المادة <b>${code}</b>؟</div>`, [
    { text:"حذف", kind:"danger", onClick: ()=>{
      state.items = state.items.filter(x=>x.code!==code);
      saveState(state); closeModal();
      renderItems(); toast("تم الحذف");
    }},
    { text:"إلغاء", onClick: closeModal }
  ]);
}
$("#btnPrintItems").addEventListener("click", ()=>{
  const rows=[...state.items].sort((a,b)=>a.code.localeCompare(b.code));
  const html=`<table><thead><tr><th>كود</th><th>اسم</th><th>وحدة</th><th>سعر البيع</th><th>سعر الشراء</th></tr></thead>
    <tbody>${rows.map(it=>`<tr><td>${it.code}</td><td>${it.name}</td><td>${it.unit}</td><td>${money(it.salePrice||0)}</td><td>${money(it.purchasePrice||0)}</td></tr>`).join("")}</tbody></table>`;
  openPrintWindow("دليل المواد", html);
});

/* ================= Warehouses ================= */
function renderWh(){
  const q=($("#whSearch").value||"").trim().toLowerCase();
  const rows=[...state.warehouses].filter(w=>!q || (w.code+w.name).toLowerCase().includes(q)).sort((a,b)=>a.code.localeCompare(b.code));
  const tbody=$("#whTable tbody"); tbody.innerHTML="";
  for(const w of rows){
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td class="mono">${w.code}</td>
      <td>${w.name}</td>
      <td class="ta-left"><div class="chips">
        <button class="btn" data-edit="${w.code}">تعديل</button>
        ${w.code==="WH-001" ? "" : `<button class="btn danger" data-del="${w.code}">حذف</button>`}
      </div></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("button[data-edit]").forEach(b=>b.addEventListener("click",()=>openWhModal(b.dataset.edit)));
  tbody.querySelectorAll("button[data-del]").forEach(b=>b.addEventListener("click",()=>deleteWh(b.dataset.del)));
}
$("#whSearch").addEventListener("input", renderWh);
$("#btnAddWh").addEventListener("click", ()=>openWhModal(null));
function whIsUsed(code){
  return state.moves.some(m=>m.warehouse===code) || state.sales.some(x=>x.wh===code) || state.purchases.some(x=>x.wh===code);
}
function openWhModal(code){
  const isEdit=!!code;
  const w=isEdit ? state.warehouses.find(x=>x.code===code) : { code:"", name:"" };
  const body=`
    <div class="form-grid">
      <div class="field"><label>كود المستودع</label><input id="m_wh_code" type="text" value="${w.code}" placeholder="WH-002" ${isEdit?"disabled":""}/></div>
      <div class="field"><label>اسم المستودع</label><input id="m_wh_name" type="text" value="${w.name}" placeholder="مستودع 2"/></div>
    </div>`;
  openModal(isEdit?"تعديل مستودع":"إضافة مستودع", body, [
    {text:"حفظ", kind:"primary", onClick: ()=>{
      const c=$("#m_wh_code").value.trim();
      const n=$("#m_wh_name").value.trim();
      if(!c || !n){ toast("أكمل البيانات"); return; }
      if(!isEdit && state.warehouses.some(x=>x.code===c)){ toast("الكود موجود"); return; }
      if(isEdit){
        state.warehouses[state.warehouses.findIndex(x=>x.code===code)] = { code:code, name:n };
      }else{
        state.warehouses.push({ code:c, name:n });
      }
      saveState(state); closeModal(); toast("تم الحفظ"); renderWh();
    }},
    {text:"إلغاء", onClick: closeModal}
  ]);
}
function deleteWh(code){
  if(whIsUsed(code)){ toast("لا يمكن حذف المستودع لأنه مستخدم"); return; }
  openModal("تأكيد الحذف", `<div class="muted">حذف المستودع <b>${code}</b>؟</div>`, [
    {text:"حذف", kind:"danger", onClick: ()=>{
      state.warehouses = state.warehouses.filter(x=>x.code!==code);
      saveState(state); closeModal(); toast("تم الحذف"); renderWh();
    }},
    {text:"إلغاء", onClick: closeModal}
  ]);
}
$("#btnPrintWh").addEventListener("click", ()=>{
  const rows=[...state.warehouses].sort((a,b)=>a.code.localeCompare(b.code));
  const html=`<table><thead><tr><th>كود</th><th>اسم المستودع</th></tr></thead><tbody>${rows.map(w=>`<tr><td>${w.code}</td><td>${w.name}</td></tr>`).join("")}</tbody></table>`;
  openPrintWindow("المستودعات", html);
});

/* ================= Invoices ================= */
function nextInvoiceNo(list){
  const last = list.length ? Number(list[list.length-1].no) : 0;
  return String(last+1).padStart(6,"0");
}
function invoiceTotals(lines){
  return lines.reduce((s,l)=> s + (Number(l.qty||0)*Number(l.price||0)), 0);
}
function canConsumeStock(lines, wh){
  for(const l of lines){
    const onHand = stockForItem(l.code, wh);
    if(onHand < Number(l.qty||0)) return { ok:false, item:l.code, onHand };
  }
  return { ok:true };
}

function removeDocEffects(kind, docNo){
  const ref = (kind==="sales"?"مبيعات":"مشتريات") + ` #${docNo}`;
  state.journals = state.journals.filter(j => !(j.system && j.docRef===ref));
  state.moves = state.moves.filter(m => !((m.doc===(kind==="sales"?"مبيعات":"مشتريات")) && m.docNo===docNo));
}
function applyInvoiceEffects(kind, inv){
  const ref = (kind==="sales"?"مبيعات":"مشتريات") + ` #${inv.no}`;
  const date = inv.date;
  const wh = inv.wh;

  if(kind==="purchases"){
    for(const l of inv.lines){
      addMove({ date, doc:"مشتريات", docNo: inv.no, inOut:"IN", warehouse: wh, itemCode: l.code, qty: l.qty, cost: l.price, note: inv.party });
    }
    const total = Number(inv.total||0);
    const disc = Number(inv.discount||0);
    const net = Number(inv.net||0);
    const lines = [
      { account:"1300", debit: total, credit:0 },
      { account: inv.account || "2100", debit:0, credit: net },
    ];
    if(disc>0) lines.push({ account:"5190", debit:0, credit: disc });
    postJournal({ date, note:`قيد مشتريات (${inv.party})`, system:true, docRef: ref, lines });
  }

  if(kind==="sales"){
    let cogs = 0;
    for(const l of inv.lines){
      const info = avgCostForItemInWh(l.code, wh);
      const cost = info.avg;
      cogs += Number(l.qty||0) * cost;
      addMove({ date, doc:"مبيعات", docNo: inv.no, inOut:"OUT", warehouse: wh, itemCode: l.code, qty: l.qty, cost: cost, note: inv.party });
    }
    const total = Number(inv.total||0);
    const disc = Number(inv.discount||0);
    const net = Number(inv.net||0);
    const lines = [
      { account: inv.account || "2200", debit: net, credit:0 },
      { account:"4100", debit:0, credit: total },
    ];
    if(disc>0) lines.push({ account:"4190", debit: disc, credit:0 });
    if(cogs>0){
      lines.push({ account:"5200", debit: cogs, credit:0 });
      lines.push({ account:"1300", debit:0, credit: cogs });
    }
    postJournal({ date, note:`قيد مبيعات (${inv.party})`, system:true, docRef: ref, lines });
  }
}

function renderSales(){
  const q=($("#salesSearch").value||"").trim();
  const rows=[...state.sales].filter(inv=>!q || (inv.no+inv.party+inv.date).includes(q)).slice().reverse();
  const tbody=$("#salesTable tbody"); tbody.innerHTML="";
  for(const inv of rows){
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td class="mono">${inv.no}</td>
      <td class="mono">${inv.date}</td>
      <td>${inv.party}</td>
      <td class="mono">${inv.wh || ""} — ${inv.wh?whName(inv.wh):""}</td>
      <td class="mono">${money(inv.total||0)}</td>
      <td class="mono">${money(inv.discount||0)}</td>
      <td class="mono"><b>${money(inv.net||0)}</b></td>
      <td class="ta-left"><div class="chips">
        <button class="btn" data-open="${inv.no}">فتح</button>
        <button class="btn" data-print="${inv.no}">طباعة</button>
        <button class="btn danger" data-del="${inv.no}">حذف</button>
      </div></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("button[data-open]").forEach(b=>b.addEventListener("click",()=>openInvoiceModal("sales", b.dataset.open)));
  tbody.querySelectorAll("button[data-print]").forEach(b=>b.addEventListener("click",()=>printInvoice("sales", b.dataset.print)));
  tbody.querySelectorAll("button[data-del]").forEach(b=>b.addEventListener("click",()=>deleteInvoice("sales", b.dataset.del)));
  updateBadges(); renderDashboard();
}
$("#salesSearch").addEventListener("input", renderSales);

function renderPurchases(){
  const q=($("#purchasesSearch").value||"").trim();
  const rows=[...state.purchases].filter(inv=>!q || (inv.no+inv.party+inv.date).includes(q)).slice().reverse();
  const tbody=$("#purchasesTable tbody"); tbody.innerHTML="";
  for(const inv of rows){
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td class="mono">${inv.no}</td>
      <td class="mono">${inv.date}</td>
      <td>${inv.party}</td>
      <td class="mono">${inv.wh || ""} — ${inv.wh?whName(inv.wh):""}</td>
      <td class="mono">${money(inv.total||0)}</td>
      <td class="mono">${money(inv.discount||0)}</td>
      <td class="mono"><b>${money(inv.net||0)}</b></td>
      <td class="ta-left"><div class="chips">
        <button class="btn" data-open="${inv.no}">فتح</button>
        <button class="btn" data-print="${inv.no}">طباعة</button>
        <button class="btn danger" data-del="${inv.no}">حذف</button>
      </div></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("button[data-open]").forEach(b=>b.addEventListener("click",()=>openInvoiceModal("purchases", b.dataset.open)));
  tbody.querySelectorAll("button[data-print]").forEach(b=>b.addEventListener("click",()=>printInvoice("purchases", b.dataset.print)));
  tbody.querySelectorAll("button[data-del]").forEach(b=>b.addEventListener("click",()=>deleteInvoice("purchases", b.dataset.del)));
  updateBadges(); renderDashboard();
}
$("#purchasesSearch").addEventListener("input", renderPurchases);

$("#btnNewSale").addEventListener("click", ()=> openInvoiceModal("sales", null));
$("#btnNewPurchase").addEventListener("click", ()=> openInvoiceModal("purchases", null));
$("#btnQuickSale").addEventListener("click", ()=>{ go("sales"); openInvoiceModal("sales", null); });
$("#btnQuickPurchase").addEventListener("click", ()=>{ go("purchases"); openInvoiceModal("purchases", null); });

function openInvoiceModal(kind, no){
  const list = (kind==="sales") ? state.sales : state.purchases;
  const isEdit = !!no;
  const inv = isEdit ? list.find(x=>x.no===no) : {
    no: nextInvoiceNo(list),
    date: todayISO(),
    party: kind==="sales" ? "عميل" : "مورد",
    account: kind==="sales" ? "2200" : "2100",
    wh: state.warehouses[0]?.code || "WH-001",
    discount: 0,
    lines: []
  };
  const title = (kind==="sales" ? "فاتورة مبيعات" : "فاتورة مشتريات") + (isEdit ? ` #${inv.no}` : " جديدة");
  const body = `
    <div class="form-grid">
      <div class="field"><label>رقم الفاتورة</label><input id="m_inv_no" type="text" value="${inv.no}" disabled /></div>
      <div class="field"><label>التاريخ</label><input id="m_inv_date" type="date" value="${inv.date}" /></div>
      <div class="field"><label>${kind==="sales"?"العميل":"المورد"}</label><input id="m_inv_party" type="text" value="${inv.party}" /></div>
      <div class="field"><label>الحساب (للكشف)</label><select id="m_inv_account"></select></div>
      <div class="field"><label>المستودع</label><select id="m_inv_wh"></select></div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="card-title">بنود الفاتورة</div>
      <div class="toolbar" style="margin-top:10px">
        <select id="m_line_item"></select>
        <input id="m_line_qty" type="number" step="0.01" placeholder="الكمية" style="max-width:140px" />
        <input id="m_line_price" type="number" step="0.01" placeholder="السعر" style="max-width:160px" />
        <button class="btn primary" id="btnAddLine">إضافة بند</button>
      </div>
      <div class="table-wrap">
        <table class="table" style="min-width:650px">
          <thead><tr><th>المادة</th><th>وحدة</th><th>كمية</th><th>سعر</th><th>الإجمالي</th><th class="ta-left">—</th></tr></thead>
          <tbody id="m_lines"></tbody>
        </table>
      </div>
      ${kind==="sales" ? `<div class="muted small mt">في المبيعات: سيتم منع الحفظ إذا الرصيد غير كافي بالمستودع.</div>` : ``}
    </div>

    <div class="form-grid" style="margin-top:12px">
      <div class="field"><label>${kind==="sales"?"خصم ممنوح":"خصم مكتسب"}</label><input id="m_inv_discount" type="number" step="0.01" value="${Number(inv.discount||0)}" /></div>
      <div class="field"><label>الإجمالي</label><input id="m_inv_total" type="text" value="0" disabled /></div>
      <div class="field"><label>الصافي</label><input id="m_inv_net" type="text" value="0" disabled /></div>
    </div>`;
  openModal(title, body, [
    { text:"حفظ", kind:"primary", onClick: ()=>{
      const date=$("#m_inv_date").value || todayISO();
      const party=$("#m_inv_party").value.trim() || (kind==="sales"?"عميل":"مورد");
      const account=$("#m_inv_account").value || (kind==="sales"?"2200":"2100");
      const wh=$("#m_inv_wh").value || (state.warehouses[0]?.code || "WH-001");
      const discount=parseMoney($("#m_inv_discount").value);
      const lines=currentModalLines();
      const total=invoiceTotals(lines);
      const net=Math.max(0, total-discount);

      if(kind==="sales"){
        const chk = canConsumeStock(lines, wh);
        if(!chk.ok){
          const it=itemByCode(chk.item);
          toast(`رصيد غير كافي: ${it?it.name:chk.item} (المتوفر ${money(chk.onHand)})`);
          return;
        }
      }

      const inv2={...inv, date, party, account, wh, discount, lines, total, net};

      if(isEdit){
        removeDocEffects(kind, inv.no);
        list[list.findIndex(x=>x.no===no)] = inv2;
      }else{
        list.push(inv2);
      }
      if(kind==="sales") state.sales=list; else state.purchases=list;

      applyInvoiceEffects(kind, inv2);

      saveState(state); closeModal(); toast("تم حفظ الفاتورة");
      if(kind==="sales") renderSales(); else renderPurchases();
      renderJournal(); renderDashboard();
    }},
    { text:"طباعة", onClick: ()=>{
      const date=$("#m_inv_date").value || todayISO();
      const party=$("#m_inv_party").value.trim() || (kind==="sales"?"عميل":"مورد");
      const account=$("#m_inv_account").value || (kind==="sales"?"2200":"2100");
      const wh=$("#m_inv_wh").value || (state.warehouses[0]?.code || "WH-001");
      const discount=parseMoney($("#m_inv_discount").value);
      const lines=currentModalLines();
      const total=invoiceTotals(lines);
      const net=Math.max(0, total-discount);
      printInvoiceObject(kind, {...inv, date, party, account, wh, discount, lines, total, net});
    }},
    { text:"إغلاق", onClick: closeModal }
  ]);

  pickAccountOptions($("#m_inv_account"), false);
  $("#m_inv_account").value = inv.account || (kind==="sales"?"2200":"2100");
  pickWhOptions($("#m_inv_wh"), false);
  $("#m_inv_wh").value = inv.wh || (state.warehouses[0]?.code || "WH-001");
  pickItemOptions($("#m_line_item"), true);
  $("#m_line_qty").value = "1";

  $("#m_line_item").addEventListener("change", ()=>{
    const code=$("#m_line_item").value;
    const it=state.items.find(x=>x.code===code);
    if(!it) return;
    $("#m_line_price").value = (kind==="sales") ? it.salePrice : it.purchasePrice;
  });

  setModalLines(inv.lines||[]);
  recalcModalTotals();
  $("#m_inv_discount").addEventListener("input", recalcModalTotals);

  $("#btnAddLine").addEventListener("click", ()=>{
    const code=$("#m_line_item").value;
    const it=state.items.find(x=>x.code===code);
    if(!it){ toast("اختر مادة"); return; }
    const qty=parseMoney($("#m_line_qty").value);
    const price=parseMoney($("#m_line_price").value || ((kind==="sales")?it.salePrice:it.purchasePrice));
    if(qty<=0){ toast("الكمية غير صحيحة"); return; }
    const lines=currentModalLines();
    lines.push({ code:it.code, name:it.name, unit:it.unit, qty, price });
    setModalLines(lines);
    recalcModalTotals();
  });
}

function currentModalLines(){
  return $$("#m_lines tr").map(tr=>{
    const code=tr.dataset.code;
    const name=tr.querySelector("[data-name]").textContent;
    const unit=tr.querySelector("[data-unit]").textContent;
    const qty=parseMoney(tr.querySelector("[data-qty]").value);
    const price=parseMoney(tr.querySelector("[data-price]").value);
    return { code, name, unit, qty, price };
  });
}
function setModalLines(lines){
  const tbody=$("#m_lines"); tbody.innerHTML="";
  for(const l of lines){
    const tr=document.createElement("tr");
    tr.dataset.code=l.code;
    tr.innerHTML=`
      <td data-name>${l.name}</td>
      <td data-unit>${l.unit}</td>
      <td><input data-qty type="number" step="0.01" value="${Number(l.qty||0)}" style="width:110px;border-radius:10px;border:1px solid rgba(0,0,0,.12);padding:6px 8px"/></td>
      <td><input data-price type="number" step="0.01" value="${Number(l.price||0)}" style="width:130px;border-radius:10px;border:1px solid rgba(0,0,0,.12);padding:6px 8px"/></td>
      <td class="mono" data-sum>0</td>
      <td class="ta-left"><button class="btn danger" data-remove>حذف</button></td>`;
    tbody.appendChild(tr);
    tr.querySelector("[data-qty]").addEventListener("input", recalcModalTotals);
    tr.querySelector("[data-price]").addEventListener("input", recalcModalTotals);
    tr.querySelector("[data-remove]").addEventListener("click", ()=>{ tr.remove(); recalcModalTotals(); });
  }
}
function recalcModalTotals(){
  const lines=currentModalLines();
  const total=invoiceTotals(lines);
  const discount=parseMoney($("#m_inv_discount")?.value);
  const net=Math.max(0, total-discount);
  $$("#m_lines tr").forEach(tr=>{
    const qty=parseMoney(tr.querySelector("[data-qty]").value);
    const price=parseMoney(tr.querySelector("[data-price]").value);
    tr.querySelector("[data-sum]").textContent = money(qty*price);
  });
  $("#m_inv_total").value = money(total);
  $("#m_inv_net").value = money(net);
}

function deleteInvoice(kind, no){
  const list=(kind==="sales")?state.sales:state.purchases;
  openModal("تأكيد الحذف", `<div class="muted">حذف المستند رقم <b>${no}</b>؟</div>`, [
    { text:"حذف", kind:"danger", onClick: ()=>{
      removeDocEffects(kind, no);
      const list2=list.filter(x=>x.no!==no);
      if(kind==="sales") state.sales=list2; else state.purchases=list2;
      saveState(state); closeModal(); toast("تم الحذف");
      if(kind==="sales") renderSales(); else renderPurchases();
      renderJournal(); renderDashboard();
    }},
    { text:"إلغاء", onClick: closeModal }
  ]);
}

function printInvoice(kind, no){
  const list=(kind==="sales")?state.sales:state.purchases;
  const inv=list.find(x=>x.no===no);
  if(!inv){ toast("غير موجود"); return; }
  printInvoiceObject(kind, inv);
}
function printInvoiceObject(kind, inv){
  const title=(kind==="sales"?"فاتورة مبيعات":"فاتورة مشتريات")+` #${inv.no}`;
  const lines=inv.lines||[];
  const html=`
    <div class="box">
      <div class="muted">التاريخ: <b>${inv.date}</b></div>
      <div class="muted">${kind==="sales"?"العميل":"المورد"}: <b>${inv.party}</b></div>
      <div class="muted">المستودع: <b>${inv.wh} — ${whName(inv.wh)}</b></div>
      <div class="muted">الحساب: <b>${inv.account} — ${accountName(inv.account)}</b></div>
    </div>
    <table>
      <thead><tr><th>المادة</th><th>وحدة</th><th>كمية</th><th>سعر</th><th>الإجمالي</th></tr></thead>
      <tbody>${lines.map(l=>`<tr><td>${l.name}</td><td>${l.unit}</td><td>${money(l.qty)}</td><td>${money(l.price)}</td><td>${money(l.qty*l.price)}</td></tr>`).join("")}</tbody>
    </table>
    <div class="tot">
      <div class="pill">الإجمالي: <b>${money(inv.total||0)}</b></div>
      <div class="pill">${kind==="sales"?"خصم ممنوح":"خصم مكتسب"}: <b>${money(inv.discount||0)}</b></div>
      <div class="pill">الصافي: <b>${money(inv.net||0)}</b></div>
    </div>`;
  openPrintWindow(title, html);
}
$("#btnPrintSalesList").addEventListener("click", ()=>{
  const rows=[...state.sales].slice().reverse();
  const html=`<table><thead><tr><th>رقم</th><th>تاريخ</th><th>العميل</th><th>المستودع</th><th>الإجمالي</th><th>خصم ممنوح</th><th>الصافي</th></tr></thead>
    <tbody>${rows.map(x=>`<tr><td>${x.no}</td><td>${x.date}</td><td>${x.party}</td><td>${x.wh} — ${whName(x.wh)}</td><td>${money(x.total||0)}</td><td>${money(x.discount||0)}</td><td>${money(x.net||0)}</td></tr>`).join("")}</tbody></table>`;
  openPrintWindow("قائمة فواتير المبيعات", html);
});
$("#btnPrintPurchasesList").addEventListener("click", ()=>{
  const rows=[...state.purchases].slice().reverse();
  const html=`<table><thead><tr><th>رقم</th><th>تاريخ</th><th>المورد</th><th>المستودع</th><th>الإجمالي</th><th>خصم مكتسب</th><th>الصافي</th></tr></thead>
    <tbody>${rows.map(x=>`<tr><td>${x.no}</td><td>${x.date}</td><td>${x.party}</td><td>${x.wh} — ${whName(x.wh)}</td><td>${money(x.total||0)}</td><td>${money(x.discount||0)}</td><td>${money(x.net||0)}</td></tr>`).join("")}</tbody></table>`;
  openPrintWindow("قائمة فواتير المشتريات", html);
});

/* ================= Vouchers ================= */
function nextVoucherNo(){
  const last = state.vouchers.length ? Number(state.vouchers[state.vouchers.length-1].no) : 0;
  return String(last+1).padStart(6,"0");
}
function removeVoucherEffects(no){
  const ref = `سند #${no}`;
  state.journals = state.journals.filter(j => !(j.system && j.docRef===ref));
}
function applyVoucherEffects(v){
  const ref = `سند #${v.no}`;
  const date = v.date;
  const amount = Number(v.amount||0);
  const cashAcc = v.cashAccount || "1100";
  const targetAcc = v.account;
  const cc = v.cc || "";
  if(v.type==="قبض"){
    postJournal({
      date, note:`سند قبض (${accountName(targetAcc)})`, system:true, docRef: ref,
      lines: [
        { account: cashAcc, debit: amount, credit:0, cc },
        { account: targetAcc, debit:0, credit: amount, cc }
      ]
    });
  }else{
    postJournal({
      date, note:`سند صرف (${accountName(targetAcc)})`, system:true, docRef: ref,
      lines: [
        { account: targetAcc, debit: amount, credit:0, cc },
        { account: cashAcc, debit:0, credit: amount, cc }
      ]
    });
  }
}

function renderVouchers(){
  const q=($("#vouchersSearch").value||"").trim();
  const rows=[...state.vouchers].filter(v=>!q || (v.no+v.type+v.account+v.note+v.date).includes(q)).slice().reverse();
  const tbody=$("#vouchersTable tbody"); tbody.innerHTML="";
  for(const v of rows){
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td class="mono">${v.no}</td>
      <td class="mono">${v.date}</td>
      <td>${v.type}</td>
      <td class="mono">${v.account} — ${accountName(v.account)}</td>
      <td class="mono"><b>${money(v.amount||0)}</b></td>
      <td>${v.note||""}</td>
      <td class="ta-left"><div class="chips">
        <button class="btn" data-open="${v.no}">فتح</button>
        <button class="btn" data-print="${v.no}">طباعة</button>
        <button class="btn danger" data-del="${v.no}">حذف</button>
      </div></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("button[data-open]").forEach(b=>b.addEventListener("click",()=>openVoucherModal(b.dataset.open)));
  tbody.querySelectorAll("button[data-print]").forEach(b=>b.addEventListener("click",()=>printVoucher(b.dataset.print)));
  tbody.querySelectorAll("button[data-del]").forEach(b=>b.addEventListener("click",()=>deleteVoucher(b.dataset.del)));
  updateBadges(); renderDashboard();
}
$("#vouchersSearch").addEventListener("input", renderVouchers);
$("#btnNewVoucher").addEventListener("click", ()=> openVoucherModal(null));

function openVoucherModal(no){
  const isEdit=!!no;
  const v=isEdit ? state.vouchers.find(x=>x.no===no) : { no:nextVoucherNo(), date:todayISO(), type:"قبض", account:"2200", cashAccount:"1100", amount:0, note:"", cc:"" };
  const body=`
    <div class="form-grid">
      <div class="field"><label>رقم السند</label><input id="m_v_no" type="text" value="${v.no}" disabled /></div>
      <div class="field"><label>التاريخ</label><input id="m_v_date" type="date" value="${v.date}" /></div>
      <div class="field"><label>النوع</label>
        <select id="m_v_type"><option ${v.type==="قبض"?"selected":""}>قبض</option><option ${v.type==="صرف"?"selected":""}>صرف</option></select>
      </div>
      <div class="field"><label>حساب الطرف</label><select id="m_v_acc"></select></div>
      <div class="field"><label>حساب الصندوق/البنك</label><select id="m_v_cash"></select></div>
      <div class="field"><label>مركز كلفة</label><select id="m_v_cc"></select></div>
      <div class="field"><label>المبلغ</label><input id="m_v_amount" type="number" step="0.01" value="${Number(v.amount||0)}" /></div>
      <div class="field" style="grid-column:1/-1"><label>البيان</label><input id="m_v_note" type="text" value="${v.note||""}" placeholder="مثال: سداد..." /></div>
    </div>`;
  openModal(isEdit?`تعديل سند #${v.no}`:"سند جديد", body, [
    { text:"حفظ", kind:"primary", onClick: ()=>{
      const date=$("#m_v_date").value || todayISO();
      const type=$("#m_v_type").value;
      const account=$("#m_v_acc").value || "";
      const cashAccount=$("#m_v_cash").value || "1100";
      const cc=$("#m_v_cc").value || "";
      const amount=parseMoney($("#m_v_amount").value);
      const note=$("#m_v_note").value.trim();
      if(!account){ toast("اختر حساب الطرف"); return; }
      if(amount<=0){ toast("المبلغ غير صحيح"); return; }
      const v2={...v, date, type, account, cashAccount, cc, amount, note};

      if(isEdit){
        removeVoucherEffects(v.no);
        state.vouchers[state.vouchers.findIndex(x=>x.no===no)] = v2;
      }else{
        state.vouchers.push(v2);
      }
      applyVoucherEffects(v2);

      saveState(state); closeModal(); toast("تم حفظ السند"); renderVouchers(); renderJournal();
    }},
    { text:"طباعة", onClick: ()=>{
      const date=$("#m_v_date").value || todayISO();
      const type=$("#m_v_type").value;
      const account=$("#m_v_acc").value || "";
      const cashAccount=$("#m_v_cash").value || "1100";
      const cc=$("#m_v_cc").value || "";
      const amount=parseMoney($("#m_v_amount").value);
      const note=$("#m_v_note").value.trim();
      printVoucherObject({...v, date, type, account, cashAccount, cc, amount, note});
    }},
    { text:"إغلاق", onClick: closeModal }
  ]);
  pickAccountOptions($("#m_v_acc"), false);
  pickAccountOptions($("#m_v_cash"), false);
  pickCCOptions($("#m_v_cc"), true);
  $("#m_v_acc").value = v.account || "2200";
  $("#m_v_cash").value = v.cashAccount || "1100";
  $("#m_v_cc").value = v.cc || "";
}
function deleteVoucher(no){
  openModal("تأكيد الحذف", `<div class="muted">حذف السند رقم <b>${no}</b>؟</div>`, [
    { text:"حذف", kind:"danger", onClick: ()=>{
      removeVoucherEffects(no);
      state.vouchers = state.vouchers.filter(x=>x.no!==no);
      saveState(state); closeModal(); toast("تم الحذف"); renderVouchers(); renderJournal();
    }},
    { text:"إلغاء", onClick: closeModal }
  ]);
}
function printVoucher(no){
  const v=state.vouchers.find(x=>x.no===no);
  if(!v){ toast("غير موجود"); return; }
  printVoucherObject(v);
}
function printVoucherObject(v){
  const title=`${v.type} #${v.no}`;
  const html=`
    <div class="box">
      <div class="muted">التاريخ: <b>${v.date}</b></div>
      <div class="muted">حساب الطرف: <b>${v.account} — ${accountName(v.account)}</b></div>
      <div class="muted">الصندوق/البنك: <b>${v.cashAccount} — ${accountName(v.cashAccount)}</b></div>
      <div class="muted">مركز كلفة: <b>${v.cc? (v.cc+" — "+ccName(v.cc)) : "بدون"}</b></div>
    </div>
    <table><thead><tr><th>البيان</th><th>المبلغ</th></tr></thead>
      <tbody><tr><td>${v.note||""}</td><td><b>${money(v.amount||0)}</b></td></tr></tbody></table>`;
  openPrintWindow(title, html);
}
$("#btnPrintVouchersList").addEventListener("click", ()=>{
  const rows=[...state.vouchers].slice().reverse();
  const html=`<table><thead><tr><th>رقم</th><th>تاريخ</th><th>النوع</th><th>الحساب</th><th>المبلغ</th><th>البيان</th></tr></thead>
    <tbody>${rows.map(v=>`<tr><td>${v.no}</td><td>${v.date}</td><td>${v.type}</td><td>${v.account} — ${accountName(v.account)}</td><td>${money(v.amount||0)}</td><td>${v.note||""}</td></tr>`).join("")}</tbody></table>`;
  openPrintWindow("قائمة السندات", html);
});

/* ================= Movement Report ================= */
function renderMovesSetup(){
  pickItemOptions($("#movesItem"), true);
  pickWhOptions($("#movesWh"), true);
  if(!$("#movesFrom").value) $("#movesFrom").value = todayISO().slice(0,8)+"01";
  if(!$("#movesTo").value) $("#movesTo").value = todayISO();
  $("#movesTable tbody").innerHTML = "";
  $("#mvIn").textContent = "0"; $("#mvOut").textContent="0"; $("#mvBal").textContent="0";
}
$("#btnRunMoves").addEventListener("click", runMoves);
function runMoves(){
  const item = $("#movesItem").value;
  const wh = $("#movesWh").value;
  const from = $("#movesFrom").value || "0000-01-01";
  const to = $("#movesTo").value || "9999-12-31";

  let rows = [...state.moves].filter(m=>m.date>=from && m.date<=to);
  if(item) rows = rows.filter(m=>m.itemCode===item);
  if(wh) rows = rows.filter(m=>m.warehouse===wh);
  rows.sort((a,b)=> a.date.localeCompare(b.date));

  let inQty=0, outQty=0;
  for(const r of rows){
    if(r.inOut==="IN") inQty += Number(r.qty||0);
    if(r.inOut==="OUT") outQty += Number(r.qty||0);
  }
  $("#mvIn").textContent = money(inQty);
  $("#mvOut").textContent = money(outQty);
  $("#mvBal").textContent = money(inQty-outQty);

  const tbody=$("#movesTable tbody");
  tbody.innerHTML = rows.length ? "" : `<tr><td colspan="7" class="muted">لا يوجد حركات</td></tr>`;
  for(const r of rows){
    const it=itemByCode(r.itemCode);
    const tr=document.createElement("tr");
    tr.innerHTML = `<td class="mono">${r.date}</td>
      <td>${r.doc} #${r.docNo}</td>
      <td>${r.warehouse} — ${whName(r.warehouse)}</td>
      <td>${r.inOut==="IN"?"دخول":"خروج"}</td>
      <td class="mono">${money(r.qty)}</td>
      <td class="mono">${money(r.cost)}</td>
      <td>${it?it.name:r.itemCode} • ${r.note||""}</td>`;
    tbody.appendChild(tr);
  }
}
$("#btnPrintMoves").addEventListener("click", ()=>{
  runMoves();
  const item = $("#movesItem").value;
  const wh = $("#movesWh").value;
  const from = $("#movesFrom").value || "0000-01-01";
  const to = $("#movesTo").value || "9999-12-31";
  let rows = [...state.moves].filter(m=>m.date>=from && m.date<=to);
  if(item) rows = rows.filter(m=>m.itemCode===item);
  if(wh) rows = rows.filter(m=>m.warehouse===wh);
  rows.sort((a,b)=> a.date.localeCompare(b.date));
  const html = `<div class="box">
    <div class="muted">الفترة: <b>${from}</b> إلى <b>${to}</b></div>
    <div class="muted">المادة: <b>${item? (item+" — "+(itemByCode(item)?.name||"")) : "الكل"}</b></div>
    <div class="muted">المستودع: <b>${wh? (wh+" — "+whName(wh)) : "الكل"}</b></div>
  </div>
  <table><thead><tr><th>تاريخ</th><th>مستند</th><th>مستودع</th><th>نوع</th><th>كمية</th><th>تكلفة</th><th>ملاحظة</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${r.date}</td><td>${r.doc} #${r.docNo}</td><td>${r.warehouse}</td><td>${r.inOut}</td><td>${money(r.qty)}</td><td>${money(r.cost)}</td><td>${(itemByCode(r.itemCode)?.name||r.itemCode)} • ${r.note||""}</td></tr>`).join("")}</tbody></table>`;
  openPrintWindow("حركة مادة", html);
});

/* ================= Stocktake ================= */
function renderStocktakeSetup(){
  pickWhOptions($("#stWh"), true);
  $("#stocktakeTable tbody").innerHTML = "";
}
$("#btnRunStocktake").addEventListener("click", runStocktake);
function runStocktake(){
  const wh = $("#stWh").value; // "" => all
  const rows = [];
  for(const it of [...state.items].sort((a,b)=>a.code.localeCompare(b.code))){
    if(wh){
      const info = avgCostForItemInWh(it.code, wh);
      const qty = Math.max(0, info.onHand);
      const val = qty*info.avg;
      rows.push({ code:it.code, name:it.name, unit:it.unit, qty, avg:info.avg, val });
    }else{
      // all warehouses
      let qty=0, val=0, costBase=0, qtyCost=0;
      for(const w of state.warehouses){
        const info = avgCostForItemInWh(it.code, w.code);
        const q = Math.max(0, info.onHand);
        qty += q;
        val += q*info.avg;
        qtyCost += q;
        costBase += q*info.avg;
      }
      const avg = qtyCost>0 ? (costBase/qtyCost) : Number(it.purchasePrice||0);
      rows.push({ code:it.code, name:it.name, unit:it.unit, qty, avg, val });
    }
  }
  const tbody=$("#stocktakeTable tbody");
  tbody.innerHTML = rows.length ? "" : `<tr><td colspan="6" class="muted">لا يوجد مواد</td></tr>`;
  for(const r of rows){
    const tr=document.createElement("tr");
    tr.innerHTML = `<td class="mono">${r.code}</td><td>${r.name}</td><td>${r.unit}</td><td class="mono"><b>${money(r.qty)}</b></td><td class="mono">${money(r.avg)}</td><td class="mono">${money(r.val)}</td>`;
    tbody.appendChild(tr);
  }
}
$("#btnPrintStocktake").addEventListener("click", ()=>{
  runStocktake();
  const wh = $("#stWh").value;
  const title = wh ? `جرد مواد — ${wh} (${whName(wh)})` : "جرد مواد — كل المستودعات";
  const rows = $$("#stocktakeTable tbody tr").map(tr=>({
    code: tr.children[0].textContent,
    name: tr.children[1].textContent,
    unit: tr.children[2].textContent,
    qty: tr.children[3].textContent,
    avg: tr.children[4].textContent,
    val: tr.children[5].textContent
  }));
  const html = `<div class="box"><div class="muted">المستودع: <b>${wh? (wh+" — "+whName(wh)) : "الكل"}</b></div></div>
    <table><thead><tr><th>كود</th><th>المادة</th><th>وحدة</th><th>رصيد</th><th>متوسط تكلفة</th><th>قيمة</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${r.code}</td><td>${r.name}</td><td>${r.unit}</td><td>${r.qty}</td><td>${r.avg}</td><td>${r.val}</td></tr>`).join("")}</tbody></table>`;
  openPrintWindow(title, html);
});

/* ================= Cost Centers ================= */
function renderCC(){
  const q=($("#ccSearch").value||"").trim().toLowerCase();
  const rows=[...state.costCenters].filter(c=>!q || (c.code+c.name).toLowerCase().includes(q)).sort((a,b)=>a.code.localeCompare(b.code));
  const tbody=$("#ccTable tbody"); tbody.innerHTML="";
  for(const c of rows){
    const tr=document.createElement("tr");
    tr.innerHTML = `<td class="mono">${c.code}</td><td>${c.name}</td>
      <td class="ta-left"><div class="chips">
        <button class="btn" data-edit="${c.code}">تعديل</button>
        <button class="btn danger" data-del="${c.code}">حذف</button>
      </div></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("button[data-edit]").forEach(b=>b.addEventListener("click",()=>openCCModal(b.dataset.edit)));
  tbody.querySelectorAll("button[data-del]").forEach(b=>b.addEventListener("click",()=>deleteCC(b.dataset.del)));
}
$("#ccSearch").addEventListener("input", renderCC);
$("#btnAddCC").addEventListener("click", ()=>openCCModal(null));

function ccIsUsed(code){
  return state.journals.some(j => (j.lines||[]).some(l=>l.cc===code)) || state.vouchers.some(v=>v.cc===code);
}
function openCCModal(code){
  const isEdit=!!code;
  const c=isEdit ? state.costCenters.find(x=>x.code===code) : { code:"", name:"" };
  const body=`<div class="form-grid">
    <div class="field"><label>كود المركز</label><input id="m_cc_code" type="text" value="${c.code}" placeholder="CC-003" ${isEdit?"disabled":""}/></div>
    <div class="field"><label>اسم المركز</label><input id="m_cc_name" type="text" value="${c.name}" placeholder="المخزن"/></div>
  </div>`;
  openModal(isEdit?"تعديل مركز":"إضافة مركز", body, [
    {text:"حفظ", kind:"primary", onClick: ()=>{
      const code2=$("#m_cc_code").value.trim();
      const name=$("#m_cc_name").value.trim();
      if(!code2 || !name){ toast("أكمل البيانات"); return; }
      if(!isEdit && state.costCenters.some(x=>x.code===code2)){ toast("الكود موجود"); return; }
      if(isEdit){
        state.costCenters[state.costCenters.findIndex(x=>x.code===code)] = { code:code, name };
      }else{
        state.costCenters.push({ code:code2, name });
      }
      saveState(state); closeModal(); toast("تم الحفظ"); renderCC();
    }},
    {text:"إلغاء", onClick: closeModal}
  ]);
}
function deleteCC(code){
  if(ccIsUsed(code)){ toast("لا يمكن حذف المركز لأنه مستخدم"); return; }
  openModal("تأكيد الحذف", `<div class="muted">حذف مركز الكلفة <b>${code}</b>؟</div>`, [
    {text:"حذف", kind:"danger", onClick: ()=>{
      state.costCenters = state.costCenters.filter(x=>x.code!==code);
      saveState(state); closeModal(); toast("تم الحذف"); renderCC();
    }},
    {text:"إلغاء", onClick: closeModal}
  ]);
}
$("#btnPrintCC").addEventListener("click", ()=>{
  const rows=[...state.costCenters].sort((a,b)=>a.code.localeCompare(b.code));
  const html=`<table><thead><tr><th>كود</th><th>اسم المركز</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${c.code}</td><td>${c.name}</td></tr>`).join("")}</tbody></table>`;
  openPrintWindow("مراكز الكلفة", html);
});

/* ================= Journal (list + manual entry) ================= */
function renderJournal(){
  const q=($("#journalSearch").value||"").trim();
  const rows=[...state.journals].filter(j=>!q || (j.no+j.note+j.docRef+j.date).includes(q)).slice().reverse();
  const tbody=$("#journalTable tbody"); tbody.innerHTML="";
  for(const j of rows){
    const d = (j.lines||[]).reduce((s,l)=>s+Number(l.debit||0),0);
    const c = (j.lines||[]).reduce((s,l)=>s+Number(l.credit||0),0);
    const tr=document.createElement("tr");
    tr.innerHTML = `<td class="mono">${j.no}</td><td class="mono">${j.date}</td>
      <td>${j.system? `<span class="chip">نظام</span> `:""}${j.note}${j.docRef?` <span class="muted small">(${j.docRef})</span>`:""}</td>
      <td class="mono">${money(d)}</td><td class="mono">${money(c)}</td>
      <td class="ta-left"><div class="chips">
        <button class="btn" data-open="${j.no}">فتح</button>
        ${j.system? "" : `<button class="btn danger" data-del="${j.no}">حذف</button>`}
      </div></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("button[data-open]").forEach(b=>b.addEventListener("click",()=>openJournalModal(b.dataset.open)));
  tbody.querySelectorAll("button[data-del]").forEach(b=>b.addEventListener("click",()=>deleteJournal(b.dataset.del)));
}
$("#journalSearch").addEventListener("input", renderJournal);
$("#btnNewJournal").addEventListener("click", ()=>openJournalModal(null));

function openJournalModal(no){
  const isEdit = !!no;
  const j = isEdit ? state.journals.find(x=>x.no===no) : { no:"(سيُولد تلقائياً)", date:todayISO(), note:"", system:false, docRef:"", lines:[] };

  const body = `
    <div class="form-grid">
      <div class="field"><label>التاريخ</label><input id="m_j_date" type="date" value="${j.date}" ${j.system?"disabled":""}/></div>
      <div class="field" style="grid-column:1/-1"><label>البيان</label><input id="m_j_note" type="text" value="${j.note||""}" placeholder="بيان القيد..." ${j.system?"disabled":""}/></div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="card-title">بنود القيد</div>
      <div class="toolbar" style="margin-top:10px">
        <select id="m_j_acc"></select>
        <select id="m_j_cc"></select>
        <input id="m_j_debit" type="number" step="0.01" placeholder="مدين" style="max-width:140px" />
        <input id="m_j_credit" type="number" step="0.01" placeholder="دائن" style="max-width:140px" />
        <button class="btn primary" id="btnAddJLine" ${j.system?"disabled":""}>إضافة</button>
      </div>
      <div class="table-wrap">
        <table class="table" style="min-width:700px">
          <thead><tr><th>الحساب</th><th>مركز كلفة</th><th>مدين</th><th>دائن</th><th class="ta-left">—</th></tr></thead>
          <tbody id="m_j_lines"></tbody>
        </table>
      </div>
      <div class="muted small mt">يجب توازن القيد (مدين = دائن).</div>
    </div>
  `;

  openModal(isEdit?`قيد #${j.no}`:"قيد جديد", body, [
    ...(j.system ? [] : [{
      text:"حفظ", kind:"primary", onClick: ()=>{
        const date = $("#m_j_date").value || todayISO();
        const note = $("#m_j_note").value.trim();
        const lines = currentJournalLines();
        if(!note){ toast("اكتب البيان"); return; }
        if(lines.length<2){ toast("أضف بندين على الأقل"); return; }
        const d = lines.reduce((s,l)=>s+Number(l.debit||0),0);
        const c = lines.reduce((s,l)=>s+Number(l.credit||0),0);
        if(Math.abs(d-c) > 0.0001){ toast("القيد غير متوازن"); return; }

        postJournal({ date, note, system:false, docRef:"", lines });
        saveState(state); closeModal(); toast("تم حفظ القيد");
        renderJournal(); renderGLSetup(); renderStatementSetup();
      }
    }]),
    { text:"طباعة", onClick: ()=>{
      const lines = (isEdit? j.lines : currentJournalLines());
      const html = `<div class="box">
        <div class="muted">رقم القيد: <b>${isEdit?j.no:"—"}</b></div>
        <div class="muted">التاريخ: <b>${isEdit?j.date:($("#m_j_date").value||todayISO())}</b></div>
        <div class="muted">البيان: <b>${isEdit?j.note:($("#m_j_note").value||"")}</b></div>
      </div>
      <table><thead><tr><th>الحساب</th><th>مركز كلفة</th><th>مدين</th><th>دائن</th></tr></thead>
        <tbody>${lines.map(l=>`<tr><td>${l.account} — ${accountName(l.account)}</td><td>${l.cc? (l.cc+" — "+ccName(l.cc)) : "بدون"}</td><td>${money(l.debit)}</td><td>${money(l.credit)}</td></tr>`).join("")}</tbody></table>`;
      openPrintWindow("قيد يومية", html);
    }},
    { text:"إغلاق", onClick: closeModal }
  ]);

  pickAccountOptions($("#m_j_acc"), false);
  pickCCOptions($("#m_j_cc"), true);
  $("#m_j_debit").value = "";
  $("#m_j_credit").value = "";

  setJournalLines(j.lines||[], j.system);

  $("#btnAddJLine")?.addEventListener("click", ()=>{
    if(j.system) return;
    const acc = $("#m_j_acc").value;
    const cc = $("#m_j_cc").value || "";
    const debit = parseMoney($("#m_j_debit").value);
    const credit = parseMoney($("#m_j_credit").value);
    if(!acc){ toast("اختر حساب"); return; }
    if((debit>0 && credit>0) || (debit<=0 && credit<=0)){ toast("أدخل مدين أو دائن"); return; }
    const lines = currentJournalLines();
    lines.push({ account: acc, cc, debit, credit });
    setJournalLines(lines, false);
    $("#m_j_debit").value = "";
    $("#m_j_credit").value = "";
  });
}
function setJournalLines(lines, readOnly){
  const tbody=$("#m_j_lines"); tbody.innerHTML="";
  for(const l of lines){
    const tr=document.createElement("tr");
    tr.dataset.acc=l.account;
    tr.dataset.cc=l.cc||"";
    tr.dataset.debit=String(Number(l.debit||0));
    tr.dataset.credit=String(Number(l.credit||0));
    tr.innerHTML = `<td class="mono">${l.account} — ${accountName(l.account)}</td>
      <td>${l.cc? (l.cc+" — "+ccName(l.cc)):"بدون"}</td>
      <td class="mono">${money(l.debit||0)}</td>
      <td class="mono">${money(l.credit||0)}</td>
      <td class="ta-left">${readOnly? "" : `<button class="btn danger" data-rm>حذف</button>`}</td>`;
    tbody.appendChild(tr);
    if(!readOnly){
      tr.querySelector("[data-rm]").addEventListener("click", ()=>{ tr.remove(); });
    }
  }
}
function currentJournalLines(){
  return $$("#m_j_lines tr").map(tr=>({
    account: tr.dataset.acc,
    cc: tr.dataset.cc || "",
    debit: Number(tr.dataset.debit||0),
    credit: Number(tr.dataset.credit||0)
  }));
}
function deleteJournal(no){
  openModal("تأكيد الحذف", `<div class="muted">حذف القيد رقم <b>${no}</b>؟</div>`, [
    {text:"حذف", kind:"danger", onClick: ()=>{
      state.journals = state.journals.filter(x=>x.no!==no || x.system);
      saveState(state); closeModal(); toast("تم الحذف"); renderJournal();
    }},
    {text:"إلغاء", onClick: closeModal}
  ]);
}
$("#btnPrintJournalList").addEventListener("click", ()=>{
  const rows=[...state.journals].slice().reverse();
  const html=`<table><thead><tr><th>رقم</th><th>تاريخ</th><th>بيان</th><th>نوع</th></tr></thead>
    <tbody>${rows.map(j=>`<tr><td>${j.no}</td><td>${j.date}</td><td>${j.note} ${j.docRef?("("+j.docRef+")"):""}</td><td>${j.system?"نظام":"يدوي"}</td></tr>`).join("")}</tbody></table>`;
  openPrintWindow("قائمة القيود", html);
});

/* ================= GL ================= */
function renderGLSetup(){
  pickAccountOptions($("#glAccount"), false);
  if(!$("#glFrom").value) $("#glFrom").value = todayISO().slice(0,8)+"01";
  if(!$("#glTo").value) $("#glTo").value = todayISO();
  $("#glTable tbody").innerHTML = "";
  $("#glDebit").textContent="0"; $("#glCredit").textContent="0"; $("#glBalance").textContent="0";
}
$("#btnRunGL").addEventListener("click", runGL);
function runGL(){
  const acc = $("#glAccount").value;
  if(!acc){ toast("اختر حساب"); return; }
  const from=$("#glFrom").value || "0000-01-01";
  const to=$("#glTo").value || "9999-12-31";
  const rows = ledgerRows().filter(r=>r.account===acc).filter(r=>r.date>=from && r.date<=to).sort((a,b)=>a.date.localeCompare(b.date));
  let d=0,c=0;
  for(const r of rows){ d+=Number(r.debit||0); c+=Number(r.credit||0); }
  $("#glDebit").textContent = money(d);
  $("#glCredit").textContent = money(c);
  $("#glBalance").textContent = money(d-c);

  const tbody=$("#glTable tbody");
  tbody.innerHTML = rows.length ? "" : `<tr><td colspan="6" class="muted">لا يوجد حركات</td></tr>`;
  for(const r of rows){
    const tr=document.createElement("tr");
    tr.innerHTML = `<td class="mono">${r.date}</td><td>${r.ref}</td><td>${r.note}</td><td>${r.cc? (r.cc+" — "+ccName(r.cc)):"—"}</td><td class="mono">${money(r.debit||0)}</td><td class="mono">${money(r.credit||0)}</td>`;
    tbody.appendChild(tr);
  }
}
$("#btnPrintGL").addEventListener("click", ()=>{
  runGL();
  const acc = $("#glAccount").value;
  if(!acc) return;
  const from=$("#glFrom").value || "0000-01-01";
  const to=$("#glTo").value || "9999-12-31";
  const rows = ledgerRows().filter(r=>r.account===acc).filter(r=>r.date>=from && r.date<=to).sort((a,b)=>a.date.localeCompare(b.date));
  let d=0,c=0;
  for(const r of rows){ d+=Number(r.debit||0); c+=Number(r.credit||0); }
  const html = `<div class="box">
    <div class="muted">الحساب: <b>${acc} — ${accountName(acc)}</b></div>
    <div class="muted">الفترة: <b>${from}</b> إلى <b>${to}</b></div>
  </div>
  <table><thead><tr><th>تاريخ</th><th>قيد/مستند</th><th>بيان</th><th>مركز كلفة</th><th>مدين</th><th>دائن</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${r.date}</td><td>${r.ref}</td><td>${r.note}</td><td>${r.cc||""}</td><td>${money(r.debit)}</td><td>${money(r.credit)}</td></tr>`).join("")}</tbody></table>
  <div class="tot"><div class="pill">مدين: <b>${money(d)}</b></div><div class="pill">دائن: <b>${money(c)}</b></div><div class="pill">الرصيد: <b>${money(d-c)}</b></div></div>`;
  openPrintWindow("دفتر الأستاذ", html);
});

/* ================= Statement (same as GL but simpler) ================= */
function renderStatementSetup(){
  pickAccountOptions($("#statementAccount"), false);
  if(!$("#statementFrom").value) $("#statementFrom").value = todayISO().slice(0,8)+"01";
  if(!$("#statementTo").value) $("#statementTo").value = todayISO();
}
$("#btnRunStatement").addEventListener("click", runStatement);
function runStatement(){
  const acc=$("#statementAccount").value;
  if(!acc){ toast("اختر حساب"); return; }
  const from=$("#statementFrom").value || "0000-01-01";
  const to=$("#statementTo").value || "9999-12-31";
  const led=ledgerRows().filter(e=>e.account===acc).filter(e=>e.date>=from && e.date<=to).sort((a,b)=>a.date.localeCompare(b.date));
  let debit=0, credit=0;
  for(const e of led){ debit+=Number(e.debit||0); credit+=Number(e.credit||0); }
  const balance = debit - credit;
  $("#stDebit").textContent = money(debit);
  $("#stCredit").textContent = money(credit);
  $("#stBalance").textContent = money(balance);
  const tbody=$("#statementTable tbody");
  tbody.innerHTML = led.length ? "" : `<tr><td colspan="5" class="muted">لا يوجد حركات ضمن الفترة</td></tr>`;
  for(const e of led){
    const tr=document.createElement("tr");
    tr.innerHTML=`<td class="mono">${e.date}</td><td>${e.ref}</td><td>${e.note||""}</td><td class="mono">${money(e.debit||0)}</td><td class="mono">${money(e.credit||0)}</td>`;
    tbody.appendChild(tr);
  }
}
$("#btnPrintStatement").addEventListener("click", ()=>{
  runStatement();
  const acc=$("#statementAccount").value;
  if(!acc) return;
  const from=$("#statementFrom").value || "0000-01-01";
  const to=$("#statementTo").value || "9999-12-31";
  const led=ledgerRows().filter(e=>e.account===acc).filter(e=>e.date>=from && e.date<=to).sort((a,b)=>a.date.localeCompare(b.date));
  let debit=0, credit=0;
  for(const e of led){ debit+=Number(e.debit||0); credit+=Number(e.credit||0); }
  const balance = debit - credit;
  const html=`
    <div class="box">
      <div class="muted">الحساب: <b>${acc} — ${accountName(acc)}</b></div>
      <div class="muted">الفترة: <b>${from}</b> إلى <b>${to}</b></div>
    </div>
    <table><thead><tr><th>تاريخ</th><th>مستند</th><th>بيان</th><th>مدين</th><th>دائن</th></tr></thead>
      <tbody>${led.map(e=>`<tr><td>${e.date}</td><td>${e.ref}</td><td>${e.note||""}</td><td>${money(e.debit||0)}</td><td>${money(e.credit||0)}</td></tr>`).join("")}</tbody></table>
    <div class="tot">
      <div class="pill">مدين: <b>${money(debit)}</b></div>
      <div class="pill">دائن: <b>${money(credit)}</b></div>
      <div class="pill">الرصيد: <b>${money(balance)}</b></div>
    </div>`;
  openPrintWindow("كشف حساب", html);
});

/* ================= Users ================= */
function renderUsers(){
  const tbody=$("#usersTable tbody"); tbody.innerHTML="";
  for(const u of state.users){
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td class="mono"><b>${u.username}</b></td>
      <td>${u.role}</td>
      <td class="ta-left"><div class="chips">
        <button class="btn" data-pass="${u.username}">تغيير كلمة المرور</button>
        ${u.username==="admin"?"":`<button class="btn danger" data-del="${u.username}">حذف</button>`}
      </div></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll("button[data-pass]").forEach(b=>b.addEventListener("click",()=>changePassword(b.dataset.pass)));
  tbody.querySelectorAll("button[data-del]").forEach(b=>b.addEventListener("click",()=>deleteUser(b.dataset.del)));
}
$("#btnAddUser").addEventListener("click", ()=>{
  const body=`
    <div class="form-grid">
      <div class="field"><label>اسم المستخدم</label><input id="m_u_name" type="text" placeholder="user1" /></div>
      <div class="field"><label>كلمة المرور</label><input id="m_u_pass" type="password" placeholder="••••••" /></div>
      <div class="field"><label>الدور</label>
        <select id="m_u_role"><option value="user">user</option><option value="admin">admin</option></select>
      </div>
    </div>`;
  openModal("إضافة مستخدم", body, [
    { text:"حفظ", kind:"primary", onClick: ()=>{
      const username=$("#m_u_name").value.trim();
      const password=$("#m_u_pass").value;
      const role=$("#m_u_role").value;
      if(!username || !password){ toast("أكمل البيانات"); return; }
      if(state.users.some(x=>x.username===username)){ toast("اسم المستخدم موجود"); return; }
      state.users.push({ username, password, role });
      saveState(state); closeModal(); toast("تمت الإضافة"); renderUsers();
    }},
    { text:"إلغاء", onClick: closeModal }
  ]);
});
function changePassword(username){
  const body=`<div class="field"><label>كلمة مرور جديدة لـ <b class="mono">${username}</b></label><input id="m_new_pass" type="password" placeholder="••••••" /></div>`;
  openModal("تغيير كلمة المرور", body, [
    { text:"حفظ", kind:"primary", onClick: ()=>{
      const pass=$("#m_new_pass").value;
      if(!pass){ toast("أدخل كلمة مرور"); return; }
      state.users[state.users.findIndex(x=>x.username===username)].password = pass;
      saveState(state); closeModal(); toast("تم التغيير");
    }},
    { text:"إلغاء", onClick: closeModal }
  ]);
}
function deleteUser(username){
  openModal("تأكيد الحذف", `<div class="muted">حذف المستخدم <b class="mono">${username}</b>؟</div>`, [
    { text:"حذف", kind:"danger", onClick: ()=>{
      state.users = state.users.filter(x=>x.username!==username);
      saveState(state); closeModal(); toast("تم الحذف"); renderUsers();
    }},
    { text:"إلغاء", onClick: closeModal }
  ]);
}

/* ================= Boot ================= */
function refreshHeader(){
  $("#companyNameTop").textContent = state.company?.name || "الشركة";
  const u=currentUser();
  $("#roleBadge").textContent = u ? `Role: ${u.role}` : "—";
  $("#userNameSide").textContent = u ? u.username : "—";
  $("#userRoleSide").textContent = u ? (u.role==="admin" ? "أدمن" : "مستخدم") : "—";
  $("#userAvatar").textContent = u ? u.username.slice(0,1).toUpperCase() : "A";
}
function bootApp(){
  state = seedIfEmpty();
  if(!currentUser()){
    $("#appView").classList.add("hidden");
    $("#loginView").classList.remove("hidden");
    return;
  }
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");

  ensureDrawerDim();
  refreshHeader();
  renderNav();

  const hash = location.hash.replace("#","");
  const first = allowedNav()[0]?.id || "dashboard";
  go(hash || first);
  renderDashboard();
}
window.addEventListener("hashchange", ()=>{
  const id = location.hash.replace("#","");
  if(id) go(id);
});

bootApp();


/* Bottom bar quick navigation (mobile app-like) */
function setActiveBottom(id){
  const btns = document.querySelectorAll(".bottombar .bbtn");
  btns.forEach(b=> b.classList.toggle("active", b.dataset.go===id));
}
document.querySelectorAll(".bottombar .bbtn").forEach(b=>{
  b.addEventListener("click", ()=>{
    const id = b.dataset.go;
    if(id) go(id);
  });
});
