// The product being set up (?name=… from Products). Everything on this page is
// saved per product in js/product-store.js, and the Create Job product popup reads it.
const PRODUCT_NAME = new URLSearchParams(location.search).get("name") || "Zebra blinds";
const setup = ProductStore.load(PRODUCT_NAME);

// [fieldName, fieldCode, fieldType, fieldInfo, mandatory, mobileQuickView, showOnJobItem, options]
// options: sys = system field (no checkbox / menu), mobLock = mobile toggle locked
const fields = setup.fields;
const FIELD_VALUES = setup.fieldValues; // field name -> [{ value, priceGroup, outOfStock }]
const canExpand = f => ProductStore.VALUE_TYPES.has(f[2]); // List / material fields have values

const MATERIALS = setup.materials; // fabrics (Materials → Fabrics), shown under a Fabric field

function persist() {
  ProductStore.save(PRODUCT_NAME, { fields, productTypes: PRODUCT_TYPES, typeGroups: CATEGORY_VALUES, fieldValues: FIELD_VALUES, materials: MATERIALS });
}

const rowsEl = document.getElementById("rows");
const checkAll = document.getElementById("checkAll");
const selected = new Set();
const expanded = new Set();
let menuRow = null; // row whose "⋮" menu is open

const toggle = (on, i, field, locked) =>
  `<button class="toggle${on ? "" : " off"}" data-i="${i}" data-field="${field}" ${locked ? "disabled" : ""}>${on ? "ON" : "OFF"}<span class="knob"></span></button>`;

// 4 x 4 dotted grid icon
const gridIcon = `<svg class="dots" width="15" height="13" viewBox="0 0 15 13" fill="#333">${
  [0, 3.6, 7.2, 10.8].map(y => [0, 4, 8, 12].map(x => `<rect x="${x}" y="${y}" width="2" height="2"/>`).join("")).join("")
}</svg>`;

const expIcon = `<svg width="10" height="7" viewBox="0 0 10 7" fill="none" stroke="#fff" stroke-width="2"><path d="M1 1l4 4 4-4"/></svg>`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

function render() {
  rowsEl.innerHTML = fields.map((f, i) => {
    const o = f[7];
    return `<tr data-row="${i}">
      <td class="c-chk">${o.sys ? "" : `<input type="checkbox" class="chk" data-i="${i}" ${selected.has(i) ? "checked" : ""}>`}</td>
      <td class="c-exp">${canExpand(f) ? `<button class="exp${expanded.has(i) ? " open" : ""}" data-i="${i}" title="${expanded.has(i) ? "Hide" : "Show"} values">${expIcon}</button>` : ""}</td>
      <td class="c-edit" data-i="${i}" title="Edit field">${esc(f[0])}</td>
      <td class="c-edit" data-i="${i}" title="Edit field">${esc(f[1])}</td>
      <td class="c-edit" data-i="${i}" title="Edit field">${esc(f[2])}</td>
      <td class="c-edit" data-i="${i}" title="Edit field">${esc(f[3])}</td>
      <td>${toggle(f[4], i, 4)}</td>
      <td>${toggle(f[5], i, 5, o.mobLock)}</td>
      <td>${toggle(f[6], i, 6)}</td>
      <td class="c-menu">${o.sys ? "" : `<button class="kebab${menuRow === i ? " active" : ""}" data-i="${i}" title="Actions"><i></i><i></i><i></i></button>`}</td>
      <td class="c-grid"><button type="button" class="drag-handle" data-i="${i}" title="Drag to move" aria-label="Move ${esc(f[0])} (arrow up / down)">${gridIcon}</button></td>
    </tr>${expanded.has(i) && canExpand(f) ? (ProductStore.MATERIAL_TYPES.has(f[2]) ? fabricsPanel(f, i) : fieldValuesPanel(f, i)) : ""}`;
  }).join("");
  const selectable = fields.map((f, i) => i).filter(i => !fields[i][7].sys);
  checkAll.checked = selectable.every(i => selected.has(i));
  persist();
}

rowsEl.addEventListener("click", e => {
  if (e.target.closest(".fb-panel")) return; // fabric table under a Fabric field (handled below)
  const k = e.target.closest(".kebab");
  if (k) {
    const i = Number(k.dataset.i);
    menuRow === i ? closeRowMenu() : openRowMenu(i, k);
    return;
  }
  const t = e.target.closest(".toggle");
  if (t && !t.disabled) {
    const f = fields[t.dataset.i];
    f[t.dataset.field] = !f[t.dataset.field];
    render();
    return;
  }
  const x = e.target.closest(".exp");
  if (x) {
    const i = Number(x.dataset.i);
    expanded.has(i) ? expanded.delete(i) : expanded.add(i);
    render();
  }
});

rowsEl.addEventListener("change", e => {
  if (!e.target.classList.contains("chk") || e.target.closest(".fb-panel")) return;
  const i = Number(e.target.dataset.i);
  e.target.checked ? selected.add(i) : selected.delete(i);
  render();
});

checkAll.addEventListener("change", () => {
  fields.forEach((f, i) => { if (!f[7].sys) checkAll.checked ? selected.add(i) : selected.delete(i); });
  render();
});

// ---------- Field values (expand a List / material field) ----------
// Each value can be tied to a price group: on Create Job, a material (e.g. Fabric)
// only lists the values of the price group picked there.
const fvAdding = new Set(); // field names showing the "new value" row
const fvOf = name => (FIELD_VALUES[name] ||= []);
const allPriceGroupNames = () => [...new Set(Object.values(CATEGORY_VALUES).flat().map(g => g.name))];

function pgSelect(current, attrs) {
  const groups = allPriceGroupNames();
  const extra = current && !groups.includes(current) ? `<option selected>${esc(current)}</option>` : "";
  return `<select ${attrs}><option value="">Any price group</option>${groups.map(g => `<option ${g === current ? "selected" : ""}>${esc(g)}</option>`).join("")}${extra}</select>`;
}

// types of the Pricing Group Filter field (what a fabric value can be tied to)
function filterTypes() {
  const ff = fields.find(x => x[2] === PRICING_FILTER_TYPE);
  return ff && ff[7].linkedTypes && ff[7].linkedTypes.length ? ff[7].linkedTypes : PRODUCT_TYPES;
}
function typeSelect(current, attrs) {
  const types = filterTypes();
  const extra = current && !types.includes(current) ? `<option selected>${esc(current)}</option>` : "";
  return `<select ${attrs}><option value="">Any type</option>${types.map(t => `<option ${t === current ? "selected" : ""}>${esc(t)}</option>`).join("")}${extra}</select>`;
}

function fieldValuesPanel(f, i) {
  const name = f[0];
  const isMaterial = ProductStore.MATERIAL_TYPES.has(f[2]);
  const typeCell = (v, k) => isMaterial ? `<td>${typeSelect(v.type || "", `class="fv-sel" data-fv="${i}" data-k="${k}" data-prop="type" aria-label="Type for ${esc(v.value)}"`)}</td>` : "";
  const rows = fvOf(name).map((v, k) => `<tr>
      <td>${esc(v.value)}</td>
      ${typeCell(v, k)}
      <td>${pgSelect(v.priceGroup, `class="fv-sel" data-fv="${i}" data-k="${k}" data-prop="priceGroup" aria-label="Price group for ${esc(v.value)}"`)}</td>
      <td class="fv-stock"><label><input type="checkbox" data-fv="${i}" data-k="${k}" data-prop="outOfStock" ${v.outOfStock ? "checked" : ""}> Out of stock</label></td>
      <td class="cv-act"><button type="button" class="fv-del" data-fv="${i}" data-k="${k}" title="Delete ${esc(v.value)}"><svg width="9" height="9" viewBox="0 0 9 9" stroke="#e53935" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l7 7M8 1L1 8"/></svg></button></td>
    </tr>`).join("");
  const add = fvAdding.has(name) ? `<tr class="cv-new">
      <td><input class="cv-in fv-new-value" data-fv="${i}" placeholder="${isMaterial ? "Material" : "Value"} *" maxlength="60" autocomplete="off"></td>
      ${isMaterial ? `<td>${typeSelect("", `class="fv-sel fv-new-type" aria-label="Type"`)}</td>` : ""}
      <td>${pgSelect("", `class="fv-sel fv-new-pg" aria-label="Price group"`)}</td>
      <td class="fv-stock"><label><input type="checkbox" class="fv-new-stock"> Out of stock</label></td>
      <td class="cv-act"><button type="button" class="fv-save" data-fv="${i}" title="Save value"><svg width="11" height="9" viewBox="0 0 11 9" fill="none" stroke="#3f9b23" stroke-width="2"><path d="M1 4.5l3 3L10 1"/></svg></button></td>
    </tr>` : "";
  const empty = !rows && !add ? `<tr class="cv-empty"><td colspan="${isMaterial ? 5 : 4}">No values yet. Click + to add one.</td></tr>` : "";
  return `<tr class="fv-row"><td colspan="11"><div class="cv-panel fv-panel">
    <table class="cv-table">
      <thead><tr><th>${isMaterial ? "Material" : "Value"}</th>${isMaterial ? "<th>Type</th>" : ""}<th>Price Group</th><th>Stock</th>
        <th class="cv-act"><button type="button" class="fv-add" data-fv="${i}" title="Add value"><svg width="9" height="9" viewBox="0 0 9 9"><path d="M4.5 0v9M0 4.5h9" stroke="#e0147a" stroke-width="1.8"/></svg></button></th></tr></thead>
      <tbody>${add}${rows}${empty}</tbody>
    </table></div></td></tr>`;
}

function saveFieldValue(i, panel) {
  const input = panel.querySelector(".fv-new-value");
  const value = input.value.trim();
  if (!value) { input.classList.add("invalid"); input.focus(); return; }
  const name = fields[i][0];
  const list = fvOf(name);
  if (list.some(v => v.value.toLowerCase() === value.toLowerCase())) { input.classList.add("invalid"); input.title = "Already added"; input.focus(); return; }
  const typeSel = panel.querySelector(".fv-new-type");
  list.push({ value, type: typeSel ? typeSel.value : "", priceGroup: panel.querySelector(".fv-new-pg").value, outOfStock: panel.querySelector(".fv-new-stock").checked });
  fvAdding.delete(name);
  render();
}

rowsEl.addEventListener("click", e => {
  const add = e.target.closest(".fv-add");
  if (add) {
    fvAdding.add(fields[+add.dataset.fv][0]);
    render();
    rowsEl.querySelector(`.fv-new-value[data-fv="${add.dataset.fv}"]`).focus();
    return;
  }
  const save = e.target.closest(".fv-save");
  if (save) { saveFieldValue(+save.dataset.fv, save.closest(".fv-panel")); return; }
  const del = e.target.closest(".fv-del");
  if (del) { fvOf(fields[+del.dataset.fv][0]).splice(+del.dataset.k, 1); render(); }
});
rowsEl.addEventListener("change", e => {
  const el = e.target;
  if (!el.dataset.prop || el.dataset.fv === undefined) return;
  const v = fvOf(fields[+el.dataset.fv][0])[+el.dataset.k];
  v[el.dataset.prop] = el.type === "checkbox" ? el.checked : el.value;
  persist();
});
rowsEl.addEventListener("keydown", e => {
  if (!e.target.classList.contains("fv-new-value")) return;
  e.target.classList.remove("invalid");
  if (e.key === "Enter") { e.preventDefault(); saveFieldValue(+e.target.dataset.fv, e.target.closest(".fv-panel")); }
  if (e.key === "Escape") { e.stopPropagation(); fvAdding.delete(fields[+e.target.dataset.fv][0]); render(); }
});

// ---------- Drag rows to change the order (grid icon = handle) ----------
// The order here is the order of the fields in the Create Job product popup.
function moveField(from, to) {
  if (from === to || to < 0 || to >= fields.length) return;
  const order = fields.map((_, k) => k);
  const [f] = fields.splice(from, 1);
  order.splice(from, 1);
  fields.splice(to, 0, f);
  order.splice(to, 0, from);
  // row selections / open value panels follow their field
  const remap = set => { const old = new Set(set); set.clear(); order.forEach((oldIdx, newIdx) => { if (old.has(oldIdx)) set.add(newIdx); }); };
  remap(selected);
  remap(expanded);
  if (menuRow !== null) { menuRow = null; rowMenu.hidden = true; }
  render();
}

let dragFrom = null;
const mainRow = el => {
  let tr = el && el.closest ? el.closest("tr") : null;
  while (tr && tr.dataset.row === undefined) tr = tr.previousElementSibling; // a value panel belongs to the row above
  return tr && rowsEl.contains(tr) ? tr : null;
};
const clearDropMarks = () => rowsEl.querySelectorAll(".drop-before, .drop-after").forEach(tr => tr.classList.remove("drop-before", "drop-after"));

// only the handle starts a drag, so text in the row can still be selected / clicked
rowsEl.addEventListener("pointerdown", e => {
  const h = e.target.closest(".drag-handle");
  if (h) h.closest("tr").draggable = true;
});
rowsEl.addEventListener("dragstart", e => {
  const tr = e.target.closest && e.target.closest("tr[data-row]");
  if (!tr || !tr.draggable) { e.preventDefault(); return; }
  dragFrom = Number(tr.dataset.row);
  tr.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(dragFrom));
});
rowsEl.addEventListener("dragover", e => {
  if (dragFrom === null) return;
  const tr = mainRow(e.target);
  if (!tr) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const r = tr.getBoundingClientRect();
  const after = e.clientY > r.top + r.height / 2;
  clearDropMarks();
  if (Number(tr.dataset.row) !== dragFrom) tr.classList.add(after ? "drop-after" : "drop-before");
});
rowsEl.addEventListener("drop", e => {
  if (dragFrom === null) return;
  e.preventDefault();
  const tr = mainRow(e.target);
  if (tr) {
    const target = Number(tr.dataset.row);
    const after = tr.classList.contains("drop-after");
    let to = after ? target + 1 : target;
    if (dragFrom < to) to -= 1; // removing the dragged row shifts the ones below it up
    moveField(dragFrom, to);
  }
  dragFrom = null;
  clearDropMarks();
});
rowsEl.addEventListener("dragend", () => {
  dragFrom = null;
  clearDropMarks();
  rowsEl.querySelectorAll("tr[draggable='true']").forEach(tr => { tr.draggable = false; tr.classList.remove("dragging"); });
});

// keyboard: focus the handle, then arrow up / down
rowsEl.addEventListener("keydown", e => {
  const h = e.target.closest(".drag-handle");
  if (!h || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
  e.preventDefault();
  const from = Number(h.dataset.i);
  const to = from + (e.key === "ArrowUp" ? -1 : 1);
  if (to < 0 || to >= fields.length) return;
  moveField(from, to);
  rowsEl.querySelector(`.drag-handle[data-i="${to}"]`).focus();
});

// ---------- Row "⋮" menu: Delete ----------
const rowMenu = document.getElementById("rowMenu");

function openRowMenu(i, btn) {
  const r = btn.getBoundingClientRect(); // measure before render() replaces the button
  menuRow = i;
  render();
  rowMenu.hidden = false;
  rowMenu.style.top = `${r.top + r.height / 2 - rowMenu.offsetHeight / 2}px`;
  rowMenu.style.left = `${r.left - 18 - rowMenu.offsetWidth}px`;
}

function closeRowMenu() {
  if (menuRow === null) return;
  menuRow = null;
  rowMenu.hidden = true;
  render();
}

// Indexes above the deleted row move up by one
const shiftSet = (set, removed) => {
  const next = [...set].filter(i => i !== removed).map(i => (i > removed ? i - 1 : i));
  set.clear();
  next.forEach(i => set.add(i));
};

document.getElementById("rowDelete").addEventListener("click", () => {
  const i = menuRow;
  closeRowMenu();
  const [gone] = fields.splice(i, 1);
  if (!fields.some(f => f[0] === gone[0])) delete FIELD_VALUES[gone[0]];
  shiftSet(selected, i);
  shiftSet(expanded, i);
  render();
});

document.addEventListener("click", e => {
  if (menuRow !== null && !rowMenu.contains(e.target) && !e.target.closest(".kebab")) closeRowMenu();
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && menuRow !== null) closeRowMenu(); });
document.querySelector(".grid").addEventListener("scroll", closeRowMenu);
window.addEventListener("resize", closeRowMenu);

// Full screen for the table panel
document.getElementById("fullBtn").addEventListener("click", () => {
  const main = document.querySelector(".main");
  document.fullscreenElement ? document.exitFullscreen() : main.requestFullscreen();
});

// ---------- Add New Field popup ----------
const modal = document.getElementById("fieldModal");
const form = document.getElementById("fieldForm");
const fName = document.getElementById("fName");
const fCode = document.getElementById("fCode");
const fType = document.getElementById("fType");
const fInfo = document.getElementById("fInfo");
const infoCount = document.getElementById("infoCount");
const yn = {
  jobItem: document.getElementById("fJobItem"),
  portal: document.getElementById("fPortal"),
  mobile: document.getElementById("fMobile"),
  mandatory: document.getElementById("fMandatory")
};
const ynDefaults = { jobItem: true, portal: true, mobile: false, mandatory: false };

// Field Type options come from the Field Types page list (js/field-types-data.js)
FIELD_TYPES.forEach(([name]) => fType.add(new Option(name, name)));

// "Pricing Group Filter" asks for Suppliers, then Linked Types (only one per product)
const PRICING_FILTER_TYPE = ProductStore.FILTER_TYPE;
const DUPLICATE_FILTER_MSG = { title: "Error", message: "Duplicate entry for Field Type" };
// another field (not the one being edited) already uses Pricing Group Filter
const filterTaken = () => fields.some((f, k) => k !== editIndex && f[2] === PRICING_FILTER_TYPE);
const SUPPLIERS = ProductStore.SUPPLIERS;
const PRODUCT_TYPES = setup.productTypes;

const supplierRow = document.getElementById("supplierRow");
const productTypeRow = document.getElementById("productTypeRow");

// ---- Reusable multi-select (search + Select all + checkboxes) ----
// el: the .ms element; options: array (may grow); summary(picked) -> text for the closed box
// onTrigger (optional): handle clicks on the box yourself instead of opening the list
function createMultiSelect(el, options, { summary, emptyText, onChange, onTrigger }) {
  const trigger = el.querySelector(".ms-trigger");
  const valueEl = el.querySelector(".ms-value");
  const panel = el.querySelector(".ms-panel");
  const search = el.querySelector(".ms-search");
  const list = el.querySelector(".ms-list");
  const chosen = new Set();

  const matches = () => {
    const q = search.value.trim().toLowerCase();
    return options.filter(n => n.toLowerCase().includes(q));
  };
  const picked = () => options.filter(n => chosen.has(n)); // keeps list order

  function render() {
    const shown = matches();
    const allOn = shown.length > 0 && shown.every(n => chosen.has(n));
    const someOn = shown.some(n => chosen.has(n));
    list.innerHTML = shown.length
      ? `<label class="ms-opt ms-all${allOn ? " checked" : ""}"><input type="checkbox" data-all ${allOn ? "checked" : ""}><span>Select all</span></label>` +
        shown.map(n => `<label class="ms-opt${chosen.has(n) ? " checked" : ""}" role="option" aria-selected="${chosen.has(n)}">
          <input type="checkbox" value="${esc(n)}" ${chosen.has(n) ? "checked" : ""}><span>${esc(n)}</span></label>`).join("")
      : `<div class="ms-empty">${emptyText}</div>`;
    const all = list.querySelector("[data-all]");
    if (all) all.indeterminate = someOn && !allOn;

    const p = picked();
    valueEl.textContent = p.length ? summary(p) : "Select";
    valueEl.classList.toggle("placeholder", !p.length);
    trigger.title = p.join(", ");
  }

  function open() {
    panel.hidden = false;
    el.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    search.value = "";
    render();
    search.focus();
  }
  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    el.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  }

  const toggleList = () => (panel.hidden ? open() : close());
  trigger.addEventListener("click", () => (onTrigger ? onTrigger() : toggleList()));
  search.addEventListener("input", render);
  list.addEventListener("change", e => {
    const box = e.target;
    if (box.dataset.all !== undefined) matches().forEach(n => (box.checked ? chosen.add(n) : chosen.delete(n)));
    else box.checked ? chosen.add(box.value) : chosen.delete(box.value);
    el.classList.remove("invalid");
    render();
    if (onChange) onChange();
  });

  // close on outside click; Esc closes the list first, not the whole popup
  // (isConnected: ignore clicks on options that were just re-rendered)
  document.addEventListener("click", e => { if (e.target.isConnected && !el.contains(e.target)) close(); });
  el.addEventListener("keydown", e => {
    if (e.key === "Escape" && !panel.hidden) { e.stopPropagation(); close(); trigger.focus(); }
  });

  render();
  return {
    trigger,
    values: picked,
    add(n) { chosen.add(n); el.classList.remove("invalid"); render(); if (onChange) onChange(); },
    remove(n) { chosen.delete(n); render(); if (onChange) onChange(); },
    clear() { chosen.clear(); close(); render(); },
    toggleList,
    close
  };
}

const supplierMs = createMultiSelect(document.getElementById("fSupplier"), SUPPLIERS, {
  summary: p => p.join(", "),
  emptyText: "No suppliers found",
  onChange: () => syncDependents()
});

// Linked Types: clicking the box always opens the Types popup (even when nothing is linked yet),
// the "+" button opens the checkbox list to pick types
const linkedMs = createMultiSelect(document.getElementById("fLinked"), PRODUCT_TYPES, {
  summary: p => `${p.length} option${p.length === 1 ? "" : "s"} selected`,
  emptyText: "No types found",
  onChange: () => { if (!catModal.hidden) renderCategories(); },
  onTrigger: () => openCategories()
});
document.getElementById("linkedAdd").addEventListener("click", e => {
  e.stopPropagation(); // keep the list open (outside-click would close it)
  linkedMs.toggleList();
});

// ---------- Supplier filter for the Types popup ----------
// Suppliers ticked in the field's Supplier box decide what the Types popup shows:
// only price groups of those suppliers, and only types that have one of them
// (types with no price groups yet stay visible so prices can be added).
const pickedSuppliers = () => supplierMs.values();
const supplierOk = g => { const sel = pickedSuppliers(); return !sel.length || sel.includes(g.supplier); };
const typeVisible = name => { const groups = valuesOf(name); return !groups.length || groups.some(supplierOk); };
const supplierText = () => { const sel = pickedSuppliers(); return sel.length ? sel.join(", ") : "All suppliers"; };

// ---------- Types popup (the linked types) ----------
const catModal = document.getElementById("catModal");
const catRows = document.getElementById("catRows");
const catSearchCell = document.getElementById("catSearchCell");
const catSearch = document.getElementById("catSearch");
const catMenu = document.getElementById("catMenu");
const catExpanded = new Set();
let catMenuName = null; // category whose "⋮" menu is open

// Price groups under each type (shown when a Types row is expanded)
// type -> [{ name, supplier, grid? }]   (grid = cost price table from Add Price Group)
const CATEGORY_VALUES = setup.typeGroups;
// name -> { q: [search per column], open: [search box shown per column], adding }
const valState = {};
const VAL_COLS = ["name", "supplier"];
const VAL_HEADS = ["Price Group Name", "Supplier"];
const vs = name => (valState[name] ||= { q: VAL_COLS.map(() => ""), open: VAL_COLS.map(() => false), adding: false });
// types added later (Add types popup, "+" list) start with no price groups
const valuesOf = name => (CATEGORY_VALUES[name] ||= []);

const searchSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa6ad" stroke-width="2.4"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>`;

function valuePanel(name) {
  const st = vs(name);
  return `<tr class="cv-row"><td colspan="3">
    <div class="cv-panel" data-name="${esc(name)}">
      <table class="cv-table">
        <thead>
          <tr>${VAL_HEADS.map(h => `<th>${h}</th>`).join("")}
            <th class="cv-act"><button type="button" class="cv-more${pgMenuName === name ? " active" : ""}" title="Price group options" aria-haspopup="menu"><i></i><i></i><i></i></button></th></tr>
          <tr class="cv-frow">${VAL_HEADS.map((h, c) => `<th><div class="cv-search${st.open[c] ? " open" : ""}">
              <button type="button" class="cv-sbtn" data-col="${c}" title="Search ${h}">${searchSvg}</button>
              <input class="cv-sinput" data-col="${c}" value="${esc(st.q[c])}" placeholder="Search" autocomplete="off">
            </div></th>`).join("")}<th class="cv-act"></th></tr>
        </thead>
        <tbody class="cv-rows">${valueRows(name)}</tbody>
      </table>
    </div>
  </td></tr>`;
}

function valueRows(name) {
  const st = vs(name);
  const q = st.q.map(v => v.trim().toLowerCase());
  const rows = valuesOf(name)
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => supplierOk(v) && VAL_COLS.every((k, c) => !q[c] || v[k].toLowerCase().includes(q[c])));
  const addRow = st.adding ? `<tr class="cv-new">
      <td><input class="cv-in" data-field="name" placeholder="Price group name *" maxlength="60" autocomplete="off"></td>
      <td><input class="cv-in" data-field="supplier" placeholder="Supplier *" maxlength="60" autocomplete="off" list="cvSupplierList"></td>
      <td class="cv-act"></td>
    </tr>` : "";
  const body = rows.length
    ? rows.map(({ v, i }) => `<tr>
        <td class="cv-link">${esc(v.name)}</td>
        <td class="cv-link">${esc(v.supplier)}</td>
        <td class="cv-act"><button type="button" class="kebab cv-kebab${valMenuKey && valMenuKey.name === name && valMenuKey.i === i ? " active" : ""}" data-i="${i}" title="Actions"><i></i><i></i><i></i></button></td>
      </tr>`).join("")
    : (st.adding ? "" : `<tr class="cv-empty"><td colspan="3">${q.some(Boolean) ? "No price groups match your search" : pickedSuppliers().length ? `No ${esc(supplierText())} price groups yet. Click ⋯ to add a new or existing price.` : "No price groups yet. Click ⋯ to add a new or existing price."}</td></tr>`);
  return addRow + body;
}

const panelFor = name => catRows.querySelector(`.cv-panel[data-name="${CSS.escape(name)}"]`);

function renderValues(name) {
  const panel = panelFor(name);
  if (!panel) return;
  panel.querySelector(".cv-rows").innerHTML = valueRows(name);
  const first = panel.querySelector(".cv-new .cv-in");
  if (first && !panel.contains(document.activeElement)) first.focus();
  persist();
}

// value "⋮" menu
const valMenu = document.getElementById("valMenu");
let valMenuKey = null; // { name, i }

function closeValMenu() {
  if (!valMenuKey) return;
  const { name } = valMenuKey;
  valMenuKey = null;
  valMenu.hidden = true;
  renderValues(name);
}

function saveNewValue(name) {
  const row = panelFor(name)?.querySelector(".cv-new");
  if (!row) return;
  const inputs = VAL_COLS.map(k => row.querySelector(`[data-field="${k}"]`));
  const missing = inputs.find(inp => !inp.value.trim());
  inputs.forEach(inp => inp.classList.toggle("invalid", !inp.value.trim()));
  if (missing) { missing.focus(); return; }
  valuesOf(name).push({ name: inputs[0].value.trim(), supplier: inputs[1].value.trim() });
  vs(name).adding = false;
  renderValues(name);
}

function renderCategories() {
  const q = catSearch.value.trim().toLowerCase();
  const names = linkedMs.values().filter(n => typeVisible(n) && n.toLowerCase().includes(q));
  document.getElementById("catFor").textContent = `Supplier: ${supplierText()}`;
  catRows.innerHTML = (names.length
    ? names.map(n => `<tr class="${catExpanded.has(n) ? "cat-open" : ""}">
        <td class="c-exp"><button type="button" class="exp${catExpanded.has(n) ? " open" : ""}" data-name="${esc(n)}" title="${catExpanded.has(n) ? "Hide" : "Show"} values">${expIcon}</button></td>
        <td>${esc(n)}</td>
        <td class="c-menu"><button type="button" class="kebab${catMenuName === n ? " active" : ""}" data-name="${esc(n)}" title="Actions"><i></i><i></i><i></i></button></td>
      </tr>${catExpanded.has(n) ? valuePanel(n) : ""}`).join("")
    : `<tr class="cat-empty"><td colspan="3">${q ? "No types match your search" : linkedMs.values().length ? `No linked types for ${esc(supplierText())}` : "No types linked yet"}</td></tr>`);
  persist();
}

function openCategories() {
  catSearch.value = "";
  catSearchCell.classList.remove("open");
  closeCatMenu();
  renderCategories();
  catModal.hidden = false;
  document.getElementById("catAdd").focus();
}
function closeCategories() {
  closeCatMenu();
  closeValMenu();
  closePgMenu();
  catModal.hidden = true;
  linkedMs.trigger.focus();
}

function closeCatMenu() {
  if (catMenuName === null) return;
  catMenuName = null;
  catMenu.hidden = true;
  renderCategories();
}

// ---------- "Add types" popup (opened by + Add) ----------
const typeModal = document.getElementById("typeModal");
const typeForm = document.getElementById("typeForm");
const typeName = document.getElementById("typeName");
const typeError = document.getElementById("typeError");

let typeReturnFocus = null; // button to focus again when Add types closes
function openTypeModal(from) {
  typeReturnFocus = from || document.getElementById("catAdd");
  typeForm.reset();
  typeName.classList.remove("invalid");
  typeError.textContent = "";
  typeModal.hidden = false;
  typeName.focus();
}
function closeTypeModal() {
  typeModal.hidden = true;
  (typeReturnFocus || document.getElementById("catAdd")).focus();
}

typeForm.addEventListener("submit", e => {
  e.preventDefault();
  const name = typeName.value.trim();
  const linked = linkedMs.values().find(n => n.toLowerCase() === name.toLowerCase());
  const msg = !name ? "Type name is required" : linked ? `"${linked}" is already added` : "";
  typeName.classList.toggle("invalid", !!msg);
  typeError.textContent = msg;
  if (msg) { typeName.focus(); return; }

  const existing = PRODUCT_TYPES.find(n => n.toLowerCase() === name.toLowerCase());
  if (!existing) PRODUCT_TYPES.push(name);
  linkedMs.add(existing || name); // re-renders the Types table via onChange
  closeTypeModal();
  if (!etModal.hidden) { etPicked.add(existing || name); renderET(); }
});
typeName.addEventListener("input", () => { typeName.classList.remove("invalid"); typeError.textContent = ""; });
typeModal.querySelectorAll("[data-type-close]").forEach(b => b.addEventListener("click", closeTypeModal));

document.getElementById("catAdd").addEventListener("click", () => openTypeModal());

// ---------- Existing Types popup (Types → Existing Types) ----------
// Every product type; ticked = linked to this field. "Link Types" applies the ticks.
const etModal = document.getElementById("etModal");
const etRows = document.getElementById("etRows");
const etAll = document.getElementById("etAll");
const etSearch = document.getElementById("etSearch");
const etMenu = document.getElementById("etMenu");
const etPicked = new Set();
let etMenuName = null;

const etShown = () => {
  const q = etSearch.value.trim().toLowerCase();
  return PRODUCT_TYPES.filter(n => typeVisible(n) && n.toLowerCase().includes(q));
};

function renderET() {
  const shown = etShown();
  etRows.innerHTML = shown.length
    ? shown.map(n => `<tr class="${etPicked.has(n) ? "picked" : ""}">
        <td class="l-chk"><input type="checkbox" class="chk" value="${esc(n)}" ${etPicked.has(n) ? "checked" : ""} aria-label="Select ${esc(n)}"></td>
        <td>${esc(n)}</td>
        <td class="l-menu"><button type="button" class="kebab et-kebab${etMenuName === n ? " active" : ""}" data-name="${esc(n)}" title="Actions"><i></i><i></i><i></i></button></td>
      </tr>`).join("")
    : `<tr class="l-empty"><td colspan="3">${PRODUCT_TYPES.length ? "No types match your search" : "No types yet. Click Add New Types."}</td></tr>`;
  etAll.checked = shown.length > 0 && shown.every(n => etPicked.has(n));
  etAll.indeterminate = !etAll.checked && shown.some(n => etPicked.has(n));
  document.getElementById("etTotal").textContent = `Total Record: ${shown.length}${etPicked.size ? ` · ${etPicked.size} selected` : ""}`;
}

function openET() {
  etPicked.clear();
  linkedMs.values().forEach(n => etPicked.add(n));
  etSearch.value = "";
  document.getElementById("etSearchBox").classList.remove("open");
  closeETMenu();
  renderET();
  etModal.hidden = false;
  etAll.focus();
}
function closeET() {
  closeETMenu();
  etModal.hidden = true;
  document.getElementById("catExisting").focus();
}
function closeETMenu() {
  if (etMenuName === null) return;
  etMenuName = null;
  etMenu.hidden = true;
  renderET();
}

document.getElementById("catExisting").addEventListener("click", openET);

// Save in the Types popup: the linked types are kept with the field (saved when the field is saved)
document.getElementById("catSave").addEventListener("click", () => {
  const n = linkedMs.values().length;
  closeCategories();
  showToast({ type: "success", title: "Success", message: `${n} type${n === 1 ? "" : "s"} linked. Save the field to keep the changes.`, duration: 4000 });
});
etModal.querySelector("[data-et-close]").addEventListener("click", closeET);

etRows.addEventListener("change", e => {
  if (!e.target.classList.contains("chk")) return;
  e.target.checked ? etPicked.add(e.target.value) : etPicked.delete(e.target.value);
  renderET();
});
etAll.addEventListener("change", () => {
  etShown().forEach(n => (etAll.checked ? etPicked.add(n) : etPicked.delete(n)));
  renderET();
});
etRows.addEventListener("click", e => {
  const k = e.target.closest(".et-kebab");
  if (k) {
    const name = k.dataset.name;
    if (etMenuName === name) { closeETMenu(); return; }
    const r = k.getBoundingClientRect(); // measure before re-render replaces the button
    etMenuName = name;
    renderET();
    etMenu.hidden = false;
    etMenu.style.top = `${r.top + r.height / 2 - etMenu.offsetHeight / 2}px`;
    etMenu.style.left = `${r.left - 18 - etMenu.offsetWidth}px`;
    return;
  }
  // clicking anywhere else on a row ticks it
  const tr = e.target.closest("tr");
  if (!tr || e.target.closest("input") || tr.classList.contains("l-empty")) return;
  const box = tr.querySelector(".chk");
  box.checked = !box.checked;
  box.dispatchEvent(new Event("change", { bubbles: true }));
});
document.getElementById("etSearchBtn").addEventListener("click", () => {
  const box = document.getElementById("etSearchBox");
  const open = box.classList.toggle("open");
  if (open) etSearch.focus();
  else { etSearch.value = ""; renderET(); }
});
etSearch.addEventListener("input", renderET);

// Delete removes the type from the list (and from this field)
document.getElementById("etDelete").addEventListener("click", () => {
  const name = etMenuName;
  closeETMenu();
  if (!confirm(`Delete type "${name}"? Its price groups are removed too.`)) return;
  PRODUCT_TYPES.splice(PRODUCT_TYPES.indexOf(name), 1);
  delete CATEGORY_VALUES[name];
  etPicked.delete(name);
  catExpanded.delete(name);
  linkedMs.remove(name);
  renderCategories();
  renderET();
  showToast({ type: "success", title: "Success", message: `"${name}" deleted`, duration: 4000 });
});
document.addEventListener("click", e => {
  if (etMenuName !== null && !etMenu.contains(e.target) && !e.target.closest(".et-kebab")) closeETMenu();
});
document.querySelector(".et-table").closest(".link-grid").addEventListener("scroll", closeETMenu);

document.getElementById("etAddNew").addEventListener("click", () => openTypeModal(document.getElementById("etAddNew")));

// Link Types: ticked types become the linked ones
document.getElementById("etLink").addEventListener("click", () => {
  const linked = new Set(linkedMs.values());
  const add = PRODUCT_TYPES.filter(n => etPicked.has(n) && !linked.has(n));
  const drop = PRODUCT_TYPES.filter(n => !etPicked.has(n) && linked.has(n));
  if (!etPicked.size) { showToast({ title: "Error", message: "Select at least one type to link" }); return; }
  add.forEach(n => linkedMs.add(n));
  drop.forEach(n => { linkedMs.remove(n); catExpanded.delete(n); });
  renderCategories();
  closeET();
  if (add.length || drop.length) {
    const parts = [add.length && `${add.length} linked`, drop.length && `${drop.length} unlinked`].filter(Boolean).join(", ");
    showToast({ type: "success", title: "Success", message: `Types updated: ${parts}`, duration: 4000 });
  }
});

// value panel: search boxes, new-value inputs, image picker
catRows.addEventListener("input", e => {
  if (!e.target.classList.contains("cv-sinput")) return;
  const name = e.target.closest(".cv-panel").dataset.name;
  vs(name).q[Number(e.target.dataset.col)] = e.target.value;
  renderValues(name);
});
// suggestions for the Supplier box when adding a price group
catRows.addEventListener("focusin", e => {
  if (e.target.dataset.field !== "supplier") return;
  const used = Object.values(CATEGORY_VALUES).flat().map(g => g.supplier);
  document.getElementById("cvSupplierList").innerHTML =
    [...new Set([...SUPPLIERS, ...used])]
      .map(n => `<option value="${esc(n)}"></option>`).join("");
});
catRows.addEventListener("keydown", e => {
  if (!e.target.classList.contains("cv-in")) return;
  const name = e.target.closest(".cv-panel").dataset.name;
  e.target.classList.remove("invalid");
  if (e.key === "Enter") { e.preventDefault(); saveNewValue(name); }
  if (e.key === "Escape") { e.stopPropagation(); vs(name).adding = false; renderValues(name); }
});


catRows.addEventListener("click", e => {
  const panel = e.target.closest(".cv-panel");
  if (panel) {
    const name = panel.dataset.name;
    const st = vs(name);
    const more = e.target.closest(".cv-more");
    if (more) {
      pgMenuName === name ? closePgMenu() : openPgMenu(name, more);
      return;
    }
    const sb = e.target.closest(".cv-sbtn");
    if (sb) {
      const c = Number(sb.dataset.col);
      st.open[c] = !st.open[c];
      const box = sb.parentElement;
      box.classList.toggle("open", st.open[c]);
      if (st.open[c]) box.querySelector("input").focus();
      else { st.q[c] = ""; box.querySelector("input").value = ""; renderValues(name); }
      return;
    }
    const vk = e.target.closest(".cv-kebab");
    if (vk) {
      const i = Number(vk.dataset.i);
      if (valMenuKey && valMenuKey.name === name && valMenuKey.i === i) { closeValMenu(); return; }
      if (valMenuKey) closeValMenu();
      const r = vk.getBoundingClientRect();
      valMenuKey = { name, i };
      renderValues(name);
      valMenu.hidden = false;
      valMenu.style.top = `${r.top + r.height / 2 - valMenu.offsetHeight / 2}px`;
      valMenu.style.left = `${r.left - 18 - valMenu.offsetWidth}px`;
    }
    return;
  }

  const k = e.target.closest(".kebab");
  if (k) {
    const name = k.dataset.name;
    if (catMenuName === name) { closeCatMenu(); return; }
    const r = k.getBoundingClientRect(); // measure before re-render replaces the button
    catMenuName = name;
    renderCategories();
    catMenu.hidden = false;
    catMenu.style.top = `${r.top + r.height / 2 - catMenu.offsetHeight / 2}px`;
    catMenu.style.left = `${r.left - 18 - catMenu.offsetWidth}px`;
    return;
  }
  const x = e.target.closest(".exp");
  if (x) {
    const name = x.dataset.name;
    catExpanded.has(name) ? catExpanded.delete(name) : catExpanded.add(name);
    renderCategories();
  }
});

// ---------- Price group "⋯" menu: Add New Price / Use Existing Price ----------
const pgMenu = document.getElementById("pgMenu");
let pgMenuName = null; // category whose "⋯" menu is open

function openPgMenu(name, btn) {
  if (pgMenuName) closePgMenu();
  pgMenuName = name;
  btn.classList.add("active");
  pgMenu.hidden = false;
  const r = btn.getBoundingClientRect();
  pgMenu.style.top = `${r.bottom + 6}px`;
  pgMenu.style.left = `${Math.max(8, r.right - pgMenu.offsetWidth)}px`;
  pgMenu.querySelector("button").focus();
}
function closePgMenu() {
  if (!pgMenuName) return;
  const panel = panelFor(pgMenuName);
  if (panel) panel.querySelector(".cv-more").classList.remove("active");
  pgMenuName = null;
  pgMenu.hidden = true;
}

pgMenu.addEventListener("click", e => {
  const item = e.target.closest("[data-action]");
  if (!item) return;
  const name = pgMenuName;
  closePgMenu();
  if (item.dataset.action === "new") {
    openPriceGroup(name); // js/price-group.js
  } else {
    openExisting(name);
  }
});

// Called by the Add Price Group popup (js/price-group.js) when it is saved
function addPriceGroupRows(name, rows) {
  const have = new Set(valuesOf(name).map(g => `${g.name} || ${g.supplier}`));
  rows.forEach(g => { if (!have.has(`${g.name} || ${g.supplier}`)) valuesOf(name).push(g); });
  renderValues(name);
}

// ---------- "Link Existing Price" popup (⋯ → Use Existing Price) ----------
// Lists every price group used by any type (except ones this type already has).
const existModal = document.getElementById("existModal");
const existList = document.getElementById("existList");
const existAll = document.getElementById("existAll");
const EXIST_COLS = [
  { key: "name", label: "Price Group Name" },
  { key: "code", label: "Blind Type Code" },
  { key: "supplier", label: "Supplier" },
  { key: "types", label: "Linked Types" }
];
let existFor = null;        // type we are adding to
let existPool = [];         // [{ g, types: [type names], key }]
const existPicked = new Set();
const existQ = EXIST_COLS.map(() => "");
const pgKey = g => `${g.name} || ${g.supplier}`; // name + supplier identify a price group

document.getElementById("existFilterRow").innerHTML = `<th class="l-chk"></th>` + EXIST_COLS.map((c, i) =>
  `<th><div class="cv-search"><button type="button" class="cv-sbtn" data-col="${i}" title="Search ${c.label}">${searchSvg}</button>
    <input class="cv-sinput" data-col="${i}" placeholder="Search" autocomplete="off"></div></th>`).join("");

function openExisting(name) {
  existFor = name;
  const have = new Set(valuesOf(name).map(pgKey));
  const byKey = new Map();
  Object.entries(CATEGORY_VALUES).forEach(([type, groups]) => groups.forEach(g => {
    const key = pgKey(g);
    if (have.has(key) || !supplierOk(g)) return;
    if (!byKey.has(key)) byKey.set(key, { g, types: [], key });
    const row = byKey.get(key);
    if (!row.types.includes(type)) row.types.push(type);
  }));
  existPool = [...byKey.values()].sort((x, y) => x.g.name.localeCompare(y.g.name, undefined, { numeric: true }));
  existPicked.clear();
  existQ.fill("");
  existModal.querySelectorAll(".cv-search").forEach(box => { box.classList.remove("open"); box.querySelector("input").value = ""; });
  document.getElementById("existTitleFor").textContent = `for ${name}`;
  renderExisting();
  existModal.hidden = false;
  existAll.focus();
}
function closeExisting() {
  existModal.hidden = true;
  existFor = null;
}

const existCell = (row, key) => (key === "types" ? row.types.join(", ") : row.g[key] || "");
const existShown = () => {
  const q = existQ.map(v => v.trim().toLowerCase());
  return existPool.filter(row => EXIST_COLS.every((c, i) => !q[i] || existCell(row, c.key).toLowerCase().includes(q[i])));
};

function renderExisting() {
  const shown = existShown();
  existList.innerHTML = !existPool.length
    ? `<tr class="l-empty"><td colspan="5">All existing price groups are already linked to this type</td></tr>`
    : !shown.length
      ? `<tr class="l-empty"><td colspan="5">No price groups match your search</td></tr>`
      : shown.map(row => `<tr class="${existPicked.has(row.key) ? "picked" : ""}">
          <td class="l-chk"><input type="checkbox" class="chk" value="${esc(row.key)}" ${existPicked.has(row.key) ? "checked" : ""} aria-label="Select ${esc(row.g.name)}"></td>
          ${EXIST_COLS.map(c => { const v = existCell(row, c.key); return `<td title="${esc(v)}">${esc(v)}</td>`; }).join("")}
        </tr>`).join("");
  existAll.checked = shown.length > 0 && shown.every(r => existPicked.has(r.key));
  existAll.indeterminate = !existAll.checked && shown.some(r => existPicked.has(r.key));
  const n = existPicked.size;
  document.getElementById("existTotal").textContent = `Total Record: ${shown.length}${n ? ` · ${n} selected` : ""}`;
}

existList.addEventListener("change", e => {
  if (!e.target.classList.contains("chk")) return;
  e.target.checked ? existPicked.add(e.target.value) : existPicked.delete(e.target.value);
  renderExisting();
});
existAll.addEventListener("change", () => {
  existShown().forEach(r => (existAll.checked ? existPicked.add(r.key) : existPicked.delete(r.key)));
  renderExisting();
});
// clicking anywhere on a row ticks it
existList.addEventListener("click", e => {
  const tr = e.target.closest("tr");
  if (!tr || e.target.closest("input") || tr.classList.contains("l-empty")) return;
  const box = tr.querySelector(".chk");
  box.checked = !box.checked;
  box.dispatchEvent(new Event("change", { bubbles: true }));
});
document.getElementById("existFilterRow").addEventListener("click", e => {
  const b = e.target.closest(".cv-sbtn");
  if (!b) return;
  const box = b.parentElement;
  const open = box.classList.toggle("open");
  if (open) box.querySelector("input").focus();
  else { existQ[+b.dataset.col] = ""; box.querySelector("input").value = ""; renderExisting(); }
});
document.getElementById("existFilterRow").addEventListener("input", e => {
  existQ[+e.target.dataset.col] = e.target.value;
  renderExisting();
});

document.getElementById("existLink").addEventListener("click", () => {
  if (!existPicked.size) { showToast({ title: "Error", message: "Select at least one price group to link" }); return; }
  const name = existFor;
  const rows = existPool.filter(r => existPicked.has(r.key));
  rows.forEach(r => valuesOf(name).push(JSON.parse(JSON.stringify(r.g))));
  closeExisting();
  renderValues(name);
  showToast({ type: "success", title: "Success", message: `${rows.length} price group${rows.length === 1 ? "" : "s"} linked to ${name}`, duration: 4000 });
});
document.getElementById("existAddNew").addEventListener("click", () => {
  const name = existFor;
  closeExisting();
  openPriceGroup(name); // js/price-group.js
});
existModal.querySelectorAll("[data-exist-close]").forEach(b => b.addEventListener("click", closeExisting));

document.getElementById("valDelete").addEventListener("click", () => {
  const { name, i } = valMenuKey;
  closeValMenu();
  valuesOf(name).splice(i, 1);
  renderValues(name);
});

// Delete unlinks the type from this field
document.getElementById("catDelete").addEventListener("click", () => {
  const name = catMenuName;
  closeCatMenu();
  catExpanded.delete(name);
  linkedMs.remove(name);
  // the Types popup stays open (it shows "No types linked yet" and + Add)
});

document.getElementById("catSearchBtn").addEventListener("click", () => {
  catSearchCell.classList.toggle("open");
  if (catSearchCell.classList.contains("open")) catSearch.focus();
  else { catSearch.value = ""; renderCategories(); }
});
catSearch.addEventListener("input", renderCategories);

catModal.querySelectorAll("[data-cat-close]").forEach(b => b.addEventListener("click", closeCategories));
document.addEventListener("click", e => {
  if (catMenuName !== null && !catMenu.contains(e.target) && !e.target.closest(".kebab")) closeCatMenu();
  if (valMenuKey && !valMenu.contains(e.target) && !e.target.closest(".cv-kebab")) closeValMenu();
  if (pgMenuName && !pgMenu.contains(e.target) && !e.target.closest(".cv-more")) closePgMenu();
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || catModal.hidden) return;
  if (!typeModal.hidden) closeTypeModal();
  else if (etMenuName !== null) closeETMenu();
  else if (!etModal.hidden) closeET();
  else if (!existModal.hidden) closeExisting();
  else if (pgMenuName) closePgMenu();
  else if (valMenuKey) closeValMenu();
  else if (catMenuName !== null) closeCatMenu();
  else closeCategories();
});
document.querySelector(".cat-grid").addEventListener("scroll", () => { closeCatMenu(); closeValMenu(); closePgMenu(); });

function syncDependents() {
  const isFilter = fType.value === PRICING_FILTER_TYPE;
  supplierRow.hidden = !isFilter;
  if (!isFilter) supplierMs.clear();
  productTypeRow.hidden = !(isFilter && supplierMs.values().length);
  // keep the linked types while suppliers are being changed; drop them only when the field type changes
  if (!isFilter) linkedMs.clear();
}
fType.addEventListener("change", syncDependents);

const setYN = (btn, on) => {
  btn.classList.toggle("no", !on);
  btn.firstChild.textContent = on ? "Yes" : "No";
};
const isYes = btn => !btn.classList.contains("no");
Object.values(yn).forEach(btn => btn.addEventListener("click", () => setYN(btn, !isYes(btn))));

let editIndex = null; // row being edited, null when adding a new field

// index = null → "Add New Field"; index = row → "Edit Field" filled with that row
function openModal(index = null) {
  editIndex = index;
  form.reset();
  Object.entries(ynDefaults).forEach(([k, v]) => setYN(yn[k], v));
  [fName, fType.parentElement, ...document.querySelectorAll(".ms")].forEach(el => el.classList.remove("invalid"));
  supplierMs.clear();
  linkedMs.clear();
  document.getElementById("fieldModalTitle").textContent = index === null ? "Add New Field" : "Edit Field";

  if (index !== null) {
    const [name, code, type, info, mandatory, mobile, jobItem, opts] = fields[index];
    fName.value = name;
    fCode.value = code;
    if (type && ![...fType.options].some(o => o.value === type)) fType.add(new Option(type, type));
    fType.value = type;
    fInfo.value = info;
    setYN(yn.mandatory, mandatory);
    setYN(yn.mobile, mobile);
    setYN(yn.jobItem, jobItem);
    setYN(yn.portal, opts.onlinePortal ?? ynDefaults.portal);
    syncDependents();                          // shows Supplier for "Pricing Group Filter"
    (opts.supplier || []).forEach(n => supplierMs.add(n));     // shows Linked Types
    (opts.linkedTypes || []).forEach(n => {
      if (!PRODUCT_TYPES.includes(n)) PRODUCT_TYPES.push(n);
      linkedMs.add(n);
    });
  }
  syncDependents();
  infoCount.textContent = `${fInfo.value.length}/250`;
  modal.hidden = false;
  fName.focus();
}
const closeModal = () => { modal.hidden = true; editIndex = null; };

document.getElementById("addFieldBtn").addEventListener("click", () => openModal());

// clicking a field's name / code / type / information opens it for editing
rowsEl.addEventListener("click", e => {
  const cell = e.target.closest(".c-edit");
  if (cell) openModal(Number(cell.dataset.i));
});
modal.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeModal));
document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden && catModal.hidden) closeModal(); });

fInfo.addEventListener("input", () => { infoCount.textContent = `${fInfo.value.length}/250`; });

document.getElementById("insertLink").addEventListener("click", () => {
  const url = prompt("Enter link URL");
  if (!url) return;
  const { selectionStart: s, selectionEnd: e, value } = fInfo;
  fInfo.value = (value.slice(0, s) + url + value.slice(e)).slice(0, 250);
  fInfo.dispatchEvent(new Event("input"));
  fInfo.focus();
});

fName.addEventListener("input", () => fName.classList.remove("invalid"));
fType.addEventListener("change", () => fType.parentElement.classList.remove("invalid"));

form.addEventListener("submit", e => {
  e.preventDefault();
  const name = fName.value.trim();
  const type = fType.value;
  const needsFilter = type === PRICING_FILTER_TYPE;
  const supplier = supplierMs.values();   // array of chosen suppliers
  const linkedTypes = linkedMs.values();  // array of chosen linked types
  fName.classList.toggle("invalid", !name);
  fType.parentElement.classList.toggle("invalid", !type);
  document.getElementById("fSupplier").classList.toggle("invalid", needsFilter && !supplier.length);
  document.getElementById("fLinked").classList.toggle("invalid", needsFilter && supplier.length > 0 && !linkedTypes.length);
  if (!name) { fName.focus(); return; }
  if (!type) { fType.focus(); return; }
  if (needsFilter && filterTaken()) {
    fType.parentElement.classList.add("invalid");
    showToast(DUPLICATE_FILTER_MSG);
    fType.focus();
    return;
  }
  if (needsFilter && !supplier.length) { supplierMs.trigger.focus(); return; }
  if (needsFilter && !linkedTypes.length) { linkedMs.trigger.focus(); return; }

  const index = editIndex;
  // keep row flags (system field, expandable, locked toggle) when editing
  const { supplier: _s, linkedTypes: _l, onlinePortal: _p, ...keep } = index === null ? {} : fields[index][7];
  const row = [
    name, fCode.value.trim(), type, fInfo.value.trim(),
    isYes(yn.mandatory), isYes(yn.mobile), isYes(yn.jobItem),
    needsFilter ? { ...keep, onlinePortal: isYes(yn.portal), supplier, linkedTypes } : { ...keep, onlinePortal: isYes(yn.portal) }
  ];
  if (index === null) {
    // a new Pricing Group Filter sits right after Supplier (Supplier → filter → Pricing → Fabric)
    const sup = needsFilter ? fields.findIndex(f => f[2] === "Supplier") : -1;
    if (sup >= 0) {
      fields.splice(sup + 1, 0, row);
      const shift = set => { const v = [...set].map(k => (k > sup ? k + 1 : k)); set.clear(); v.forEach(k => set.add(k)); };
      shift(selected); shift(expanded);
    } else fields.push(row);
  } else {
    const oldName = fields[index][0];
    if (oldName !== name && FIELD_VALUES[oldName] && !FIELD_VALUES[name]) {
      FIELD_VALUES[name] = FIELD_VALUES[oldName];
      delete FIELD_VALUES[oldName];
    }
    fields[index] = row;
  }
  closeModal();
  render();
  if (index === null && !(needsFilter && fields.some(f => f[2] === "Supplier"))) document.querySelector(".grid").scrollTop = 1e6;
});

// ---------- Fabric field: fabrics and their price groups ----------
// Expanding a Fabric (material) field lists the product's fabrics (Materials → Fabrics) with the
// price groups they belong to. Create Job: Supplier / Pricing Group Filter → Pricing → Fabric.
const fbExpanded = new Set(); // fabric ids showing their colours
const fbPicked = new Set();   // ticked fabric ids
const fbUid = p => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
// a fabric's price groups: its own, plus any set on its colours
const fabricGroups = fb => [...new Set([...(fb.priceGroups || []), ...fb.colours.flatMap(c => c.priceGroups || [])])];
const allGroupNames = () => [...new Set(Object.values(CATEGORY_VALUES).flat().map(g => g.name))];
const pinkChev = `<svg width="9" height="6" viewBox="0 0 9 6" fill="none" stroke="#fff" stroke-width="1.8"><path d="M1 1l3.5 3.5L8 1"/></svg>`;

function fabricsPanel(f, i) {
  const rows = MATERIALS.map(fb => {
    const open = fbExpanded.has(fb.id);
    const groups = fabricGroups(fb).join(", ");
    const colours = open ? `<tr class="fb-colours"><td colspan="5">${fb.colours.length
      ? `<table class="fb-ctable"><thead><tr><th>Colour Name</th><th>Colour Code</th><th>Price Groups</th><th>Stock</th></tr></thead><tbody>${fb.colours.map(c => `<tr>
          <td>${esc(c.name)}</td><td>${esc(c.code || "")}</td><td>${esc((c.priceGroups && c.priceGroups.length ? c.priceGroups : fb.priceGroups || []).join(", ") || "Any")}</td>
          <td>${c.hasStock ? (Number(c.stock) > 0 ? esc(c.stock) : '<span class="oos">Out of stock</span>') : ""}</td></tr>`).join("")}</tbody></table>`
      : `<span class="fb-none">No colours yet — add them on Materials → Fabrics.</span>`}</td></tr>` : "";
    return `<tr data-fid="${esc(fb.id)}">
        <td class="fb-chk"><input type="checkbox" class="chk fb-cb" value="${esc(fb.id)}" ${fbPicked.has(fb.id) ? "checked" : ""} aria-label="Select ${esc(fb.name)}"></td>
        <td class="fb-exp"><button type="button" class="fb-x${open ? " open" : ""}" data-fid="${esc(fb.id)}" title="${open ? "Hide" : "Show"} colours">${pinkChev}</button></td>
        <td title="${esc(fb.name)}${fb.supplier ? ` (${esc(fb.supplier)})` : ""}">${esc(fb.name)}</td>
        <td title="${esc(groups)}">${esc(groups) || '<span class="fb-none">No price group</span>'}</td>
        <td class="cv-act"><button type="button" class="kebab fb-kebab${fbMenuFor === fb.id ? " active" : ""}" data-fid="${esc(fb.id)}" title="Actions"><i></i><i></i><i></i></button></td>
      </tr>${colours}`;
  }).join("");
  const all = MATERIALS.length > 0 && MATERIALS.every(fb => fbPicked.has(fb.id));
  return `<tr class="fv-row"><td colspan="11"><div class="cv-panel fv-panel fb-panel" data-fv="${i}">
    <table class="cv-table fb-table">
      <thead><tr>
        <th class="fb-chk"><input type="checkbox" class="chk fb-cb fb-all" ${all ? "checked" : ""} aria-label="Select all fabrics"></th><th class="fb-exp"></th>
        <th>Fabric Name</th><th>Price Group Name</th>
        <th class="cv-act"><button type="button" class="cv-more fb-more" title="Fabric options" aria-haspopup="menu"><i></i><i></i><i></i></button></th></tr></thead>
      <tbody>${rows || `<tr class="cv-empty"><td colspan="5">No fabrics yet. Click ⋯ to add a new or existing fabric.</td></tr>`}</tbody>
    </table></div></td></tr>`;
}

// menus (fixed position, like the other ⋮ menus)
const fbMenu = document.getElementById("fbMenu");
const fbRowMenu = document.getElementById("fbRowMenu");
let fbMenuFor = null; // fabric id whose ⋮ menu is open
function placeMenu(menu, btn, alignRight) {
  menu.hidden = false;
  const r = btn.getBoundingClientRect();
  if (alignRight) { menu.style.top = `${r.bottom + 6}px`; menu.style.left = `${Math.max(8, r.right - menu.offsetWidth)}px`; }
  else { menu.style.top = `${r.top + r.height / 2 - menu.offsetHeight / 2}px`; menu.style.left = `${r.left - 18 - menu.offsetWidth}px`; }
}
function closeFbMenus() {
  fbMenu.hidden = true;
  if (fbMenuFor !== null) { fbMenuFor = null; fbRowMenu.hidden = true; render(); }
}

rowsEl.addEventListener("click", e => {
  const panel = e.target.closest(".fb-panel");
  if (!panel) return;
  const x = e.target.closest(".fb-x");
  if (x) { const id = x.dataset.fid; fbExpanded.has(id) ? fbExpanded.delete(id) : fbExpanded.add(id); render(); return; }
  const more = e.target.closest(".fb-more");
  if (more) {
    e.stopPropagation();
    if (!fbMenu.hidden) { fbMenu.hidden = true; return; }
    fbMenu.querySelector('[data-fb="unlink"]').hidden = !fbPicked.size;
    placeMenu(fbMenu, more, true);
    return;
  }
  const k = e.target.closest(".fb-kebab");
  if (k) {
    e.stopPropagation();
    const id = k.dataset.fid;
    if (fbMenuFor === id) { closeFbMenus(); return; }
    const r = k.getBoundingClientRect();
    fbMenuFor = id;
    render();
    fbRowMenu.hidden = false;
    fbRowMenu.style.top = `${r.top + r.height / 2 - fbRowMenu.offsetHeight / 2}px`;
    fbRowMenu.style.left = `${r.left - 18 - fbRowMenu.offsetWidth}px`;
  }
});
rowsEl.addEventListener("change", e => {
  if (!e.target.classList.contains("fb-cb")) return;
  if (e.target.classList.contains("fb-all")) MATERIALS.forEach(fb => (e.target.checked ? fbPicked.add(fb.id) : fbPicked.delete(fb.id)));
  else e.target.checked ? fbPicked.add(e.target.value) : fbPicked.delete(e.target.value);
  render();
});
document.addEventListener("click", e => {
  if (!fbMenu.hidden && !fbMenu.contains(e.target)) fbMenu.hidden = true;
  if (fbMenuFor !== null && !fbRowMenu.contains(e.target) && !e.target.closest(".fb-kebab")) closeFbMenus();
});
document.querySelector(".grid").addEventListener("scroll", closeFbMenus);

function unlinkFabrics(ids) {
  const names = MATERIALS.filter(fb => ids.includes(fb.id)).map(fb => fb.name);
  if (!names.length || !confirm(`Unlink ${names.length === 1 ? `"${names[0]}"` : `${names.length} fabrics`} from ${PRODUCT_NAME}?`)) return;
  for (let k = MATERIALS.length - 1; k >= 0; k--) if (ids.includes(MATERIALS[k].id)) { fbPicked.delete(MATERIALS[k].id); fbExpanded.delete(MATERIALS[k].id); MATERIALS.splice(k, 1); }
  render();
  showToast({ type: "success", title: "Success", message: `${names.length} fabric${names.length === 1 ? "" : "s"} unlinked`, duration: 4000 });
}

fbMenu.addEventListener("click", e => {
  const a = e.target.closest("[data-fb]");
  if (!a) return;
  fbMenu.hidden = true;
  if (a.dataset.fb === "new") openFbNew();
  else if (a.dataset.fb === "existing") openFbLink();
  else if (a.dataset.fb === "unlink") unlinkFabrics([...fbPicked]);
  else showToast({ type: "success", title: "Info", message: "Create Recipe isn't available in this prototype yet", duration: 4000 });
});
fbRowMenu.addEventListener("click", e => {
  const a = e.target.closest("[data-fbrow]");
  if (!a || fbMenuFor === null) return;
  const id = fbMenuFor;
  closeFbMenus();
  if (a.dataset.fbrow === "groups") openFbGroups(id);
  else unlinkFabrics([id]);
});

// price group tick list (all price groups of the product, with their supplier)
function groupChecks(el, chosen, supplier) {
  const groups = Object.values(CATEGORY_VALUES).flat();
  const names = [...new Set(groups.map(g => g.name))];
  const sup = n => [...new Set(groups.filter(g => g.name === n).map(g => g.supplier))].join(", ");
  const list = supplier ? names.filter(n => groups.some(g => g.name === n && g.supplier === supplier)).concat(chosen.filter(n => !names.includes(n) || !groups.some(g => g.name === n && g.supplier === supplier))) : names;
  el.innerHTML = list.length
    ? [...new Set(list)].map(n => `<label class="fb-pg"><input type="checkbox" class="chk" value="${esc(n)}" ${chosen.includes(n) ? "checked" : ""}><span>${esc(n)}</span><small>${esc(sup(n))}</small></label>`).join("")
    : `<span class="fb-none">${supplier ? `No price groups for ${esc(supplier)} yet` : "No price groups yet"} — add them in Styles → Types.</span>`;
}
const tickedIn = el => [...el.querySelectorAll("input:checked")].map(x => x.value);

// ---- Edit Price Groups (one fabric) ----
let fbGroupsFor = null;
function openFbGroups(id) {
  const fb = MATERIALS.find(x => x.id === id);
  if (!fb) return;
  fbGroupsFor = id;
  document.getElementById("fbPgFor").textContent = fb.name;
  groupChecks(document.getElementById("fbPgList"), fabricGroups(fb), "");
  document.getElementById("fbPgModal").hidden = false;
}
document.getElementById("fbPgForm").addEventListener("submit", e => {
  e.preventDefault();
  const fb = MATERIALS.find(x => x.id === fbGroupsFor);
  fb.priceGroups = tickedIn(document.getElementById("fbPgList"));
  fb.colours.forEach(c => { c.priceGroups = []; }); // the fabric's price groups now apply to all its colours
  document.getElementById("fbPgModal").hidden = true;
  render();
  showToast({ type: "success", title: "Success", message: `Price groups updated for ${fb.name}`, duration: 3000 });
});
document.querySelectorAll("[data-fbpg-close]").forEach(b => b.addEventListener("click", () => { document.getElementById("fbPgModal").hidden = true; }));

// ---- Add New Fabric ----
const fbNewSupplier = document.getElementById("fbNewSupplier");
SUPPLIERS.forEach(n => fbNewSupplier.add(new Option(n, n)));
function openFbNew() {
  document.getElementById("fbNewForm").reset();
  ["fbNewName", "fbNewSupplier"].forEach(id => document.getElementById(id).classList.remove("invalid"));
  groupChecks(document.getElementById("fbNewGroups"), [], "");
  document.getElementById("fbNewModal").hidden = false;
  document.getElementById("fbNewName").focus();
}
fbNewSupplier.addEventListener("change", () => {
  fbNewSupplier.classList.remove("invalid");
  groupChecks(document.getElementById("fbNewGroups"), tickedIn(document.getElementById("fbNewGroups")), fbNewSupplier.value);
});
document.getElementById("fbNewName").addEventListener("input", e => e.target.classList.remove("invalid"));
document.getElementById("fbNewForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = document.getElementById("fbNewName").value.trim();
  const code = document.getElementById("fbNewCode").value.trim();
  const supplier = fbNewSupplier.value;
  document.getElementById("fbNewName").classList.toggle("invalid", !name);
  fbNewSupplier.classList.toggle("invalid", !supplier);
  if (!name || !supplier) { showToast({ title: "Error", message: `Please fill in: ${[!name && "Fabric Name", !supplier && "Supplier"].filter(Boolean).join(", ")}`, duration: 5000 }); return; }
  const key = `${name}|${code}|${supplier}`.toLowerCase();
  if (MATERIALS.some(fb => `${fb.name}|${fb.code}|${fb.supplier}`.toLowerCase() === key)) { showToast({ title: "Error", message: "Duplicate entry for Fabric Name" }); return; }
  MATERIALS.unshift({ id: fbUid("m"), name, code, description: "", supplier, partNo: "", priceGroups: tickedIn(document.getElementById("fbNewGroups")), colours: [] });
  document.getElementById("fbNewModal").hidden = true;
  render();
  showToast({ type: "success", title: "Success", message: `${name} added. Add its colours on Materials → Fabrics.`, duration: 4000 });
});
document.querySelectorAll("[data-fbnew-close]").forEach(b => b.addEventListener("click", () => { document.getElementById("fbNewModal").hidden = true; }));

// ---- Use Existing Fabric (Link Existing Fabric) ----
const FBL_COLS = [
  { key: "name", label: "Fabric Name" }, { key: "code", label: "Fabric Code" }, { key: "supplier", label: "Fabric Supplier" },
  { key: "groups", label: "Price Group Name" }, { key: "products", label: "Linked Products" }
];
const fblQ = FBL_COLS.map(() => "");
const fblPicked = new Set();
let fblPool = [];
document.getElementById("fbLinkFilter").innerHTML = `<th class="l-chk"></th>` + FBL_COLS.map((c, k) =>
  `<th><div class="cv-search"><button type="button" class="cv-sbtn" data-col="${k}" title="Search ${c.label}">${searchSvg}</button><input class="cv-sinput" data-col="${k}" placeholder="Search" autocomplete="off"></div></th>`).join("");
function openFbLink() {
  const mine = new Set(MATERIALS.map(fb => `${fb.name}|${fb.code}|${fb.supplier}`.toLowerCase()));
  fblPool = ProductStore.allMaterials()
    .filter(({ fabric }) => !mine.has(`${fabric.name}|${fabric.code}|${fabric.supplier}`.toLowerCase()))
    .map(({ fabric, products }) => ({ key: `${fabric.name}|${fabric.code}|${fabric.supplier}`.toLowerCase(), fabric,
      name: fabric.name, code: fabric.code || "", supplier: fabric.supplier, groups: fabricGroups(fabric).join(", "),
      products: products.filter(p => p.toLowerCase() !== PRODUCT_NAME.toLowerCase()).join(", ") || "Sample library" }));
  fblPicked.clear();
  fblQ.fill("");
  document.querySelectorAll("#fbLinkFilter .cv-search").forEach(b => { b.classList.remove("open"); b.querySelector("input").value = ""; });
  renderFbLink();
  document.getElementById("fbLinkModal").hidden = false;
}
const fblShown = () => fblPool.filter(r => FBL_COLS.every((c, k) => !fblQ[k] || String(r[c.key]).toLowerCase().includes(fblQ[k].trim().toLowerCase())));
function renderFbLink() {
  const rows = fblShown();
  document.getElementById("fbLinkRows").innerHTML = rows.length
    ? rows.map(r => `<tr class="${fblPicked.has(r.key) ? "picked" : ""}" data-key="${esc(r.key)}"><td class="l-chk"><input type="checkbox" class="chk" value="${esc(r.key)}" ${fblPicked.has(r.key) ? "checked" : ""} aria-label="Select ${esc(r.name)}"></td>${FBL_COLS.map(c => `<td title="${esc(r[c.key])}">${esc(r[c.key])}</td>`).join("")}</tr>`).join("")
    : `<tr class="l-empty"><td colspan="${FBL_COLS.length + 1}">${fblPool.length ? "No fabrics match your search" : "All existing fabrics are already linked to this product"}</td></tr>`;
  const all = document.getElementById("fbLinkAll");
  all.checked = rows.length > 0 && rows.every(r => fblPicked.has(r.key));
  all.indeterminate = !all.checked && rows.some(r => fblPicked.has(r.key));
  document.getElementById("fbLinkTotal").textContent = `Total Record: ${rows.length}${fblPicked.size ? ` · ${fblPicked.size} selected` : ""}`;
}
document.getElementById("fbLinkRows").addEventListener("change", e => { if (!e.target.classList.contains("chk")) return; e.target.checked ? fblPicked.add(e.target.value) : fblPicked.delete(e.target.value); renderFbLink(); });
document.getElementById("fbLinkRows").addEventListener("click", e => {
  const tr = e.target.closest("tr[data-key]");
  if (!tr || e.target.closest("input")) return;
  const box = tr.querySelector(".chk"); box.checked = !box.checked; box.dispatchEvent(new Event("change", { bubbles: true }));
});
document.getElementById("fbLinkAll").addEventListener("change", e => { fblShown().forEach(r => (e.target.checked ? fblPicked.add(r.key) : fblPicked.delete(r.key))); renderFbLink(); });
document.getElementById("fbLinkFilter").addEventListener("click", e => {
  const b = e.target.closest(".cv-sbtn");
  if (!b) return;
  const box = b.parentElement;
  if (box.classList.toggle("open")) box.querySelector("input").focus();
  else { fblQ[+b.dataset.col] = ""; box.querySelector("input").value = ""; renderFbLink(); }
});
document.getElementById("fbLinkFilter").addEventListener("input", e => { fblQ[+e.target.dataset.col] = e.target.value; renderFbLink(); });
document.getElementById("fbLinkSave").addEventListener("click", () => {
  if (!fblPicked.size) { showToast({ title: "Error", message: "Select at least one fabric to link" }); return; }
  const rows = fblPool.filter(r => fblPicked.has(r.key));
  rows.forEach(r => {
    const copy = JSON.parse(JSON.stringify(r.fabric));
    copy.id = fbUid("m");
    copy.colours.forEach(c => { c.id = fbUid("c"); });
    MATERIALS.unshift(copy);
  });
  document.getElementById("fbLinkModal").hidden = true;
  render();
  showToast({ type: "success", title: "Success", message: `${rows.length} fabric${rows.length === 1 ? "" : "s"} linked`, duration: 4000 });
});
document.getElementById("fbLinkAddNew").addEventListener("click", () => { document.getElementById("fbLinkModal").hidden = true; openFbNew(); });
document.querySelector("[data-fblink-close]").addEventListener("click", () => { document.getElementById("fbLinkModal").hidden = true; });

// Esc closes these popups / menus first
window.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const open = ["fbPgModal", "fbNewModal", "fbLinkModal"].find(id => !document.getElementById(id).hidden);
  if (open) { e.stopImmediatePropagation(); document.getElementById(open).hidden = true; return; }
  if (!fbMenu.hidden || fbMenuFor !== null) { e.stopImmediatePropagation(); fbMenu.hidden = true; closeFbMenus(); }
}, true);

render();
