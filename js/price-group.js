// "Add Price Group" popup (Types → price groups → ⋯ → Add New Price)
// and its "Add price table" popup.
// Uses from js/product-fields.js: esc, SUPPLIERS, supplierMs, createMultiSelect, addPriceGroupRows.
(function () {
  const $ = id => document.getElementById(id);

  // ---- Sample price tables (from the reference screen) ----
  const SAMPLE_WIDTHS = [600, 760, 900, 1070, 1200, 1370, 1520, 1680, 1830, 2000, 2150, 2300, 2420, 2590];
  const SAMPLE_DROPS = [1200, 1800, 2400, 3000];
  const SAMPLE_PRICES = [
    [28, 33, 38, 45, 47, 55, 60, 65, 69, 82, 93, 96, 102, 110],
    [33, 42, 49, 58, 67, 73, 79, 88, 95, 113, 123, 132, 139, 147],
    [42, 49, 60, 68, 79, 88, 96, 106, 114, 139, 151, 160, 170, 182],
    [52, 62, 68, 79, 95, 102, 113, 123, 132, 0, 0, 0, 0, 0]
  ];
  const SAMPLE_TABLES = ["50mm Economy", "89mm C", "89mm_2025"];
  const MARKUP_ROWS = ["Domestic", "Contract", "Trade", "Retail", "Commercial", "Interior designers", "Project"];
  const SHOW_ON = ["Job Item", "Online Portal", "Ecommerce", "Mobile App"];

  const makeTable = (name, code = "", prices) => ({
    name, code,
    widths: [...SAMPLE_WIDTHS],
    drops: [...SAMPLE_DROPS],
    prices: prices ? prices.map(r => [...r]) : SAMPLE_DROPS.map(() => SAMPLE_WIDTHS.map(() => 0)),
    selRows: new Set(),
    selCols: new Set()
  });

  // ---- State ----
  let forCategory = null; // Types row the new price group goes into
  let tables = [];
  let active = 0;

  const pgModal = $("pgModal");
  const grid = $("ptGrid");
  const tabsEl = $("ptTabs");
  const supplierSel = $("pgmSupplier");
  const content = $("pgmContent");
  const fmt = n => (Math.round(n * 100) / 100).toFixed(2);
  const num = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };

  SUPPLIERS.forEach(n => supplierSel.add(new Option(n, n)));

  // Markup rows
  $("markupRows").innerHTML = MARKUP_ROWS.map((label, i) => `<div class="mk-row">
      <label for="mk${i}">${label}</label>
      <div class="pfx"><span>£</span><input id="mk${i}" value="0.00" inputmode="decimal" autocomplete="off"></div>
      <div class="m-select mk-op">
        <select aria-label="${label} operator"><option>*</option><option>+</option><option>%</option></select>
        <svg width="8" height="5" viewBox="0 0 8 5"><path d="M0 0h8L4 5z" fill="#b5b9bd"/></svg>
      </div>
      <button type="button" class="toggle off" aria-pressed="false" aria-label="${label} price inclusive of VAT">OFF<span class="knob"></span></button>
    </div>`).join("");
  $("markupRows").addEventListener("click", e => {
    const t = e.target.closest(".toggle");
    if (!t) return;
    const on = t.classList.toggle("off") === false;
    t.firstChild.textContent = on ? "ON" : "OFF";
    t.setAttribute("aria-pressed", String(on));
  });

  // "Show this Price Group on" multi-select
  const showMs = createMultiSelect($("pgmShow"), SHOW_ON, {
    summary: p => p.join(", "),
    emptyText: "No options found"
  });

  // ---------- Tabs + grid ----------
  function renderTabs() {
    tabsEl.innerHTML = tables.map((t, i) =>
      `<button type="button" role="tab" class="pt-tab${i === active ? " active" : ""}" aria-selected="${i === active}" data-i="${i}" title="${esc(t.name)}${t.code ? ` (${esc(t.code)})` : ""}">${esc(t.name)}</button>`).join("");
    const has = tables.length > 0;
    $("ptArea").hidden = !has;
    $("ptEmpty").hidden = has;
    document.querySelector(".pt-label").hidden = !has;
  }

  const arrowRight = `<svg width="9" height="8" viewBox="0 0 9 8" fill="none" stroke="#222" stroke-width="1.4"><path d="M0 4h8M5 1l3 3-3 3"/></svg>`;
  const arrowDown = `<svg width="8" height="9" viewBox="0 0 8 9" fill="none" stroke="#222" stroke-width="1.4"><path d="M4 0v8M1 5l3 3 3-3"/></svg>`;

  function renderGrid() {
    const t = tables[active];
    if (!t) { grid.innerHTML = ""; return; }
    const allRows = t.drops.length > 0 && t.drops.every((_, r) => t.selRows.has(r));
    const isSel = (r, c) => t.selRows.has(r) || t.selCols.has(c);
    grid.innerHTML = `
      <thead>
        <tr>
          <th class="c-sel"><input type="checkbox" class="pt-chk" data-all ${allRows ? "checked" : ""} aria-label="Select all drops"></th>
          <th class="c-drop"><span class="arrow">Width ${arrowRight}</span></th>
          ${t.widths.map((_, c) => `<th class="c-price"><input type="checkbox" class="pt-chk" data-col="${c}" ${t.selCols.has(c) ? "checked" : ""} aria-label="Select width column ${c + 1}"></th>`).join("")}
        </tr>
        <tr>
          <th class="c-sel"><span class="arrow">Drop ${arrowDown}</span></th>
          <th class="c-drop"><span class="mm">mm</span></th>
          ${t.widths.map((w, c) => `<th class="c-price"><input class="pt-in head" data-kind="w" data-c="${c}" value="${fmt(w)}" inputmode="decimal" aria-label="Width ${c + 1}"></th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${t.drops.map((d, r) => `<tr>
          <td class="c-sel"><input type="checkbox" class="pt-chk" data-row="${r}" ${t.selRows.has(r) ? "checked" : ""} aria-label="Select drop row ${r + 1}"></td>
          <td class="c-drop"><input class="pt-in head" data-kind="d" data-r="${r}" value="${fmt(d)}" inputmode="decimal" aria-label="Drop ${r + 1}"></td>
          ${t.prices[r].map((p, c) => `<td class="c-price${isSel(r, c) ? " sel" : ""}"><input class="pt-in" data-kind="p" data-r="${r}" data-c="${c}" value="${fmt(p)}" inputmode="decimal" aria-label="Price drop ${fmt(d)} width ${fmt(t.widths[c])}"></td>`).join("")}
        </tr>`).join("")}
      </tbody>`;
  }

  const renderAll = () => { renderTabs(); renderGrid(); };

  tabsEl.addEventListener("click", e => {
    const tab = e.target.closest(".pt-tab");
    if (!tab) return;
    active = Number(tab.dataset.i);
    renderAll();
  });

  // edit widths / drops / prices
  grid.addEventListener("input", e => {
    const inp = e.target;
    if (!inp.classList.contains("pt-in")) return;
    const t = tables[active];
    const v = num(inp.value);
    if (inp.dataset.kind === "w") t.widths[inp.dataset.c] = v;
    else if (inp.dataset.kind === "d") t.drops[inp.dataset.r] = v;
    else t.prices[inp.dataset.r][inp.dataset.c] = Math.max(0, v);
  });
  grid.addEventListener("focusout", e => {
    if (e.target.classList.contains("pt-in")) e.target.value = fmt(num(e.target.value));
  });
  grid.addEventListener("focusin", e => {
    if (e.target.classList.contains("pt-in")) e.target.select();
  });

  // row / column selection
  grid.addEventListener("change", e => {
    const box = e.target;
    if (!box.classList.contains("pt-chk")) return;
    const t = tables[active];
    if (box.dataset.all !== undefined) t.drops.forEach((_, r) => (box.checked ? t.selRows.add(r) : t.selRows.delete(r)));
    else if (box.dataset.row !== undefined) box.checked ? t.selRows.add(+box.dataset.row) : t.selRows.delete(+box.dataset.row);
    else box.checked ? t.selCols.add(+box.dataset.col) : t.selCols.delete(+box.dataset.col);
    renderGrid();
  });

  // + width column / + drop row
  $("ptAddCol").addEventListener("click", () => {
    const t = tables[active];
    const last = t.widths[t.widths.length - 1] || 0;
    t.widths.push(last + 150);
    t.prices.forEach(row => row.push(0));
    renderGrid();
    grid.parentElement.scrollLeft = grid.parentElement.scrollWidth;
    grid.querySelector(`[data-kind="w"][data-c="${t.widths.length - 1}"]`).focus();
  });
  $("ptAddRow").addEventListener("click", () => {
    const t = tables[active];
    const last = t.drops[t.drops.length - 1] || 0;
    t.drops.push(last + 600);
    t.prices.push(t.widths.map(() => 0));
    renderGrid();
    grid.querySelector(`[data-kind="d"][data-r="${t.drops.length - 1}"]`).focus();
  });

  // ---------- Price Increase/Decrease ----------
  const adjMsg = $("adjMsg");
  const setMsg = (text, ok) => { adjMsg.textContent = text; adjMsg.classList.toggle("ok", !!ok); };
  $("adjType").addEventListener("change", e => { $("adjUnit").textContent = e.target.value === "percent" ? "%" : "£"; setMsg(""); });
  $("adjValue").addEventListener("input", () => setMsg(""));

  document.querySelectorAll(".adj-btn").forEach(btn => btn.addEventListener("click", () => {
    const t = tables[active];
    if (!t) return;
    const scope = (document.querySelector('input[name="pgmScope"]:checked') || {}).value;
    const type = $("adjType").value;
    const amount = num($("adjValue").value);
    if (!scope) return setMsg("Choose Whole Value or Selection");
    if (!type) return setMsg("Choose Amount or Percentage");
    if (!amount) return setMsg("Enter a value");
    if (scope === "selection" && !t.selRows.size && !t.selCols.size) return setMsg("Tick the drops or widths to change");

    const sign = Number(btn.dataset.adj);
    let count = 0;
    t.prices.forEach((row, r) => row.forEach((p, c) => {
      if (scope === "selection" && !(t.selRows.has(r) || t.selCols.has(c))) return;
      const next = type === "percent" ? p * (1 + sign * amount / 100) : p + sign * amount;
      row[c] = Math.max(0, Math.round(next * 100) / 100);
      count++;
    }));
    renderGrid();
    grid.querySelectorAll(scope === "selection" ? "td.sel" : "td.c-price").forEach(td => td.classList.add("flash"));
    setMsg(`${sign > 0 ? "Increased" : "Decreased"} ${count} price${count === 1 ? "" : "s"}`, true);
  }));

  // ---------- Side panel collapse ----------
  $("pgmCollapse").addEventListener("click", () => {
    const hidden = content.classList.toggle("side-hidden");
    $("pgmCollapse").title = hidden ? "Show side panel" : "Hide side panel";
  });

  // ---------- Open / close / save ----------
  function openPriceGroup(category) {
    forCategory = category;
    tables = SAMPLE_TABLES.map(n => makeTable(n, "", SAMPLE_PRICES));
    active = 0;
    const allowed = supplierMs.values().length ? supplierMs.values() : SUPPLIERS;
    supplierSel.innerHTML = "";
    allowed.forEach(n => supplierSel.add(new Option(n, n)));
    supplierSel.value = allowed[0];
    document.querySelectorAll('input[name="pgmScope"]').forEach(r => { r.checked = false; });
    $("adjType").value = "";
    $("adjUnit").textContent = "£";
    $("adjValue").value = "";
    setMsg("");
    document.querySelectorAll("#markupRows .mk-row").forEach(row => {
      row.querySelector("input").value = "0.00";
      row.querySelector("select").selectedIndex = 0;
      const t = row.querySelector(".toggle");
      t.classList.add("off"); t.firstChild.textContent = "OFF"; t.setAttribute("aria-pressed", "false");
    });
    $("pgmDiscount").value = "0.00";
    showMs.clear();
    showMs.add("Job Item");
    showMs.add("Online Portal");
    $("pgmError").textContent = "";
    content.classList.remove("side-hidden");
    closePtMenu();
    renderAll();
    pgModal.hidden = false;
    supplierSel.focus();
  }
  function closePriceGroup() {
    closePtMenu();
    showMs.close();
    pgModal.hidden = true;
    forCategory = null;
  }

  $("pgmSave").addEventListener("click", () => {
    const supplier = supplierSel.value;
    if (!supplier) { $("pgmError").textContent = "Choose a supplier"; supplierSel.focus(); return; }
    if (!tables.length) { $("pgmError").textContent = "Add at least one price table"; return; }
    const category = forCategory;
    closePriceGroup();
    // each price table becomes a price group row under the type
    addPriceGroupRows(category, tables.map(t => ({
      name: t.name, supplier, code: t.code,
      grid: { widths: [...t.widths], drops: [...t.drops], prices: t.prices.map(r => [...r]) }
    })));
  });
  pgModal.querySelector("[data-pgm-close]").addEventListener("click", closePriceGroup);
  $("pgmDiscount").addEventListener("focusout", e => { e.target.value = fmt(num(e.target.value)); });
  $("markupRows").addEventListener("focusout", e => {
    if (e.target.matches(".pfx input")) e.target.value = fmt(num(e.target.value));
  });

  // ---------- Price table options (caret next to Add New Price Table) ----------
  const ptMenu = $("ptMenu");
  function closePtMenu() { ptMenu.hidden = true; }
  $("ptMenuBtn").addEventListener("click", e => {
    e.stopPropagation();
    ptMenu.hidden = !ptMenu.hidden;
    ptMenu.querySelectorAll("button").forEach(b => { b.disabled = !tables.length; });
  });
  document.addEventListener("click", e => { if (!ptMenu.hidden && !ptMenu.contains(e.target)) closePtMenu(); });
  ptMenu.addEventListener("click", e => {
    const item = e.target.closest("[data-pt-action]");
    if (!item || !tables.length) return;
    closePtMenu();
    if (item.dataset.ptAction === "rename") openPtModal(active);
    else if (confirm(`Delete price table "${tables[active].name}"?`)) {
      tables.splice(active, 1);
      active = Math.max(0, Math.min(active, tables.length - 1));
      renderAll();
    }
  });

  // ---------- Add / rename price table popup ----------
  const ptModal = $("ptModal");
  const ptForm = $("ptForm");
  const ptName = $("ptName");
  const ptCode = $("ptCode");
  const ptError = $("ptError");
  let editing = null; // index when renaming, null when adding

  function openPtModal(index = null) {
    editing = index;
    ptForm.reset();
    ptName.classList.remove("invalid");
    ptError.textContent = "";
    $("ptTitle").textContent = index === null ? "Add price table" : "Edit price table";
    if (index !== null) { ptName.value = tables[index].name; ptCode.value = tables[index].code; }
    ptModal.hidden = false;
    ptName.focus();
  }
  function closePtModal() {
    ptModal.hidden = true;
    $("ptAddBtn").focus();
  }

  $("ptAddBtn").addEventListener("click", () => openPtModal());
  ptModal.querySelectorAll("[data-pt-close]").forEach(b => b.addEventListener("click", closePtModal));
  ptName.addEventListener("input", () => { ptName.classList.remove("invalid"); ptError.textContent = ""; });

  ptForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = ptName.value.trim();
    const dup = tables.find((t, i) => i !== editing && t.name.toLowerCase() === name.toLowerCase());
    const msg = !name ? "Price table name is required" : dup ? `"${dup.name}" already exists` : "";
    ptName.classList.toggle("invalid", !!msg);
    ptError.textContent = msg;
    if (msg) { ptName.focus(); return; }

    if (editing === null) {
      // new table uses the current widths/drops, prices start at 0.00
      const base = tables[active];
      const t = makeTable(name, ptCode.value.trim());
      if (base) {
        t.widths = [...base.widths];
        t.drops = [...base.drops];
        t.prices = base.drops.map(() => base.widths.map(() => 0));
      }
      tables.push(t);
      active = tables.length - 1;
    } else {
      tables[editing].name = name;
      tables[editing].code = ptCode.value.trim();
    }
    closePtModal();
    renderAll();
  });

  // ---------- Esc: innermost first (runs before the page's other Esc handlers) ----------
  window.addEventListener("keydown", e => {
    if (e.key !== "Escape" || pgModal.hidden) return;
    if ($("pgmShow").classList.contains("open")) return; // the list closes itself
    e.stopImmediatePropagation();
    if (!ptModal.hidden) closePtModal();
    else if (!ptMenu.hidden) closePtMenu();
    else closePriceGroup();
  }, true);

  window.openPriceGroup = openPriceGroup;
})();
