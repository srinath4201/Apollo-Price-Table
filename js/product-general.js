// Fill the form from the product that was clicked on the Products page
const params = new URLSearchParams(location.search);
const nameInput = document.getElementById("productName");
const codeInput = document.getElementById("productCode");
const reportInput = document.getElementById("reportCode");
const categorySelect = document.getElementById("productCategory");
const crumbProduct = document.getElementById("crumbProduct");

if (params.has("name")) nameInput.value = params.get("name");
if (params.has("code")) codeInput.value = params.get("code");
if (params.get("report")) reportInput.value = params.get("report");
if (params.has("category")) {
  const cat = params.get("category");
  if (![...categorySelect.options].some(o => o.value === cat)) categorySelect.add(new Option(cat, cat));
  categorySelect.value = cat;
}
// ---------- New product ("+ Product" in the top bar) ----------
const isNew = params.has("new");
const costSelect = document.getElementById("costFrom");
const sellingSelect = document.getElementById("sellingFrom");
const groupSelect = document.getElementById("productGroup");
const PRODUCT_GROUPS = ["Ungroup products", "Rollers", "Soft Furnishing", "Outdoor Products", "Verts", "Venetian", "Shutters", "DMI"];
const REQUIRED = [nameInput, codeInput, categorySelect, costSelect, sellingSelect];

if (isNew) {
  document.title = "Product - General Info";
  crumbProduct.textContent = "Product";
  document.querySelector(".crumb .current").hidden = true;
  nameInput.value = "";
  nameInput.placeholder = "Please Enter Your Product Name";
  codeInput.value = "";
  codeInput.placeholder = "Please Enter Your Product Code";
  [categorySelect, costSelect, sellingSelect].forEach(sel => {
    sel.insertBefore(new Option("Select", ""), sel.firstChild);
    sel.value = "";
  });
  // a new product: Category and both "Comes From" boxes are normal, editable selects
  [categorySelect, costSelect, sellingSelect].forEach(sel => sel.parentElement.classList.remove("grey"));
  costSelect.add(new Option("Price Table", "Price Table"));
  costSelect.add(new Option("Cost Price", "Cost Price"));
  sellingSelect.add(new Option("Cost + Markup", "Cost + Markup"));
  sellingSelect.add(new Option("Price Table", "Price Table"));
  groupSelect.innerHTML = PRODUCT_GROUPS.map(g => `<option>${g}</option>`).join("");
  groupSelect.value = "Ungroup products";
  document.getElementById("discountPriceTables").remove();
  const prod = document.getElementById("modProduction");
  prod.classList.add("off");
  prod.firstChild.textContent = "OFF";
  // no pictures yet: every image box shows the upload area
  document.querySelectorAll(".img-box .thumb").forEach(t => t.remove());
} else {
  // a saved product: Cost / Selling Price Comes From can no longer be changed
  [costSelect, sellingSelect].forEach(sel => { sel.disabled = true; sel.title = "Set when the product was created"; });
  crumbProduct.textContent = nameInput.value || "Product";
  document.title = `${crumbProduct.textContent} - General Info`;
  nameInput.addEventListener("input", () => { crumbProduct.textContent = nameInput.value || "Product"; });
}

// Focus the product name like the screenshot
nameInput.focus();
nameInput.setSelectionRange(nameInput.value.length, nameInput.value.length);

// Discount checkboxes stay locked until the lock is clicked
const lockBtn = document.getElementById("lockBtn");
lockBtn.addEventListener("click", () => {
  const unlocked = lockBtn.classList.toggle("unlocked");
  lockBtn.title = unlocked ? "Lock" : "Unlock to edit";
  document.querySelectorAll("#discountChecks input").forEach(c => { c.disabled = !unlocked; });
});

// Module ON / OFF toggles
document.querySelectorAll(".modules .toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    const off = btn.classList.toggle("off");
    btn.firstChild.textContent = off ? "OFF" : "ON";
  });
});

// ---------- Image galleries ----------
const galleryFile = document.getElementById("galleryFile");
let activeGallery = null;

const removeBtn = `<button type="button" class="rm" title="Remove"><svg width="6" height="6" viewBox="0 0 6 6" stroke="#fff" stroke-width="1.4"><path d="M1 1l4 4M5 1L1 5"/></svg></button>`;

// A box with no images left switches to the dashed upload style (.img-box.empty)
const syncEmpty = box => box.classList.toggle("empty", !box.querySelector(".thumb"));

const pickImage = box => {
  activeGallery = box;
  galleryFile.value = "";
  galleryFile.click();
};

function addImage(box, file) {
  if (!file || !file.type.startsWith("image/")) return;
  if (file.size > 1024 * 1024) { alert("Image must be 1 MB or smaller."); return; }
  if (box.dataset.single) box.querySelectorAll(".thumb").forEach(t => t.remove());
  const thumb = document.createElement("div");
  thumb.className = "thumb";
  thumb.style.backgroundImage = `url("${URL.createObjectURL(file)}")`;
  thumb.innerHTML = removeBtn;
  box.insertBefore(thumb, box.querySelector(".add-img"));
  if (!box.querySelector(".thumb.selected")) thumb.classList.add("selected");
  syncEmpty(box);
}

document.querySelectorAll(".img-box").forEach(box => {
  box.addEventListener("click", e => {
    if (box.classList.contains("empty")) { pickImage(box); return; }
    const rm = e.target.closest(".rm");
    const thumb = e.target.closest(".thumb");
    if (rm) {
      const wasSelected = thumb.classList.contains("selected");
      thumb.remove();
      const first = box.querySelector(".thumb");
      if (wasSelected && first) first.classList.add("selected");
      syncEmpty(box);
      return;
    }
    if (thumb) {
      box.querySelectorAll(".thumb").forEach(t => t.classList.toggle("selected", t === thumb));
      return;
    }
    if (e.target.closest(".add-img")) pickImage(box);
  });

  // drag and drop works on the empty (upload) state
  box.addEventListener("dragover", e => {
    if (!box.classList.contains("empty")) return;
    e.preventDefault();
    box.classList.add("over");
  });
  box.addEventListener("dragleave", () => box.classList.remove("over"));
  box.addEventListener("drop", e => {
    if (!box.classList.contains("empty")) return;
    e.preventDefault();
    box.classList.remove("over");
    addImage(box, e.dataTransfer.files[0]);
  });

  syncEmpty(box);
});

galleryFile.addEventListener("change", () => {
  if (activeGallery) addImage(activeGallery, galleryFile.files[0]);
});

// ---------- Upload drop zones ----------
document.querySelectorAll(".drop").forEach(drop => {
  const input = drop.querySelector("input");
  const text = drop.querySelector(".drop-text");
  const original = text.innerHTML;

  const show = file => {
    if (!file) { text.innerHTML = original; return; }
    if (file.size > 1024 * 1024) { alert("Image must be 1 MB or smaller."); text.innerHTML = original; return; }
    text.innerHTML = `<span class="file-name"></span>`;
    text.firstChild.textContent = file.name;
  };

  input.addEventListener("change", () => show(input.files[0]));
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => {
    e.preventDefault();
    drop.classList.remove("over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      show(file);
    }
  });
});

// ---------- Save & Next: check required fields ----------
// New product: saved, then Fields and Values opens for it (it starts with Unit Type, Quantity, Supplier).
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

document.getElementById("productForm").addEventListener("submit", e => {
  e.preventDefault();
  const required = isNew ? REQUIRED : [nameInput, codeInput];
  const missing = required.filter(el => !el.value.trim());
  required.forEach(el => el.classList.toggle("invalid", missing.includes(el)));
  if (missing.length) {
    missing[0].focus();
    if (isNew) {
      const labels = missing.map(el => document.querySelector(`label[for="${el.id}"]`).childNodes[0].textContent.trim());
      showToast({ title: "Error", message: `Please fill in: ${labels.join(", ")}`, duration: 5000 });
    }
    return;
  }
  if (!isNew) return;

  const name = nameInput.value.trim();
  const code = codeInput.value.trim();
  const all = [...ProductStore.customProducts().map(p => [p.name, p.code]), ...PRODUCTS.map(p => [p[0], p[1]])];
  if (all.some(([n]) => sameName(n, name))) {
    nameInput.classList.add("invalid"); nameInput.focus();
    showToast({ title: "Error", message: "Duplicate entry for Product Name" });
    return;
  }
  if (all.some(([, c]) => sameName(c, code))) {
    codeInput.classList.add("invalid"); codeInput.focus();
    showToast({ title: "Error", message: "Duplicate entry for Product code" });
    return;
  }

  const product = {
    name, code, report: reportInput.value.trim(), category: categorySelect.value,
    group: groupSelect.value, description: document.getElementById("productDesc").value.trim(),
    costFrom: costSelect.value, sellingFrom: sellingSelect.value
  };
  ProductStore.createProduct(product);
  location.href = `product-fields.html?${new URLSearchParams({ name, code, report: product.report, category: product.category })}`;
});

REQUIRED.forEach(el => {
  el.addEventListener("input", () => el.classList.remove("invalid"));
  el.addEventListener("change", () => el.classList.remove("invalid"));
});
