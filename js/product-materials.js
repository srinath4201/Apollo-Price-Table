// Product > Materials > Fabrics.
// Fabrics and their colours are saved per product in js/product-store.js. Each colour is linked to
// types (the product's Pricing Group Filter values) and optionally price groups; the Create Job
// product popup lists only the colours that match the chosen Supplier / type / price group.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PRODUCT = new URLSearchParams(location.search).get("name") || "Zebra blinds";
  const setup = ProductStore.load(PRODUCT);
  const materials = setup.materials;
  const uid = p => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const copy = o => JSON.parse(JSON.stringify(o));
  const keyOf = f => `${f.name}|${f.code}|${f.supplier}`.trim().toLowerCase();
  const save = () => ProductStore.save(PRODUCT, { materials });

  // types offered in "Linked Products": the Pricing Group Filter field's linked types
  function productTypes() {
    const ff = setup.fields.find(f => f[2] === ProductStore.FILTER_TYPE);
    const types = ff && ff[7].linkedTypes && ff[7].linkedTypes.length ? ff[7].linkedTypes : setup.productTypes;
    return [...new Set(types)];
  }
  // price groups of the given types (for the fabric's supplier when one is picked)
  function priceGroups(types, supplier) {
    const pool = (types.length ? types : productTypes()).flatMap(t => setup.typeGroups[t] || []);
    return [...new Set(pool.filter(g => !supplier || g.supplier === supplier).map(g => g.name))];
  }

  const searchSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa6ad" stroke-width="2.4"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>`;
  const priceText = c => (c.hasPrice && c.price !== "" ? `£ ${(Number(c.price) || 0).toFixed(2)}` : "");
  const stockText = c => (c.hasStock ? (Number(c.stock) > 0 ? String(Number(c.stock)) : "Out of stock") : "");

  // ---------- Fabrics table (one row per colour) ----------
  const COLS = [
    { key: "supplier", label: "Supplier" }, { key: "fabric", label: "Fabric Name" }, { key: "fabricCode", label: "Fabric Code" },
    { key: "colour", label: "Colour Name" }, { key: "colourCode", label: "Colour Code" }, { key: "price", label: "Prices" },
    { key: "minW", label: "Min Width" }, { key: "maxW", label: "Max Width" }, { key: "minD", label: "Min Drop" }, { key: "maxD", label: "Max Drop" },
    { key: "types", label: "Linked Types", wide: true }, { key: "groups", label: "Price Groups", wide: true }, { key: "stock", label: "Stock" }
  ];
  const q = COLS.map(() => "");
  const picked = new Set(); // row keys "fabricId:colourId"

  function tableRows() {
    return materials.flatMap(f => (f.colours.length ? f.colours : [null]).map(c => ({
      key: `${f.id}:${c ? c.id : ""}`, f, c,
      supplier: f.supplier, fabric: f.name, fabricCode: f.code || "",
      colour: c ? c.name : "-", colourCode: c ? c.code || "" : "",
      price: c ? priceText(c) : "", minW: c && c.hasPrice ? c.minWidth : "", maxW: c && c.hasPrice ? c.maxWidth : "",
      minD: c && c.hasPrice ? c.minDrop : "", maxD: c && c.hasPrice ? c.maxDrop : "",
      types: c ? c.types.join(", ") : "", groups: (c && c.priceGroups.length ? c.priceGroups : f.priceGroups || []).join(", "), stock: c ? stockText(c) : ""
    })));
  }
  const shownRows = () => tableRows().filter(r => COLS.every((c, i) => !q[i] || String(r[c.key]).toLowerCase().includes(q[i].trim().toLowerCase())));

  $("matHead").innerHTML = `<th class="m-chk"><input type="checkbox" class="chk" id="matAll" aria-label="Select all"></th>` +
    COLS.map(c => `<th class="${c.wide ? "wide" : ""}">${c.label}</th>`).join("");
  $("matFilter").innerHTML = `<th class="m-chk"></th>` + COLS.map((c, i) => `<th class="${c.wide ? "wide" : ""}"><div class="f-search">
      <button type="button" class="sbtn" data-col="${i}" title="Search ${c.label}">${searchSvg}</button>
      <input class="sinput" data-col="${i}" placeholder="Search" autocomplete="off"></div></th>`).join("");

  function render() {
    const rows = shownRows();
    $("matRows").innerHTML = rows.length
      ? rows.map(r => `<tr class="${picked.has(r.key) ? "picked" : ""}" data-key="${esc(r.key)}" data-fabric="${esc(r.f.id)}" title="Click to edit ${esc(r.fabric)}">
          <td class="m-chk"><input type="checkbox" class="chk" value="${esc(r.key)}" ${picked.has(r.key) ? "checked" : ""} aria-label="Select ${esc(r.fabric)} ${esc(r.colour)}"></td>
          ${COLS.map(c => `<td class="${c.wide ? "wide" : ""}${c.key === "stock" && r.stock === "Out of stock" ? " oos" : ""}" title="${esc(r[c.key])}">${esc(r[c.key])}</td>`).join("")}
        </tr>`).join("")
      : `<tr class="empty"><td colspan="${COLS.length + 1}">${materials.length ? "No materials match your search" : "No Rows To Show"}</td></tr>`;
    const all = $("matAll");
    all.checked = rows.length > 0 && rows.every(r => picked.has(r.key));
    all.indeterminate = !all.checked && rows.some(r => picked.has(r.key));
    $("matTotal").textContent = `Total Record: ${rows.length}${picked.size ? ` · ${picked.size} selected` : ""}`;
  }

  $("matRows").addEventListener("change", e => {
    if (!e.target.classList.contains("chk")) return;
    e.target.checked ? picked.add(e.target.value) : picked.delete(e.target.value);
    render();
  });
  $("matRows").addEventListener("click", e => {
    if (e.target.closest("input")) return;
    const tr = e.target.closest("tr[data-fabric]");
    if (tr) openFabric(tr.dataset.fabric);
  });
  $("matHead").addEventListener("change", e => {
    if (e.target.id !== "matAll") return;
    shownRows().forEach(r => (e.target.checked ? picked.add(r.key) : picked.delete(r.key)));
    render();
  });
  const wireSearch = (row, store, rerender) => {
    row.addEventListener("click", e => {
      const b = e.target.closest(".sbtn");
      if (!b) return;
      const box = b.parentElement;
      const open = box.classList.toggle("open");
      if (open) box.querySelector("input").focus();
      else { store[+b.dataset.col] = ""; box.querySelector("input").value = ""; rerender(); }
    });
    row.addEventListener("input", e => { store[+e.target.dataset.col] = e.target.value; rerender(); });
  };
  wireSearch($("matFilter"), q, render);

  // ---------- toolbar menus ----------
  const menus = [["viewCaret", "viewMenu"], ["matMoreBtn", "matMenu"], ["fabSaveCaret", "fabSaveMenu"], ["colMoreBtn", "colMenu"]];
  menus.forEach(([btn, menu]) => $(btn).addEventListener("click", e => {
    e.stopPropagation();
    const open = $(menu).hidden;
    menus.forEach(([, m]) => { $(m).hidden = true; });
    $(menu).hidden = !open;
  }));
  document.addEventListener("click", e => menus.forEach(([btn, m]) => { if (!$(m).contains(e.target) && !$(btn).contains(e.target)) $(m).hidden = true; }));
  $("viewMenu").addEventListener("click", () => { $("viewMenu").hidden = true; });

  $("matMenu").addEventListener("click", e => {
    const a = e.target.closest("[data-mat-action]");
    if (!a) return;
    $("matMenu").hidden = true;
    const act = a.dataset.matAction;
    if (act === "unlink") unlinkSelected();
    else if (act === "link") openLink();
    else if (act === "export") exportCsv();
    else showToast({ title: "Info", type: "success", message: `${a.textContent} isn't available in this prototype yet`, duration: 4000 });
  });

  function unlinkSelected() {
    if (!picked.size) { showToast({ title: "Error", message: "Select the materials to unlink" }); return; }
    if (!confirm(`Unlink ${picked.size} material row${picked.size === 1 ? "" : "s"} from ${PRODUCT}?`)) return;
    picked.forEach(k => {
      const [fid, cid] = k.split(":");
      const f = materials.find(x => x.id === fid);
      if (!f) return;
      if (cid) f.colours = f.colours.filter(c => c.id !== cid);
      if (!cid || !f.colours.length) materials.splice(materials.indexOf(f), 1);
    });
    const n = picked.size;
    picked.clear();
    save();
    render();
    showToast({ type: "success", title: "Success", message: `${n} material row${n === 1 ? "" : "s"} unlinked`, duration: 4000 });
  }

  function exportCsv() {
    const rows = shownRows();
    const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [COLS.map(c => cell(c.label)).join(","), ...rows.map(r => COLS.map(c => cell(r[c.key])).join(","))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${PRODUCT} - fabrics.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---------- Material Fabric popup ----------
  let draft = null;      // fabric being edited (copy)
  let editingId = null;  // id of the fabric in `materials`, null when new
  ProductStore.SUPPLIERS.forEach(n => $("fabSupplier").add(new Option(n, n)));

  function openFabric(id = null) {
    editingId = id;
    const f = id ? materials.find(x => x.id === id) : null;
    draft = f ? copy(f) : { id: uid("m"), name: "", code: "", description: "", supplier: "", partNo: "", colours: [] };
    $("fabName").value = draft.name;
    $("fabCode").value = draft.code;
    $("fabDesc").value = draft.description;
    $("fabSupplier").value = draft.supplier;
    $("fabPart").value = draft.partNo;
    [$("fabName"), $("fabSupplier")].forEach(el => el.classList.remove("invalid"));
    renderDraftColours();
    $("fabModal").hidden = false;
    $("fabName").focus();
  }
  function closeFabric() { $("fabModal").hidden = true; $("fabSaveMenu").hidden = true; draft = null; editingId = null; }

  function renderDraftColours() {
    $("fabColoursCard").hidden = !draft.colours.length;
    const editIc = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#1592d8" stroke-width="1.5"><path d="M11 2l3 3-8 8H3v-3z"/></svg>`;
    const delIc = `<svg width="10" height="10" viewBox="0 0 10 10" stroke="#e53935" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>`;
    $("fabColours").innerHTML = draft.colours.map((c, i) => `<tr>
        <td>${esc(c.name)}</td><td>${esc(c.code)}</td><td title="${esc(c.types.join(", "))}">${esc(c.types.join(", ") || "All types")}</td>
        <td title="${esc(c.priceGroups.join(", "))}">${esc(c.priceGroups.join(", ") || "Any")}</td>
        <td>${esc(priceText(c))}</td><td>${esc(stockText(c))}</td>
        <td class="ct-act"><button type="button" class="ct-btn" data-edit-col="${i}" title="Edit ${esc(c.name)}">${editIc}</button><button type="button" class="ct-btn del" data-del-col="${i}" title="Delete ${esc(c.name)}">${delIc}</button></td>
      </tr>`).join("");
  }
  $("fabColours").addEventListener("click", e => {
    const ed = e.target.closest("[data-edit-col]");
    if (ed) { readFabricForm(); openColour(+ed.dataset.editCol); return; }
    const del = e.target.closest("[data-del-col]");
    if (del) { draft.colours.splice(+del.dataset.delCol, 1); renderDraftColours(); }
  });

  function readFabricForm() {
    draft.name = $("fabName").value.trim();
    draft.code = $("fabCode").value.trim();
    draft.description = $("fabDesc").value.trim();
    draft.supplier = $("fabSupplier").value;
    draft.partNo = $("fabPart").value.trim();
  }

  // returns true when saved
  function saveFabric() {
    readFabricForm();
    const missing = [[$("fabName"), "Fabric Name"], [$("fabSupplier"), "Supplier"]].filter(([el]) => !el.value.trim());
    [$("fabName"), $("fabSupplier")].forEach(el => el.classList.toggle("invalid", missing.some(([m]) => m === el)));
    if (missing.length) {
      missing[0][0].focus();
      showToast({ title: "Error", message: `Please fill in: ${missing.map(([, l]) => l).join(", ")}`, duration: 5000 });
      return false;
    }
    const dup = materials.find(f => f.id !== draft.id && keyOf(f) === keyOf(draft));
    if (dup) { showToast({ title: "Error", message: "Duplicate entry for Fabric Name" }); $("fabName").focus(); return false; }
    const i = materials.findIndex(f => f.id === draft.id);
    if (i >= 0) materials[i] = draft; else materials.unshift(draft);
    save();
    render();
    showToast({ type: "success", title: "Success", message: `${draft.name} saved`, duration: 3000 });
    return true;
  }
  $("fabForm").addEventListener("submit", e => { e.preventDefault(); if (saveFabric()) closeFabric(); });
  $("fabSaveAnother").addEventListener("click", () => { $("fabSaveMenu").hidden = true; if (saveFabric()) openFabric(); });
  $("fabModal").querySelectorAll("[data-fab-close]").forEach(b => b.addEventListener("click", closeFabric));
  [$("fabName"), $("fabSupplier")].forEach(el => ["input", "change"].forEach(ev => el.addEventListener(ev, () => el.classList.remove("invalid"))));
  $("addMaterialBtn").addEventListener("click", () => openFabric());
  $("addColourBtn").addEventListener("click", () => { readFabricForm(); openColour(null); });
  $("fabImportBtn").addEventListener("click", () => showToast({ title: "Info", type: "success", message: "Import isn't available in this prototype yet", duration: 4000 }));

  // ---------- Material Colour popup ----------
  let colIndex = null; // index in draft.colours, null when new
  const setYN = (btn, on) => { btn.classList.toggle("no", !on); btn.firstChild.textContent = on ? "Yes" : "No"; btn.setAttribute("aria-pressed", String(on)); };
  const isYes = btn => !btn.classList.contains("no");
  [["colHasPrice", "priceBody"], ["colHasStock", "stockBody"]].forEach(([b, body]) => $(b).addEventListener("click", () => {
    setYN($(b), !isYes($(b)));
    $(body).hidden = !isYes($(b));
  }));
  $("linkedBar").addEventListener("click", () => {
    const open = $("linkedBody").hidden;
    $("linkedBody").hidden = !open;
    $("linkedBar").setAttribute("aria-expanded", String(open));
  });

  const checks = (el, options, chosen, name) => {
    el.innerHTML = options.length
      ? options.map(o => `<label><input type="checkbox" class="chk" name="${name}" value="${esc(o)}" ${chosen.includes(o) ? "checked" : ""}>${esc(o)}</label>`).join("")
      : `<span class="none">${name === "types" ? "No types linked to this product yet (Fields and Values → Pricing Group Filter)" : "No price groups for these types yet"}</span>`;
  };
  const checked = el => [...el.querySelectorAll("input:checked")].map(i => i.value);
  // keep the price group list in step with the ticked types
  function syncGroups(typesEl, groupsEl) {
    const keep = checked(groupsEl);
    checks(groupsEl, priceGroups(checked(typesEl), $("fabSupplier").value), keep, "groups");
  }
  $("colTypes").addEventListener("change", () => syncGroups($("colTypes"), $("colGroups")));
  $("geTypes").addEventListener("change", () => syncGroups($("geTypes"), $("geGroups")));

  function openColour(index) {
    colIndex = index;
    const c = index === null ? null : draft.colours[index];
    $("colName").value = c ? c.name : "";
    $("colCode").value = c ? c.code : "";
    $("colDesc").value = c ? c.description : "";
    $("colPart").value = c ? c.supplierPartCode : "";
    $("colNotes").value = c ? c.notes : "";
    $("colPrice").value = c ? c.price : "";
    $("colMinW").value = c ? c.minWidth : "";
    $("colMaxW").value = c ? c.maxWidth : "";
    $("colMinD").value = c ? c.minDrop : "";
    $("colMaxD").value = c ? c.maxDrop : "";
    $("colStock").value = c ? c.stock : "";
    setYN($("colHasPrice"), !!(c && c.hasPrice)); $("priceBody").hidden = !(c && c.hasPrice);
    setYN($("colHasStock"), !!(c && c.hasStock)); $("stockBody").hidden = !(c && c.hasStock);
    const types = c ? c.types : [];
    checks($("colTypes"), [...new Set([...productTypes(), ...types])], types, "types");
    checks($("colGroups"), [...new Set([...priceGroups(types, $("fabSupplier").value), ...(c ? c.priceGroups : [])])], c ? c.priceGroups : [], "groups");
    const open = !c; // a new colour starts with Linked Products open
    $("linkedBody").hidden = !open;
    $("linkedBar").setAttribute("aria-expanded", String(open));
    $("colImageText").innerHTML = c && c.image ? `<span class="file">${esc(c.image)}</span>` : `<b>Upload Image</b> (Max 10 MB)<small>supports png, jpeg, jpg, webp formats only.</small>`;
    $("colExtraText").innerHTML = c && c.extraImages && c.extraImages.length ? `<span class="file">${esc(c.extraImages.join(", "))}</span>` : `<b>Upload Image</b> or drag and drop`;
    $("colImage").value = ""; $("colExtra").value = "";
    $("colName").classList.remove("invalid");
    $("colDuplicate").disabled = !c;
    showColTab("details");
    $("colModal").hidden = false;
    $("colName").focus();
  }
  function closeColour() { $("colModal").hidden = true; $("colMenu").hidden = true; colIndex = null; }

  function showColTab(tab) {
    document.querySelectorAll(".col-tab").forEach(t => t.classList.toggle("active", t.dataset.colTab === tab));
    document.querySelectorAll("[data-col-pane]").forEach(p => { p.hidden = p.dataset.colPane !== tab; });
  }
  document.querySelector(".col-tabs").addEventListener("click", e => { const t = e.target.closest(".col-tab"); if (t) showColTab(t.dataset.colTab); });

  // images: only the file names are kept in this prototype
  const imgOk = file => /\.(png|jpe?g|webp)$/i.test(file.name) && file.size <= 10 * 1024 * 1024;
  $("colImage").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!imgOk(file)) { showToast({ title: "Error", message: "Use a png, jpeg, jpg or webp image up to 10 MB" }); e.target.value = ""; return; }
    $("colImageText").innerHTML = `<span class="file">${esc(file.name)}</span>`;
  });
  $("colExtra").addEventListener("change", e => {
    const files = [...e.target.files].filter(imgOk);
    if (files.length) $("colExtraText").innerHTML = `<span class="file">${esc(files.map(f => f.name).join(", "))}</span>`;
  });

  $("colForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("colName").value.trim();
    if (!name) { $("colName").classList.add("invalid"); $("colName").focus(); showToast({ title: "Error", message: "Please fill in: Color Name", duration: 5000 }); return; }
    if (draft.colours.some((c, i) => i !== colIndex && c.name.toLowerCase() === name.toLowerCase())) {
      $("colName").classList.add("invalid"); showToast({ title: "Error", message: "Duplicate entry for Color Name" }); return;
    }
    const prev = colIndex === null ? {} : draft.colours[colIndex];
    const file = $("colImage").files[0];
    const extra = [...$("colExtra").files].filter(imgOk).map(f => f.name);
    const c = {
      id: prev.id || uid("c"), name, code: $("colCode").value.trim(), description: $("colDesc").value.trim(),
      supplierPartCode: $("colPart").value.trim(), types: checked($("colTypes")), priceGroups: checked($("colGroups")),
      hasPrice: isYes($("colHasPrice")), price: $("colPrice").value.trim(), minWidth: $("colMinW").value.trim(), maxWidth: $("colMaxW").value.trim(),
      minDrop: $("colMinD").value.trim(), maxDrop: $("colMaxD").value.trim(),
      hasStock: isYes($("colHasStock")), stock: $("colStock").value.trim(), notes: $("colNotes").value.trim(),
      image: file && imgOk(file) ? file.name : prev.image || "", extraImages: extra.length ? extra : prev.extraImages || []
    };
    if (colIndex === null) draft.colours.push(c); else draft.colours[colIndex] = c;
    closeColour();
    renderDraftColours();
  });
  $("colName").addEventListener("input", () => $("colName").classList.remove("invalid"));
  $("colModal").querySelectorAll("[data-col-close]").forEach(b => b.addEventListener("click", closeColour));
  $("colDuplicate").addEventListener("click", () => {
    $("colMenu").hidden = true;
    if (colIndex === null) return;
    const c = copy(draft.colours[colIndex]);
    c.id = uid("c");
    let n = 2;
    while (draft.colours.some(x => x.name.toLowerCase() === `${c.name} (${n})`.toLowerCase())) n++;
    c.name = `${c.name} (${n})`;
    draft.colours.push(c);
    closeColour();
    renderDraftColours();
  });

  // ---------- Global Edit: same links for every colour of the fabric ----------
  $("globalEditBtn").addEventListener("click", () => {
    if (!draft.colours.length) { showToast({ title: "Error", message: "Add a colour first" }); return; }
    readFabricForm();
    const first = draft.colours[0];
    checks($("geTypes"), productTypes(), first.types, "types");
    checks($("geGroups"), priceGroups(first.types, draft.supplier), first.priceGroups, "groups");
    $("geModal").hidden = false;
  });
  $("geForm").addEventListener("submit", e => {
    e.preventDefault();
    const types = checked($("geTypes")), groups = checked($("geGroups"));
    draft.colours.forEach(c => { c.types = [...types]; c.priceGroups = [...groups]; });
    $("geModal").hidden = true;
    renderDraftColours();
    showToast({ type: "success", title: "Success", message: `Updated ${draft.colours.length} colour${draft.colours.length === 1 ? "" : "s"}`, duration: 3000 });
  });
  $("geModal").querySelectorAll("[data-ge-close]").forEach(b => b.addEventListener("click", () => { $("geModal").hidden = true; }));

  // ---------- Link Existing Fabric ----------
  const LCOLS = [
    { key: "fabric", label: "Fabric Name" }, { key: "fabricCode", label: "Fabric Code" }, { key: "colour", label: "Colour Name" },
    { key: "colourCode", label: "Colour Code" }, { key: "supplier", label: "Fabric Supplier" }, { key: "products", label: "Linked Products", wide: true }
  ];
  const lq = LCOLS.map(() => "");
  const lpicked = new Set();
  let lpool = [];
  $("lnkHead").innerHTML = `<th class="m-chk"><input type="checkbox" class="chk" id="lnkAll" aria-label="Select all"></th>` + LCOLS.map(c => `<th class="${c.wide ? "wide" : ""}">${c.label}</th>`).join("");
  $("lnkFilter").innerHTML = `<th class="m-chk"></th>` + LCOLS.map((c, i) => `<th class="${c.wide ? "wide" : ""}"><div class="f-search">
      <button type="button" class="sbtn" data-col="${i}" title="Search ${c.label}">${searchSvg}</button>
      <input class="sinput" data-col="${i}" placeholder="Search" autocomplete="off"></div></th>`).join("");

  function openLink() {
    const mine = new Map(materials.map(f => [keyOf(f), new Set(f.colours.map(c => c.name.toLowerCase()))]));
    lpool = ProductStore.allMaterials().flatMap(({ fabric, products }) => fabric.colours
      .filter(c => !(mine.get(keyOf(fabric)) || new Set()).has(c.name.toLowerCase()))
      .map(c => ({
        key: `${keyOf(fabric)}::${c.name.toLowerCase()}`, fabricObj: fabric, colourObj: c,
        fabric: fabric.name, fabricCode: fabric.code || "", colour: c.name, colourCode: c.code || "", supplier: fabric.supplier,
        products: products.filter(p => p.toLowerCase() !== PRODUCT.toLowerCase()).join(", ") || "Sample library"
      })));
    lpicked.clear();
    lq.fill("");
    $("lnkFilter").querySelectorAll(".f-search").forEach(b => { b.classList.remove("open"); b.querySelector("input").value = ""; });
    renderLink();
    $("lnkModal").hidden = false;
  }
  const lshown = () => lpool.filter(r => LCOLS.every((c, i) => !lq[i] || String(r[c.key]).toLowerCase().includes(lq[i].trim().toLowerCase())));
  function renderLink() {
    const rows = lshown();
    $("lnkRows").innerHTML = rows.length
      ? rows.map(r => `<tr class="${lpicked.has(r.key) ? "picked" : ""}" data-key="${esc(r.key)}">
          <td class="m-chk"><input type="checkbox" class="chk" value="${esc(r.key)}" ${lpicked.has(r.key) ? "checked" : ""} aria-label="Select ${esc(r.fabric)} ${esc(r.colour)}"></td>
          ${LCOLS.map(c => `<td class="${c.wide ? "wide" : ""}" title="${esc(r[c.key])}">${esc(r[c.key])}</td>`).join("")}</tr>`).join("")
      : `<tr class="empty"><td colspan="${LCOLS.length + 1}">${lpool.length ? "No fabrics match your search" : "All existing fabrics are already linked to this product"}</td></tr>`;
    const all = $("lnkAll");
    all.checked = rows.length > 0 && rows.every(r => lpicked.has(r.key));
    all.indeterminate = !all.checked && rows.some(r => lpicked.has(r.key));
    $("lnkTotal").textContent = `Total Record: ${rows.length}${lpicked.size ? ` · ${lpicked.size} selected` : ""}`;
  }
  $("lnkRows").addEventListener("change", e => { if (!e.target.classList.contains("chk")) return; e.target.checked ? lpicked.add(e.target.value) : lpicked.delete(e.target.value); renderLink(); });
  $("lnkRows").addEventListener("click", e => {
    const tr = e.target.closest("tr[data-key]");
    if (!tr || e.target.closest("input")) return;
    const box = tr.querySelector(".chk"); box.checked = !box.checked; box.dispatchEvent(new Event("change", { bubbles: true }));
  });
  $("lnkHead").addEventListener("change", e => { if (e.target.id !== "lnkAll") return; lshown().forEach(r => (e.target.checked ? lpicked.add(r.key) : lpicked.delete(r.key))); renderLink(); });
  wireSearch($("lnkFilter"), lq, renderLink);
  $("lnkSave").addEventListener("click", () => {
    if (!lpicked.size) { showToast({ title: "Error", message: "Select at least one fabric to link" }); return; }
    const rows = lpool.filter(r => lpicked.has(r.key));
    rows.forEach(r => {
      let f = materials.find(x => keyOf(x) === keyOf(r.fabricObj));
      if (!f) { f = { ...copy(r.fabricObj), id: uid("m"), colours: [] }; materials.unshift(f); }
      f.colours.push({ ...copy(r.colourObj), id: uid("c") });
    });
    save();
    render();
    $("lnkModal").hidden = true;
    showToast({ type: "success", title: "Success", message: `${rows.length} fabric colour${rows.length === 1 ? "" : "s"} linked`, duration: 4000 });
  });
  $("lnkModal").querySelector("[data-lnk-close]").addEventListener("click", () => { $("lnkModal").hidden = true; });

  // ---------- Esc closes the top-most popup ----------
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const openMenu = menus.find(([, m]) => !$(m).hidden);
    if (openMenu) { $(openMenu[1]).hidden = true; return; }
    if (!$("geModal").hidden) $("geModal").hidden = true;
    else if (!$("colModal").hidden) closeColour();
    else if (!$("fabModal").hidden) closeFabric();
    else if (!$("lnkModal").hidden) $("lnkModal").hidden = true;
  });

  render();
})();
