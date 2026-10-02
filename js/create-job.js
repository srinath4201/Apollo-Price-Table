// Create Job page: header, contact info, Add Product menu, products table, price details.
// The product popup lives in js/job-product.js (openJobProduct); Select Report → Quotation lives in js/job-quotes.js.
// create-job.html?ref=ON5483 opens the same page as Edit Job (job loaded from js/job-store.js).

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const todayDMY = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`; };

$("dCreated").value = todayDMY();

// ---------- Product groups for "Add Product" ----------
const PRODUCT_GROUPS = [
  { name: "Ungroup Products", products: ["Test product", "Alpha test"] },
  {
    name: "Rollers",
    products: ["Zebra Blinds", "Roller Blinds", "Curtain Production", "Rolshade", "Test Roller Blinds", "Misc", "Test Roller", "Roller_Testt", "Dual Roller Blind", "Ping Blinds"],
    subGroups: [
      { name: "Sub Group A1", products: ["Excel Roller (DEC) EDI 2024"] },
      { name: "A2", products: ["Easy Fit Roller (Arena) EDI 2025"] },
      { name: "A3", products: ["Roller TDI"] }
    ]
  },
  { name: "Soft Furnishing", products: ["Curtain InHouse", "Curtain (Kensington Blinds)", "Romans (Darpan)"] },
  { name: "Outdoor Products", products: ["Markilux 990", "Markilux MX-3", "Markilux 5010", "Markilux MX-4", "Puma S-300 Awning", "Ziptrak Blinds"] },
  { name: "Verts", products: ["Verticals", "Verticals (Arena) EDI Old", "Vertical Louvers only"] },
  { name: "Venetian", products: ["Fauxwood Venetian", "Aluminium Venetian (DEC) EDI", "Timberlux EDI", "Sunwood EDI"] },
  { name: "Shutters", products: ["Shutter New", "Ecowood Plus Shutter"] },
  { name: "DMI", products: ["TD77 Doors"] }
];

// products created with "+ Product" are listed in their Product Group
ProductStore.customProducts().forEach(p => {
  const g = PRODUCT_GROUPS.find(x => x.name.toLowerCase() === String(p.group || "Ungroup products").toLowerCase()) || PRODUCT_GROUPS[0];
  if (!g.products.some(n => n.toLowerCase() === p.name.toLowerCase())) g.products.unshift(p.name);
});

// ---------- Job products ----------
// { product, group, description, cost, qty, unit, net, vat, data }
const jobItems = [];

// Quote versions. The current version's items are always the jobItems array itself.
const job = { quotes: { Q1: { status: "Draft", items: jobItems } }, current: "Q1", activity: [] };
const quoteIds = () => Object.keys(job.quotes).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
const quoteItems = id => (id === job.current ? jobItems : job.quotes[id].items);
const expanded = new Set();
const COLS = [
  { key: "product", cls: "jc-product" },
  { key: "description", cls: "jc-desc" },
  { key: "cost", cls: "jc-num" },
  { key: "qty", cls: "jc-num" },
  { key: "unit", cls: "jc-unit" },
  { key: "net", cls: "jc-num" },
  { key: "vat", cls: "jc-vat" }
];
const filters = COLS.map(() => "");

const searchSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa6ad" stroke-width="2.4"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>`;
$("jobFilterRow").innerHTML = `<th class="jc-chk"></th><th class="jc-exp"></th>` +
  COLS.map((c, i) => `<th class="${c.cls}"><div class="jt-search"><button type="button" class="jt-sbtn" data-col="${i}" title="Search">${searchSvg}</button><input class="jt-sinput" data-col="${i}" placeholder="Search" autocomplete="off"></div></th>`).join("") +
  `<th class="jc-menu"></th><th class="jc-set"></th>`;

const cellText = (it, key) => (["cost", "unit", "net", "vat"].includes(key) ? `£ ${money(it[key])}` : String(it[key]));
const expIcon = `<svg width="9" height="6" viewBox="0 0 9 6" fill="none" stroke="#fff" stroke-width="1.8"><path d="M1 1l3.5 3.5L8 1"/></svg>`;
const selected = new Set();

function renderJob() {
  const q = filters.map(f => f.trim().toLowerCase());
  const rows = jobItems.map((it, i) => ({ it, i })).filter(({ it }) => COLS.every((c, k) => !q[k] || cellText(it, c.key).toLowerCase().includes(q[k])));
  $("jobRows").innerHTML = rows.length
    ? rows.map(({ it, i }) => `<tr>
        <td class="jc-chk"><input type="checkbox" class="jt-chk" data-i="${i}" ${selected.has(i) ? "checked" : ""} aria-label="Select ${esc(it.product)}"></td>
        <td class="jc-exp"><button type="button" class="jt-exp${expanded.has(i) ? " open" : ""}" data-i="${i}" title="Show details">${expIcon}</button></td>
        <td class="left"><button type="button" class="p-link" data-edit="${i}" title="Edit ${esc(it.product)}">${esc(it.product)}</button></td>
        <td class="left jt-desc" title="${esc(it.description)}">${descCell(it)}</td>
        <td>£ ${money(it.cost)}</td>
        <td>${it.qty}</td>
        <td>£ ${money(it.unit)}</td>
        <td>£ ${money(it.net)}</td>
        <td>£ ${money(it.vat)}</td>
        <td class="jc-menu"><button type="button" class="kebab" data-menu="${i}" title="Actions"><i></i><i></i><i></i></button></td>
        <td class="jc-set"></td>
      </tr>${expanded.has(i) ? detailRow(it) : ""}`).join("")
    : `<tr class="empty"><td colspan="11">${jobItems.length ? "No products match your search" : "No rows to show"}</td></tr>`;

  const all = jobItems.length > 0 && jobItems.every((_, i) => selected.has(i));
  $("jobCheckAll").checked = all;
  updateTotals();
}

// description + location + optional extras (extras come from the quotation flow)
function descCell(it) {
  const loc = it.data?.values?.Room || it.data?.values?.Location || "";
  const extras = (it.extras || []).map(x => x.name).join(", ");
  return `<span class="jd-main">${esc(it.description)}</span>` +
    (loc ? `<span class="jd-sub">Location: ${esc(loc)}</span>` : "") +
    (extras ? `<span class="jd-sub"><b>Extras:</b> ${esc(extras)}</span>` : "");
}

function detailRow(it) {
  // every filled-in field from the product popup (fields come from Fields and Values)
  const values = Object.entries(it.data.values || {}).filter(([, v]) => v !== "");
  const status = it.data.status ? [["Status", it.data.status]] : [];
  const extras = it.extras && it.extras.length ? [["Optional extras", it.extras.map(x => `${x.name} (+£ ${money(x.price)})`).join(", ")]] : [];
  const pairs = [...values, ...status, ...extras];
  return `<tr class="detail"><td colspan="11"><dl>${pairs.length
    ? pairs.map(([k, v]) => `<div><dt>${esc(k)}:</dt><dd>${esc(v)}</dd></div>`).join("")
    : "<div>No details</div>"}</dl></td></tr>`;
}

function updateTotals() {
  const sum = k => jobItems.reduce((a, it) => a + (Number(it[k]) || 0), 0);
  const net = sum("net");
  const vatOn = $("vatToggle").getAttribute("aria-pressed") === "true";
  const vat = vatOn ? sum("vat") : 0;
  $("totCost").textContent = `£ ${money(sum("cost"))}`;
  $("totQty").textContent = String(sum("qty"));
  $("totUnit").textContent = `£ ${money(sum("unit"))}`;
  $("totNet").textContent = `£ ${money(net)}`;
  $("totVat").textContent = `£ ${money(sum("vat"))}`;
  $("pNet").textContent = money(net);
  $("pVat").textContent = money(vat);
  $("pGross").textContent = money(net + vat);
  const paid = 0;
  $("pPaid").textContent = money(paid);
  $("pOutstanding").textContent = money(net + vat - paid);
}

// called by js/job-product.js when the product popup is saved
function saveJobItem(item, index) {
  if (index === null || index === undefined) jobItems.push(item);
  else jobItems[index] = item;
  closeContact(); // show the products table
  renderJob();
  flash(`${item.product} ${index == null ? "added" : "updated"}`, true);
}

// table interactions
$("jobRows").addEventListener("click", e => {
  const exp = e.target.closest(".jt-exp");
  if (exp) { const i = +exp.dataset.i; expanded.has(i) ? expanded.delete(i) : expanded.add(i); renderJob(); return; }
  const edit = e.target.closest("[data-edit]");
  if (edit) { const i = +edit.dataset.edit; openJobProduct({ ...jobItems[i], index: i }); return; }
  const k = e.target.closest("[data-menu]");
  if (k) openRowMenu(+k.dataset.menu, k);
});
$("jobRows").addEventListener("change", e => {
  if (!e.target.classList.contains("jt-chk")) return;
  const i = +e.target.dataset.i;
  e.target.checked ? selected.add(i) : selected.delete(i);
  renderJob();
});
$("jobCheckAll").addEventListener("change", e => {
  jobItems.forEach((_, i) => (e.target.checked ? selected.add(i) : selected.delete(i)));
  renderJob();
});
$("jobExpandAll").addEventListener("click", () => {
  const allOpen = jobItems.length && jobItems.every((_, i) => expanded.has(i));
  jobItems.forEach((_, i) => (allOpen ? expanded.delete(i) : expanded.add(i)));
  renderJob();
});
$("jobFilterRow").addEventListener("click", e => {
  const b = e.target.closest(".jt-sbtn");
  if (!b) return;
  const box = b.parentElement;
  box.classList.add("open");
  box.querySelector("input").focus();
});
$("jobFilterRow").addEventListener("input", e => { filters[+e.target.dataset.col] = e.target.value; renderJob(); });
$("jobFilterRow").addEventListener("focusout", e => {
  if (e.target.classList.contains("jt-sinput") && !e.target.value) e.target.parentElement.classList.remove("open");
});

// row ⋮ menu
const rowMenu = $("jobRowMenu");
let menuRow = null;
function openRowMenu(i, btn) {
  if (menuRow === i) return closeRowMenu();
  menuRow = i;
  const r = btn.getBoundingClientRect();
  rowMenu.hidden = false;
  rowMenu.style.top = `${r.top + r.height / 2 - rowMenu.offsetHeight / 2}px`;
  rowMenu.style.left = `${r.left - 12 - rowMenu.offsetWidth}px`;
}
function closeRowMenu() { menuRow = null; rowMenu.hidden = true; }
rowMenu.addEventListener("click", e => {
  const a = e.target.closest("[data-row-action]");
  if (!a || menuRow === null) return;
  const i = menuRow;
  closeRowMenu();
  if (a.dataset.rowAction === "edit") { openJobProduct({ ...jobItems[i], index: i }); return; }
  const shift = set => { const v = [...set].filter(x => x !== i).map(x => (x > i ? x - 1 : x)); set.clear(); v.forEach(x => set.add(x)); };
  const [removed] = jobItems.splice(i, 1);
  shift(selected); shift(expanded);
  renderJob();
  flash(`${removed.product} removed`, true);
});
document.addEventListener("click", e => { if (menuRow !== null && !rowMenu.contains(e.target) && !e.target.closest("[data-menu]")) closeRowMenu(); });
$("jobGrid").addEventListener("scroll", () => {
  closeRowMenu();
  $("jobTotal").scrollLeft = $("jobGrid").scrollLeft; // keep totals under their columns
});

// VAT switch in Price Details
$("vatToggle").addEventListener("click", e => {
  const t = e.currentTarget;
  const on = t.classList.toggle("off") === false;
  t.firstChild.textContent = on ? "ON" : "OFF";
  t.setAttribute("aria-pressed", String(on));
  updateTotals();
});

// ---------- Contact Info open / close ----------
const contactPanel = $("contactPanel");
function openContact() {
  contactPanel.hidden = false;
  $("contactOpen").hidden = true;
  $("contactOpen").setAttribute("aria-expanded", "true");
}
function closeContact() {
  contactPanel.hidden = true;
  $("contactOpen").hidden = false;
  $("contactOpen").setAttribute("aria-expanded", "false");
}
$("contactOpen").addEventListener("click", openContact);
$("contactClose").addEventListener("click", closeContact);
$("contactOpen").hidden = true; // panel starts open

// Additional contacts side tab
$("additionalContacts").addEventListener("click", e => {
  const open = $("additionalPanel").hidden;
  $("additionalPanel").hidden = !open;
  e.currentTarget.setAttribute("aria-expanded", String(open));
});

// Contact search (sample contacts)
const CONTACTS = [
  { title: "Mr", first: "John", last: "Smith", email: "john.smith@example.com", phone: "020 7946 0018", mobile: "07700 900123", company: "", address1: "12 High Street", town: "London", state: "Greater London", zip: "SW1A 1AA" },
  { title: "Mrs", first: "Priya", last: "Raj", email: "priya.raj@example.com", phone: "0161 496 0342", mobile: "07700 900456", company: "Raj Interiors", address1: "4 Mill Lane", town: "Manchester", state: "Lancashire", zip: "M1 2AB" },
  { title: "Mr", first: "Hem", last: "Patel", email: "hem.patel@example.com", phone: "0121 496 0775", mobile: "07700 900789", company: "Patel Homes", address1: "88 Station Road", town: "Birmingham", state: "West Midlands", zip: "B1 1BB" }
];
const results = $("contactResults");
function showContacts() {
  const q = $("contactSearch").value.trim().toLowerCase();
  if (!q) { results.hidden = true; return; }
  const found = CONTACTS.filter(c => `${c.first} ${c.last} ${c.email} ${c.phone} ${c.company}`.toLowerCase().includes(q));
  results.innerHTML = found.length
    ? found.map((c, i) => `<li><button type="button" data-c="${CONTACTS.indexOf(c)}"><span>${esc(c.first)} ${esc(c.last)}${c.company ? ` — ${esc(c.company)}` : ""}</span><small>${esc(c.phone)}</small></button></li>`).join("")
    : `<li class="none">No contacts found</li>`;
  results.hidden = false;
}
$("contactSearch").addEventListener("input", showContacts);
results.addEventListener("click", e => {
  const b = e.target.closest("[data-c]");
  if (!b) return;
  const c = CONTACTS[+b.dataset.c];
  const set = (id, v) => { $(id).value = v; $(id).classList.remove("invalid"); };
  set("cTitle", c.title); set("cFirst", c.first); set("cLast", c.last); set("cEmail", c.email);
  set("cPhone", c.phone); set("cMobile", c.mobile); set("cCompany", c.company); set("cAddress1", c.address1);
  set("cTown", c.town); set("cState", c.state); set("cZip", c.zip);
  $("contactSearch").value = `${c.first} ${c.last}`;
  results.hidden = true;
});
document.addEventListener("click", e => { if (!e.target.closest(".contact-search")) results.hidden = true; });

// ---------- Right card tabs ----------
document.querySelectorAll(".rcard").forEach(card => {
  card.querySelector(".rtabs").addEventListener("click", e => {
    const tab = e.target.closest(".rtab");
    if (!tab) return;
    card.querySelectorAll(".rtab").forEach(t => t.classList.toggle("active", t === tab));
    card.querySelectorAll(".rpane").forEach(p => { p.hidden = p.dataset.pane !== tab.dataset.tab; });
  });
});
$("actTabs").addEventListener("click", e => {
  const t = e.target.closest(".st");
  if (!t) return;
  $("actTabs").querySelectorAll(".st").forEach(x => x.classList.toggle("active", x === t));
});
document.querySelectorAll(".st-arrow").forEach(b => b.addEventListener("click", () => {
  $("actTabs").scrollBy({ left: 120 * Number(b.dataset.scroll), behavior: "smooth" });
}));

// ---------- Add Product menu ----------
const apBtn = $("addProductBtn");
const apMenu = $("apMenu");
const apGroups = $("apGroups");
const apSub = $("apSub");
const apSub2 = $("apSub2");
let openGroup = null;
const caret = `<span class="caret"></span>`;
const matchesProduct = (g, q) => [...g.products, ...(g.subGroups || []).flatMap(s => s.products)].some(p => p.toLowerCase().includes(q));

function renderGroups() {
  const q = $("apGroupSearch").value.trim().toLowerCase();
  const shown = PRODUCT_GROUPS.filter(g => !q || g.name.toLowerCase().includes(q) || matchesProduct(g, q));
  apGroups.innerHTML = shown.length
    ? shown.map(g => `<li><button type="button" data-group="${esc(g.name)}" class="${openGroup === g.name ? "hover" : ""}" title="${esc(g.name)}"><span>${esc(g.name)}</span>${caret}</button></li>`).join("")
    : `<li class="none">No groups found</li>`;
}

function showGroup(name, btn) {
  const g = PRODUCT_GROUPS.find(x => x.name === name);
  if (!g) return;
  openGroup = name;
  apGroups.querySelectorAll("button").forEach(b => b.classList.toggle("hover", b.dataset.group === name));
  $("apProductSearch").value = "";
  renderProducts();
  apSub.hidden = false;
  apSub2.hidden = true;
  apSub.style.top = `${btn.offsetTop + apGroups.offsetTop - 4}px`;
}

function renderProducts() {
  const g = PRODUCT_GROUPS.find(x => x.name === openGroup);
  const q = $("apProductSearch").value.trim().toLowerCase();
  const list = g.products.filter(p => p.toLowerCase().includes(q));
  $("apProducts").innerHTML = list.length
    ? list.map(p => `<li><button type="button" data-product="${esc(p)}" title="${esc(p)}">${esc(p)}</button></li>`).join("")
    : `<li class="none">No products found</li>`;
  const subs = (g.subGroups || []).filter(s => !q || s.name.toLowerCase().includes(q) || s.products.some(p => p.toLowerCase().includes(q)));
  $("apSubGroups").innerHTML = subs.map(s => `<li><button type="button" data-sub="${esc(s.name)}"><span>${esc(s.name)}</span>${caret}</button></li>`).join("");
  $("apSubGroups").hidden = !subs.length;
}

function showSubGroup(name, btn) {
  const g = PRODUCT_GROUPS.find(x => x.name === openGroup);
  const s = (g.subGroups || []).find(x => x.name === name);
  if (!s) return;
  $("apSubGroups").querySelectorAll("button").forEach(b => b.classList.toggle("hover", b.dataset.sub === name));
  $("apSub2List").innerHTML = s.products.map(p => `<li><button type="button" data-product="${esc(p)}" data-subgroup="${esc(name)}">${esc(p)}</button></li>`).join("");
  apSub2.hidden = false;
  apSub2.style.top = `${btn.closest("li").offsetTop + $("apSubGroups").offsetTop - 6}px`;
  apSub2.style.bottom = "auto";
}

function openApMenu() {
  apMenu.hidden = false;
  apBtn.setAttribute("aria-expanded", "true");
  $("apGroupSearch").value = "";
  openGroup = null;
  apSub.hidden = true;
  renderGroups();
  $("apGroupSearch").focus();
}
function closeApMenu() {
  apMenu.hidden = true;
  apBtn.setAttribute("aria-expanded", "false");
  openGroup = null;
}
apBtn.addEventListener("click", () => (apMenu.hidden ? openApMenu() : closeApMenu()));
$("apGroupSearch").addEventListener("input", () => { apSub.hidden = true; openGroup = null; renderGroups(); });
$("apProductSearch").addEventListener("input", () => { apSub2.hidden = true; renderProducts(); });

// hover (mouse) or click (touch / keyboard) opens the sub menus
apGroups.addEventListener("mouseover", e => { const b = e.target.closest("[data-group]"); if (b && b.dataset.group !== openGroup) showGroup(b.dataset.group, b); });
apGroups.addEventListener("click", e => { const b = e.target.closest("[data-group]"); if (b) { showGroup(b.dataset.group, b); $("apProductSearch").focus(); } });
$("apSubGroups").addEventListener("mouseover", e => { const b = e.target.closest("[data-sub]"); if (b) showSubGroup(b.dataset.sub, b); });
$("apSubGroups").addEventListener("click", e => { const b = e.target.closest("[data-sub]"); if (b) showSubGroup(b.dataset.sub, b); });
$("apProducts").addEventListener("mouseover", () => { apSub2.hidden = true; $("apSubGroups").querySelectorAll("button").forEach(b => b.classList.remove("hover")); });

apMenu.addEventListener("click", e => {
  const p = e.target.closest("[data-product]");
  if (!p) return;
  const group = openGroup;
  closeApMenu();
  openJobProduct({ product: p.dataset.product, group, index: null });
});
document.addEventListener("click", e => { if (!apMenu.hidden && !e.target.closest(".ap-wrap")) closeApMenu(); });
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!apMenu.hidden) { closeApMenu(); apBtn.focus(); }
  else if (menuRow !== null) closeRowMenu();
  else if (!$("additionalPanel").hidden) $("additionalContacts").click();
});

// ---------- Quote versions (Q1 ▾ next to Job Ref No) ----------
const qvMenu = $("quoteVerMenu");
function renderQuoteVer() {
  $("quoteVerLabel").textContent = job.current;
  qvMenu.innerHTML = quoteIds().map(id => `<button type="button" role="menuitemradio" aria-checked="${id === job.current}" data-quote="${id}" class="${id === job.current ? "current" : ""}"><b>${id}</b><span>${esc(job.quotes[id].status)}</span></button>`).join("") +
    `<button type="button" role="menuitem" class="qv-new" data-quote-new>+ New quote version</button>`;
}
function switchQuote(id) {
  if (!job.quotes[id] || id === job.current) return;
  job.quotes[job.current].items = jobItems.slice();
  jobItems.length = 0;
  jobItems.push(...job.quotes[id].items);
  job.quotes[id].items = jobItems;
  job.current = id;
  selected.clear(); expanded.clear();
  renderQuoteVer();
  renderJob();
}
// adds a version and returns its id ("Q4")
function addQuoteVersion(status, items) {
  const id = "Q" + (Math.max(0, ...quoteIds().map(q => Number(q.slice(1)))) + 1);
  job.quotes[id] = { status, items };
  renderQuoteVer();
  return id;
}
$("quoteVerBtn").addEventListener("click", e => {
  e.stopPropagation();
  renderQuoteVer();
  qvMenu.hidden = !qvMenu.hidden;
  $("quoteVerBtn").setAttribute("aria-expanded", String(!qvMenu.hidden));
});
qvMenu.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  qvMenu.hidden = true;
  $("quoteVerBtn").setAttribute("aria-expanded", "false");
  if (b.dataset.quote) { switchQuote(b.dataset.quote); return; }
  openNewVersion(); // confirm popup in js/job-quotes.js
});
document.addEventListener("click", e => { if (!qvMenu.hidden && !e.target.closest(".jh-ref")) { qvMenu.hidden = true; $("quoteVerBtn").setAttribute("aria-expanded", "false"); } });

// ---------- All Activities ----------
function logActivity(text) {
  const d = new Date();
  job.activity.unshift({ text, time: `${todayDMY()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` });
  renderActivity();
}
function renderActivity() {
  $("actList").innerHTML = job.activity.map(a => `<div class="act-row"><span title="${esc(a.text)}">${esc(a.text)}</span><time>${esc(a.time)}</time></div>`).join("");
  $("actList").hidden = !job.activity.length;
  $("actEmpty").hidden = !!job.activity.length;
}

// ---------- Save job ----------
let flashTimer;
function flash(text, ok) {
  const m = $("jobMsg");
  m.textContent = text;
  m.className = `job-msg ${ok ? "ok" : "err"}`;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { m.textContent = ""; }, 4000);
}
$("jobSave").addEventListener("click", () => {
  const phone = $("cPhone");
  const manager = $("jManager");
  const missing = [];
  phone.classList.toggle("invalid", !phone.value.trim());
  manager.classList.toggle("invalid", !manager.value);
  if (!phone.value.trim()) missing.push("Phone");
  if (!manager.value) missing.push("Account manager");
  if (missing.length) {
    openContact();
    (phone.value.trim() ? manager : phone).focus();
    flash(`Please fill in: ${missing.join(", ")}`, false);
    return;
  }
  if (!jobItems.length) { flash("Add at least one product", false); return; }
  if (!$("jobRef").value.trim()) $("jobRef").value = JobStore.nextRef();
  const ref = $("jobRef").value.trim();
  job.quotes[job.current].items = jobItems;
  JobStore.save({
    ref, status: $("jobStatus").value, orderStatus: $("orderStatus").value, account: $("accountRef").value.trim(), invoice: $("invoiceNo").value.trim(),
    order: $("dOrder").value, due: $("dDue").value, created: $("dCreated").value,
    contact: readContact(), current: job.current, quotes: job.quotes, activity: job.activity
  });
  if (!editRef) setEditMode(ref);
  flash(`Job ${ref} saved`, true);
});

// ---------- Edit Job (create-job.html?ref=…) ----------
const CONTACT_IDS = ["cAccountType", "cCompany", "cTitle", "cFirst", "cLast", "cEmail", "cMobile", "cPhone", "cAddress1", "cAddress2", "cTown", "cZip", "cState", "cOrg", "cSource", "cCountry", "cRole", "cCurrency", "jCustomerRef", "jAdditionalRef", "jManager", "jStatusNotes"];
// older/sample jobs use short keys (first, phone, manager…)
const CONTACT_ALIAS = { cTitle: "title", cFirst: "first", cLast: "last", cEmail: "email", cMobile: "mobile", cPhone: "phone", cCompany: "company", cAddress1: "address1", cTown: "town", cState: "state", cZip: "zip", jManager: "manager" };
function readContact() { return Object.fromEntries(CONTACT_IDS.map(id => [id, $(id).value])); }
function fillContact(c = {}) {
  CONTACT_IDS.forEach(id => {
    const v = c[id] ?? c[CONTACT_ALIAS[id]];
    if (v !== undefined && v !== "") $(id).value = v;
  });
}
let editRef = new URLSearchParams(location.search).get("ref");
function setEditMode(ref) {
  editRef = ref;
  $("pageTitle").textContent = "Edit Job";
  document.title = `${ref} - Edit Job`;
  // keep the URL as ?ref=… (some browsers block this on file:// pages; the page still works)
  if (new URLSearchParams(location.search).get("ref") !== ref) {
    try { history.replaceState(null, "", `create-job.html?ref=${encodeURIComponent(ref)}`); } catch (e) { /* ignore */ }
  }
}
if (editRef) {
  const saved = JobStore.load(editRef);
  $("jobRef").value = saved.ref;
  $("jobStatus").value = saved.status || "Lead";
  $("orderStatus").value = saved.orderStatus || "Not confirmed yet";
  $("accountRef").value = saved.account || "";
  $("invoiceNo").value = saved.invoice || "";
  if (saved.created) $("dCreated").value = saved.created;
  $("dOrder").value = saved.order || "";
  $("dDue").value = saved.due || "";
  fillContact(saved.contact);
  job.quotes = saved.quotes;
  job.current = job.quotes[saved.current] ? saved.current : quoteIds()[0];
  jobItems.push(...job.quotes[job.current].items);
  job.quotes[job.current].items = jobItems;
  job.activity = saved.activity || [];
  setEditMode(saved.ref);
  closeContact();
}
renderQuoteVer();
renderActivity();
["cPhone", "jManager"].forEach(id => $(id).addEventListener("input", () => $(id).classList.remove("invalid")));
$("jManager").addEventListener("change", () => $("jManager").classList.remove("invalid"));

renderJob();
