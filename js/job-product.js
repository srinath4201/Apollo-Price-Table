// Product popup on Create Job ("Seq N - <product> Info").
// Its fields come from the product's Fields and Values setup (js/product-store.js):
// every field with "Show On Job Item" ON is shown, in the same order.
// Linked dropdowns: Supplier → Pricing Group Filter (styles) → Pricing Group → materials (e.g. Fabric).
// Uses from js/create-job.js: $, esc, money, todayDMY, jobItems, saveJobItem.
(function () {
  const modal = $("jpModal");
  const form = $("jpForm");
  const fieldsEl = $("jpFields");
  const TO_MM = { mm: 1, cm: 10, inch: 25.4 };
  const NUMERIC = new Set(["Numeric", "Numeric (X Square Meterage)", "Numeric (Y Square Meterage)", "Numeric (X Square Footage)",
    "Numeric (Y Square Footage)", "Numeric (X Square Yard)", "Numeric (Y Square Yard)", "Numeric Fraction", "Rate by Hour", "Blinds Opening Width"]);

  // role of a field in the popup, from its field type
  function roleOf(type) {
    if (type === "Unit Type") return "unit";
    if (type === "Qty") return "qty";
    if (type === "Numeric X") return "width";
    if (type === "Numeric Y") return "drop";
    if (type === "Supplier") return "supplier";
    if (type === ProductStore.FILTER_TYPE) return "ptype";
    if (type === "Pricing Group") return "pricing";
    if (ProductStore.MATERIAL_TYPES.has(type)) return "material";
    if (ProductStore.VALUE_TYPES.has(type)) return "list";
    if (NUMERIC.has(type)) return "number";
    return "text";
  }
  const SELECT_ROLES = new Set(["unit", "supplier", "ptype", "pricing", "material", "list"]);

  const infoIc = `<span class="i"><svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="6" fill="#111"/><path d="M6 5v4M6 3v.6" stroke="#fff" stroke-width="1.4"/></svg></span>`;
  const selCaret = `<svg width="10" height="6" viewBox="0 0 10 6"><path d="M0 0h10L5 6z" fill="#b5b9bd"/></svg>`;
  const comboCaret = `<span class="cb-caret"><svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="#777" stroke-width="1.4"><path d="M1 1l4 4 4-4"/></svg></span>`;

  // ---------- state for the open popup ----------
  let setup = null;   // ProductStore.load(product)
  let defs = [];      // [{ id, name, type, role, info, req, filter? }]
  let current = null; // { product, group, index }
  let vatOn = true;

  const el = d => $(d.id);
  const byRole = role => defs.filter(d => d.role === role);
  const firstVal = role => { const d = byRole(role)[0]; return d ? el(d).value : ""; };
  const num = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };

  // ---------- options for each linked dropdown ----------
  const filterField = () => setup.fields.find(f => f[2] === ProductStore.FILTER_TYPE);
  const groupsOf = type => setup.typeGroups[type] || [];

  function supplierOptions() {
    const ff = filterField();
    return ff && ff[7].supplier && ff[7].supplier.length ? ff[7].supplier : ProductStore.SUPPLIERS;
  }
  function typeOptions(d) {
    const supplier = firstVal("supplier");
    const types = d.filter.linkedTypes || [];
    return supplier ? types.filter(t => groupsOf(t).some(g => g.supplier === supplier)) : types;
  }
  function pricingOptions() {
    const supplier = firstVal("supplier");
    const type = firstVal("ptype");
    const hasTypeField = byRole("ptype").length > 0;
    const pool = hasTypeField ? groupsOf(type) : Object.values(setup.typeGroups).flat();
    return [...new Set(pool.filter(g => !supplier || g.supplier === supplier).map(g => g.name))];
  }
  function valueOptions(d) {
    const values = setup.fieldValues[d.name] || [];
    if (d.role !== "material") return values;
    const pricing = firstVal("pricing");
    return values.filter(v => !v.priceGroup || v.priceGroup === pricing);
  }

  // which upstream choice a dropdown waits for (label shown when it is empty)
  function waitingFor(d) {
    if (d.role === "ptype" && byRole("supplier").length && !firstVal("supplier")) return byRole("supplier")[0].name;
    if (d.role === "pricing") {
      if (byRole("ptype").length && !firstVal("ptype")) return byRole("ptype")[0].name;
      if (!byRole("ptype").length && byRole("supplier").length && !firstVal("supplier")) return byRole("supplier")[0].name;
    }
    if (d.role === "material" && byRole("pricing").length && !firstVal("pricing")) return byRole("pricing")[0].name;
    return null;
  }

  function optionsFor(d) {
    switch (d.role) {
      case "unit": return ["mm", "cm", "inch"].map(v => ({ value: v }));
      case "supplier": return supplierOptions().map(v => ({ value: v }));
      case "ptype": return typeOptions(d).map(v => ({ value: v }));
      case "pricing": return pricingOptions().map(v => ({ value: v }));
      default: return valueOptions(d);
    }
  }

  // (re)build one dropdown, keeping its value when still allowed
  function fillSelect(d) {
    const sel = el(d);
    const keep = sel.value;
    const wait = waitingFor(d);
    const opts = wait ? [] : optionsFor(d);
    const blank = d.role === "unit" ? "" :
      `<option value="">${wait ? `Select ${esc(wait)} first` : opts.length ? "Select" : "No options"}</option>`;
    sel.innerHTML = blank + opts.map(o => `<option value="${esc(o.value)}"${o.outOfStock ? ' data-oos="1"' : ""}>${esc(o.value)}${o.outOfStock ? " (out of stock)" : ""}</option>`).join("");
    sel.disabled = !!wait;
    sel.value = opts.some(o => o.value === keep) ? keep : (d.role === "unit" ? "mm" : "");
    checkStock(d);
  }

  // out-of-stock message under a value dropdown
  function checkStock(d) {
    const msg = $(`${d.id}-msg`);
    if (!msg) return;
    const sel = el(d);
    const opt = sel.selectedOptions[0];
    const bad = !!(opt && opt.dataset.oos);
    sel.closest(".jp-combo").classList.toggle("stock-err", bad);
    msg.hidden = !bad;
    msg.textContent = bad ? `${sel.value} out of stock` : "";
    $(`${d.id}-lbl`).classList.toggle("span2", bad);
  }

  // order of the chain; changing one refreshes everything after it
  const CHAIN = ["supplier", "ptype", "pricing", "material"];
  function refreshAfter(role) {
    const from = CHAIN.indexOf(role);
    CHAIN.slice(from + 1).forEach(r => byRole(r).forEach(fillSelect));
  }

  // ---------- build the form from the product's fields ----------
  function fieldHtml(d) {
    const label = `<label class="jp-lbl" for="${d.id}" id="${d.id}-lbl"${d.info ? ` title="${esc(d.info)}"` : ""}>${esc(d.name)}${d.req ? "<sup>*</sup>" : ""}${d.info ? infoIc : ""}</label>`;
    let control;
    if (d.role === "unit" || d.role === "supplier" || d.role === "ptype" || d.role === "pricing") {
      control = `<div class="jp-sel main"><select id="${d.id}" data-role="${d.role}"></select>${selCaret}</div>`;
    } else if (d.role === "material" || d.role === "list") {
      control = `<div class="jp-combo"><select id="${d.id}" data-role="${d.role}"></select>${comboCaret}</div>`;
    } else if (d.role === "width" || d.role === "drop") {
      control = `<div class="jp-unit"><input class="jp-in" id="${d.id}" data-role="${d.role}" inputmode="decimal" autocomplete="off"><span class="u">mm</span></div>`;
    } else {
      const numeric = d.role === "qty" || d.role === "number";
      control = `<input class="jp-in" id="${d.id}" data-role="${d.role}" ${numeric ? 'inputmode="decimal"' : ""} autocomplete="off">`;
    }
    const msg = d.role === "material" || d.role === "list" ? `<div class="stock-msg" id="${d.id}-msg" role="alert" hidden></div>` : "";
    return label + control + msg;
  }

  function build() {
    defs = setup.fields
      .filter(f => f[6]) // Show On Job Item
      .map((f, k) => ({ id: `jpf-${k}`, name: f[0], type: f[2], info: f[3], req: !!f[4], role: roleOf(f[2]), filter: f[7] || {} }));
    const half = Math.ceil(defs.length / 2);
    const col = list => `<div class="jp-col">${list.map(fieldHtml).join("")}</div>`;
    fieldsEl.innerHTML = defs.length
      ? col(defs.slice(0, half)) + col(defs.slice(half))
      : `<p class="jp-none">No fields are set to show on job items for this product. Turn on <b>Show On Job Item</b> in Fields and Values.</p>`;
    // fill dropdowns in chain order so each one sees the one before it
    ["unit", "supplier", "ptype", "pricing", "material", "list"].forEach(r => byRole(r).forEach(fillSelect));
  }

  function syncUnits() {
    const u = firstVal("unit") || "mm";
    fieldsEl.querySelectorAll(".jp-unit .u").forEach(s => { s.textContent = u; });
  }

  // ---------- price ----------
  function gridFor(pricing) {
    const g = Object.values(setup.typeGroups).flat().find(x => x.name === pricing && x.grid);
    return g ? g.grid : ProductStore.SAMPLE_GRID;
  }
  function priceFor(grid, widthMm, dropMm) {
    if (!dropMm && !widthMm) return 0;
    const c = widthMm ? grid.widths.findIndex(w => w >= widthMm) : 0;
    const r = dropMm ? grid.drops.findIndex(dd => dd >= dropMm) : 0;
    const row = grid.prices[r === -1 ? grid.drops.length - 1 : r] || [];
    return Number(row[c === -1 ? grid.widths.length - 1 : c]) || 0;
  }
  function calc() {
    const f = TO_MM[firstVal("unit")] || 1;
    const qtyField = byRole("qty")[0];
    const qty = qtyField ? Math.max(0, num(el(qtyField).value)) : 1;
    const needsWidth = byRole("width").length > 0;
    const width = num(firstVal("width")) * f;
    const drop = num(firstVal("drop")) * f;
    const unitPrice = needsWidth && !width ? 0 : priceFor(gridFor(firstVal("pricing")), width, drop);
    const override = num($("jpOverride").value);
    const net = override > 0 ? override : unitPrice * qty;
    const vat = vatOn ? net * num($("jpVatRate").value) / 100 : 0;
    const gross = net + vat;
    const mode = $("jpRound").value;
    const rounded = mode === "up" ? Math.ceil(gross) : mode === "down" ? Math.floor(gross) : mode === "nearest" ? Math.round(gross) : null;
    $("jpNet").textContent = money(net);
    $("jpVat").textContent = money(vat);
    $("jpGross").textContent = money(gross);
    $("jpRounded").textContent = rounded === null || !gross ? "" : money(rounded);
    return { qty, net, vat, gross };
  }

  fieldsEl.addEventListener("input", e => { e.target.classList.remove("invalid"); calc(); });
  fieldsEl.addEventListener("change", e => {
    const d = defs.find(x => x.id === e.target.id);
    if (!d) return;
    e.target.classList.remove("invalid");
    e.target.closest(".jp-combo")?.classList.remove("invalid");
    checkStock(d);
    if (CHAIN.includes(d.role)) refreshAfter(d.role);
    if (d.role === "unit") syncUnits();
    calc();
  });
  ["jpVatRate", "jpRound"].forEach(id => $(id).addEventListener("change", calc));
  $("jpOverride").addEventListener("input", calc);
  $("jpOverride").addEventListener("focusout", e => { e.target.value = money(num(e.target.value)); calc(); });
  $("jpVatOn").addEventListener("click", e => {
    vatOn = !vatOn;
    e.currentTarget.setAttribute("aria-pressed", String(vatOn));
    e.currentTarget.firstChild.textContent = vatOn ? "On" : "Off";
    calc();
  });

  $("jpReady").addEventListener("click", e => {
    const b = e.currentTarget;
    const ready = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(ready));
    b.lastChild.textContent = ready ? "Ready" : "Not Ready";
  });

  form.querySelector(".jp-tabs").addEventListener("click", e => {
    const t = e.target.closest(".jp-tab");
    if (!t) return;
    form.querySelectorAll(".jp-tab").forEach(x => x.classList.toggle("active", x === t));
    form.querySelectorAll(".jp-pane").forEach(p => { p.hidden = p.dataset.jpPane !== t.dataset.jpTab; });
  });
  form.querySelectorAll(".jp-acc").forEach(b => b.addEventListener("click", () => {
    const open = b.classList.toggle("open");
    form.querySelector(`[data-acc-body="${b.dataset.acc}"]`).hidden = !open;
  }));

  // product pictures (samples)
  const IMAGES = [
    "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#f4f1ea"/><rect x="18" y="8" width="84" height="6" rx="3" fill="#555"/><rect x="22" y="14" width="76" height="52" fill="#c9b99a"/><rect x="22" y="62" width="76" height="4" fill="#8a7a5c"/><line x1="96" y1="14" x2="96" y2="58" stroke="#777" stroke-dasharray="2 2"/></svg>`),
    "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#eef1f4"/><g fill="#9aa3ad">${Array.from({ length: 7 }, (_, i) => `<rect x="22" y="${10 + i * 8}" width="76" height="4"/>`).join("")}</g></svg>`),
    "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#f2f2f2"/><rect x="20" y="10" width="36" height="60" fill="#6b7a8a"/><rect x="64" y="10" width="36" height="60" fill="#6b7a8a"/><circle cx="60" cy="40" r="5" fill="#fff"/></svg>`)
  ];
  let img = 0;
  $("jpThumbs").innerHTML = IMAGES.map((src, i) => `<button type="button" class="th" data-img="${i}" style="background-image:url('${src}')" aria-label="Picture ${i + 1}"></button>`).join("");
  function showImage(i) {
    img = (i + IMAGES.length) % IMAGES.length;
    $("jpImage").style.backgroundImage = `url('${IMAGES[img]}')`;
    $("jpThumbs").querySelectorAll(".th").forEach((t, k) => t.classList.toggle("active", k === img));
  }
  $("jpThumbs").addEventListener("click", e => { const t = e.target.closest("[data-img]"); if (t) showImage(+t.dataset.img); });
  form.querySelectorAll(".th-arrow").forEach(b => b.addEventListener("click", () => showImage(img + Number(b.dataset.thumb))));

  // ---------- open / save ----------
  // saved values are kept by field name; restore them in chain order
  function restore(values) {
    const order = ["unit", "supplier", "ptype", "pricing", "material", "list", "qty", "width", "drop", "number", "text"];
    order.forEach(role => byRole(role).forEach(d => {
      const v = values ? values[d.name] : undefined;
      if (v === undefined) {
        if (d.role === "qty") el(d).value = "1";
        return;
      }
      el(d).value = v;
      if (SELECT_ROLES.has(d.role)) { checkStock(d); refreshAfter(d.role); }
    }));
    syncUnits();
  }

  function openJobProduct({ product, group, index = null, data = null }) {
    current = { product, group, index };
    setup = ProductStore.load(product);
    const seq = index === null ? jobItems.length + 1 : index + 1;
    $("jpTitle").textContent = `Seq ${seq} - ${product} Info`;
    build();
    restore(data && data.values);
    $("jpStatus").value = data?.status || "";
    $("jpRecipe").value = data?.recipe || "Standard";
    $("jpScan").value = "";
    const ready = !!data?.ready;
    $("jpReady").setAttribute("aria-pressed", String(ready));
    $("jpReady").lastChild.textContent = ready ? "Ready" : "Not Ready";
    $("jpCreated").value = data?.created || todayDMY();
    $("jpDue").value = data?.due || "";
    vatOn = data?.vatOn ?? true;
    $("jpVatOn").setAttribute("aria-pressed", String(vatOn));
    $("jpVatOn").firstChild.textContent = vatOn ? "On" : "Off";
    $("jpVatRate").value = data?.vatRate || "16";
    $("jpRound").value = data?.round || "up";
    $("jpOverride").value = money(data?.override || 0);
    $("jpError").textContent = "";
    form.querySelectorAll(".jp-tab").forEach((t, i) => t.classList.toggle("active", i === 0));
    form.querySelectorAll(".jp-pane").forEach((p, i) => { p.hidden = i !== 0; });
    showImage(0);
    closeSaveMenu();
    calc();
    modal.hidden = false;
    (fieldsEl.querySelector("select:not(:disabled), input") || $("jpStatus")).focus();
  }

  function closeJobProduct() {
    closeSaveMenu();
    modal.hidden = true;
    current = null;
  }

  function collect() {
    const values = {};
    defs.forEach(d => { values[d.name] = el(d).value.trim(); });
    return {
      values,
      unit: firstVal("unit") || "mm",
      status: $("jpStatus").value, recipe: $("jpRecipe").value, ready: $("jpReady").getAttribute("aria-pressed") === "true",
      created: $("jpCreated").value, due: $("jpDue").value, vatOn, vatRate: $("jpVatRate").value,
      round: $("jpRound").value, override: num($("jpOverride").value)
    };
  }

  // returns the saved item, or null when a required field is missing
  function save() {
    const numericRoles = new Set(["qty", "width", "drop", "number"]);
    const missing = defs.filter(d => d.req && !(numericRoles.has(d.role) ? num(el(d).value) > 0 : el(d).value.trim()));
    defs.forEach(d => {
      const bad = missing.includes(d);
      el(d).classList.toggle("invalid", bad);
      el(d).closest(".jp-combo")?.classList.toggle("invalid", bad);
    });
    if (missing.length) {
      $("jpError").textContent = `Please fill in: ${missing.map(d => d.name).join(", ")}`;
      el(missing[0]).focus();
      return null;
    }
    const data = collect();
    const p = calc();
    const u = data.unit;
    const w = firstVal("width"), dr = firstVal("drop");
    const size = w && dr ? `W ${w}${u} x D ${dr}${u}` : w ? `W ${w}${u}` : dr ? `D ${dr}${u}` : "";
    const description = [size, ...["ptype", "pricing", "material", "supplier"].map(firstVal), firstVal("text")].filter(Boolean).join(", ");
    const item = { product: current.product, group: current.group, description, cost: p.net, qty: p.qty, unit: p.qty ? p.net / p.qty : 0, net: p.net, vat: p.vat, data };
    saveJobItem(item, current.index);
    return item;
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (save()) closeJobProduct();
  });

  // Save ▾ → Save and add another (same product, new sequence)
  const saveMenu = $("jpSaveMenu");
  function closeSaveMenu() { saveMenu.hidden = true; }
  $("jpSaveMenuBtn").addEventListener("click", e => { e.stopPropagation(); saveMenu.hidden = !saveMenu.hidden; });
  saveMenu.addEventListener("click", e => {
    if (!e.target.closest('[data-save="another"]')) return;
    closeSaveMenu();
    const { product, group } = current;
    if (save()) openJobProduct({ product, group, index: null });
  });
  document.addEventListener("click", e => { if (!saveMenu.hidden && !saveMenu.contains(e.target)) closeSaveMenu(); });

  // Copy → save this one, then open a new sequence with the same values
  $("jpCopy").addEventListener("click", () => {
    const { product, group } = current;
    const item = save();
    if (item) openJobProduct({ product, group, index: null, data: { ...item.data, created: todayDMY() } });
  });

  modal.querySelectorAll("[data-jp-close]").forEach(b => b.addEventListener("click", closeJobProduct));
  window.addEventListener("keydown", e => {
    if (e.key !== "Escape" || modal.hidden) return;
    e.stopImmediatePropagation();
    saveMenu.hidden ? closeJobProduct() : closeSaveMenu();
  }, true);

  window.openJobProduct = openJobProduct;
})();
