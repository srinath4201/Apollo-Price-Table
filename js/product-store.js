// Shared product setup (Fields and Values page ⇄ Create Job product popup).
// Saved per product in this browser's localStorage, so changes made on
// Fields and Values show up when the product is added to a job.
const ProductStore = (() => {
  const KEY = "bm.product-setup.v2";

  const SUPPLIERS = ["Arena", "Decora", "Louvolite", "Style Studio"];

  // Field type that links Supplier → Styles; only one per product
  const FILTER_TYPE = "Pricing Group Filter";

  // Cost price grid used when a price group has no table of its own (£ per unit)
  const SAMPLE_GRID = {
    widths: [600, 760, 900, 1070, 1200, 1370, 1520, 1680, 1830, 2000, 2150, 2300, 2420, 2590],
    drops: [1200, 1800, 2400, 3000],
    prices: [
      [28, 33, 38, 45, 47, 55, 60, 65, 69, 82, 93, 96, 102, 110],
      [33, 42, 49, 58, 67, 73, 79, 88, 95, 113, 123, 132, 139, 147],
      [42, 49, 60, 68, 79, 88, 96, 106, 114, 139, 151, 160, 170, 182],
      [52, 62, 68, 79, 95, 102, 113, 123, 132, 145, 158, 167, 178, 190]
    ]
  };

  // [fieldName, fieldCode, fieldType, fieldInfo, mandatory, mobileQuickView, showOnJobItem, options]
  // options: sys = system field (no checkbox / menu), mobLock = mobile toggle locked,
  //          supplier / linkedTypes = the "Pricing Group Filter" choices
  const DEFAULT_FIELDS = [
    ["Unit Type", "", "Unit Type", "", true, false, true, { sys: true }],
    ["Quantity", "", "Qty", "", true, true, true, { mobLock: true }],
    ["Location", "", "Location_Text", "", false, false, true, {}],
    ["Supplier", "", "Supplier", "", false, true, true, {}],
    ["Styles", "ST", FILTER_TYPE, "Choose the supplier first", false, false, true,
      { onlinePortal: true, supplier: ["Arena", "Decora", "Louvolite", "Style Studio"], linkedTypes: ["Blinds with fabric", "Louvers", "Slat only"] }],
    ["Pricing", "RPT", "Pricing Group", "", false, true, true, {}],
    ["Fabric", "", "Blinds Fabrics Materials", "", false, true, true, {}],
    ["Measure To", "MT", "List", "", false, false, true, {}],
    ["Width", "", "Numeric X", "Add information here", false, true, true, { mobLock: true }],
    ["Drop", "", "Numeric Y", "", true, true, true, { mobLock: true }],
    ["Installation Height", "", "Numeric", "Min 1500 to 3500", false, false, false, {}],
    ["Cassette Type", "", "List", "", false, true, true, {}],
    ["Fabric allowance", "", "List", "", false, false, true, {}],
    ["Motor", "", "List", "", false, false, true, {}]
  ];

  const PRODUCT_TYPES = ["Blinds with fabric", "Louvers", "Slat only"];

  // Fields a product starts with when it is created with "+ Product"
  const NEW_PRODUCT_FIELDS = [
    ["Unit Type", "", "Unit Type", "", false, false, true, { sys: true }],
    ["Quantity", "", "Qty", "", false, true, true, { mobLock: true }],
    ["Supplier", "", "Supplier", "", false, true, true, {}]
  ];

  // Product type -> price groups [{ name, supplier, grid? }]
  const TYPE_GROUPS = {
    "Blinds with fabric": [
      { name: "89 Group A", supplier: "Arena" },
      { name: "89 Group B", supplier: "Arena" },
      { name: "127 Group A", supplier: "Decora" },
      { name: "127 Group B", supplier: "Louvolite" }
    ],
    "Louvers": [
      { name: "89 Group C", supplier: "Louvolite" },
      { name: "127 Group C", supplier: "Arena" },
      { name: "89 Group A", supplier: "Style Studio" }
    ],
    "Slat only": [
      { name: "127 Group A", supplier: "Style Studio" },
      { name: "89 Group B", supplier: "Decora" }
    ]
  };

  // Field name -> values [{ value, priceGroup ("" = any), outOfStock }]
  const v = (value, priceGroup = "", outOfStock = false, type = "") => ({ value, priceGroup, outOfStock, type });
  const FIELD_VALUES = {
    "Measure To": [v("Recess"), v("Exact"), v("Blind size")],
    "Fabric": [
      v("Blackout White", "89 Group A", false, "Blinds with fabric"), v("Dimout Grey", "89 Group A", false, "Blinds with fabric"),
      v("Sunscreen Beige", "89 Group B", false, "Blinds with fabric"), v("Basswood White", "89 Group B", false, "Slat only"),
      v("Faux Wood Oak", "89 Group C", false, "Louvers"),
      v("Linen Natural", "127 Group A", false, "Blinds with fabric"), v("Aluminium Silver", "127 Group A", false, "Slat only"),
      v("Vinyl Silver", "127 Group B", true, "Blinds with fabric"),
      v("Jacquard Cream", "127 Group C", false, "Louvers")
    ],
    "Cassette Type": [v("Open roll"), v("Cassette 70mm"), v("Cassette 90mm")],
    "Fabric allowance": [v("50mm"), v("100mm"), v("150mm")],
    "Motor": [v("Somfy"), v("Nice", "", true), v("Louvolite")]
  };

  // Materials → Fabrics: each fabric has colours; a colour is linked to types (Pricing Group Filter
  // values) and optionally price groups, and Create Job lists only the matching colours.
  // fabric: { id, name, code, description, supplier, partNo, colours: [colour] }
  // colour: { id, name, code, description, supplierPartCode, types: [], priceGroups: [],
  //           hasPrice, price, minWidth, maxWidth, minDrop, maxDrop, hasStock, stock, notes }
  const colour = (id, name, code, types, priceGroups, extra = {}) => ({
    id, name, code, description: "", supplierPartCode: "", types, priceGroups,
    hasPrice: false, price: "", minWidth: "", maxWidth: "", minDrop: "", maxDrop: "",
    hasStock: false, stock: "", notes: "", ...extra
  });
  const DEFAULT_MATERIALS = [
    { id: "m1", name: "Blackout", code: "BO1", description: "", supplier: "Arena", partNo: "",
      colours: [colour("c1", "White", "WHT", ["Blinds with fabric"], ["89 Group A"]), colour("c2", "Grey", "GRY", ["Blinds with fabric"], ["89 Group A"])] },
    { id: "m2", name: "Sunscreen", code: "SS1", description: "", supplier: "Arena", partNo: "",
      colours: [colour("c3", "Beige", "BEI", ["Blinds with fabric"], ["89 Group B"])] },
    { id: "m3", name: "Linen", code: "LIN", description: "", supplier: "Decora", partNo: "",
      colours: [colour("c4", "Natural", "NAT", ["Blinds with fabric"], ["127 Group A"]), colour("c5", "Charcoal", "CHA", ["Blinds with fabric"], ["127 Group A"])] },
    { id: "m4", name: "Vinyl", code: "VIN", description: "", supplier: "Louvolite", partNo: "",
      colours: [colour("c6", "Silver", "SLV", ["Blinds with fabric"], ["127 Group B"], { hasStock: true, stock: "0" })] },
    { id: "m5", name: "Faux Wood", code: "FW1", description: "", supplier: "Louvolite", partNo: "",
      colours: [colour("c7", "Oak", "OAK", ["Louvers"], ["89 Group C"])] },
    { id: "m6", name: "Jacquard", code: "JAC", description: "", supplier: "Arena", partNo: "",
      colours: [colour("c8", "Cream", "CRM", ["Louvers"], ["127 Group C"])] },
    { id: "m7", name: "Louvre Linen", code: "LL1", description: "", supplier: "Style Studio", partNo: "",
      colours: [colour("c9", "Stone", "STN", ["Louvers"], ["89 Group A"])] },
    { id: "m8", name: "Aluminium Slat", code: "AS1", description: "", supplier: "Style Studio", partNo: "",
      colours: [colour("c10", "Silver", "SLV", ["Slat only"], ["127 Group A"])] },
    { id: "m9", name: "Basswood", code: "BW1", description: "", supplier: "Decora", partNo: "",
      colours: [colour("c11", "White", "WHT", ["Slat only"], ["89 Group B"]), colour("c12", "Walnut", "WAL", ["Slat only"], ["89 Group B"])] }
  ];

  // Field types whose choices are values typed in on Fields and Values
  const VALUE_TYPES = new Set(["List", "Location_List", "Blinds Fabrics Materials", "Awnings Materials",
    "Blinds Slat Materials", "Shutter Materials", "Soft Furnishings Materials", "Lining Type"]);
  const MATERIAL_TYPES = new Set(["Blinds Fabrics Materials", "Awnings Materials", "Blinds Slat Materials",
    "Shutter Materials", "Soft Furnishings Materials"]);

  const copy = o => JSON.parse(JSON.stringify(o));
  const keyOf = name => String(name || "").trim().toLowerCase();

  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }

  function defaults() {
    return { fields: copy(DEFAULT_FIELDS), productTypes: [...PRODUCT_TYPES], typeGroups: copy(TYPE_GROUPS), fieldValues: copy(FIELD_VALUES), materials: copy(DEFAULT_MATERIALS) };
  }

  // Setups saved by earlier versions: type "Pricing group filter" → "Pricing Group Filter", "Blind Type" → "Styles", "Product Type" (Pricing Group) → "Pricing",
  // and (for those old setups only) put the linked fields together as Supplier → Styles → Pricing → Fabric.
  function migrate(saved) {
    const fields = saved.fields;
    const rename = (f, to) => {
      if (saved.fieldValues && saved.fieldValues[f[0]] && !saved.fieldValues[to]) {
        saved.fieldValues[to] = saved.fieldValues[f[0]];
        delete saved.fieldValues[f[0]];
      }
      f[0] = to;
    };
    let converted = false;
    fields.forEach(f => {
      if (String(f[2]).toLowerCase() === FILTER_TYPE.toLowerCase()) f[2] = FILTER_TYPE; // was "Pricing group filter"
      if (f[0] === "Blind Type" && f[2] === FILTER_TYPE) { rename(f, "Styles"); if (f[1] === "BT") f[1] = "ST"; converted = true; }
      if (f[0] === "Product Type" && f[2] === "Pricing Group") { rename(f, "Pricing"); converted = true; }
    });
    // rows can be dragged into any order now, so only re-order setups that were just converted
    if (!converted) return fields;
    const chain = [
      fields.find(f => f[0] === "Styles" && f[2] === FILTER_TYPE),
      fields.find(f => f[0] === "Pricing" && f[2] === "Pricing Group"),
      fields.find(f => f[0] === "Fabric" && MATERIAL_TYPES.has(f[2]))
    ].filter(Boolean);
    const supplier = fields.find(f => f[2] === "Supplier");
    if (!supplier || !chain.length) return fields;
    const rest = fields.filter(f => !chain.includes(f));
    rest.splice(rest.indexOf(supplier) + 1, 0, ...chain);
    return rest;
  }

  function load(product) {
    const saved = readAll()[keyOf(product)];
    const d = defaults();
    if (!saved) return d;
    if (Array.isArray(saved.fields)) saved.fields = migrate(saved);
    return {
      fields: Array.isArray(saved.fields) ? saved.fields : d.fields,
      productTypes: Array.isArray(saved.productTypes) ? saved.productTypes : d.productTypes,
      typeGroups: saved.typeGroups && typeof saved.typeGroups === "object" ? saved.typeGroups : d.typeGroups,
      fieldValues: saved.fieldValues && typeof saved.fieldValues === "object" ? saved.fieldValues : d.fieldValues,
      materials: Array.isArray(saved.materials) ? saved.materials : d.materials
    };
  }

  function save(product, data) {
    try {
      const all = readAll();
      all[keyOf(product)] = { ...(all[keyOf(product)] || {}), ...data, name: String(product).trim() };
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* storage full or blocked: changes stay on this page only */ }
  }

  // ---- products created with "+ Product" ----
  const PRODUCTS_KEY = "bm.products.v1";
  function customProducts() {
    try { const list = JSON.parse(localStorage.getItem(PRODUCTS_KEY)); return Array.isArray(list) ? list : []; } catch { return []; }
  }
  // product: { name, code, report, category, group, costFrom, sellingFrom, ... }
  function createProduct(product) {
    try {
      const list = customProducts().filter(p => keyOf(p.name) !== keyOf(product.name));
      list.unshift(product);
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
    save(product.name, { fields: copy(NEW_PRODUCT_FIELDS), productTypes: [...PRODUCT_TYPES], typeGroups: {}, fieldValues: {}, materials: [] });
  }

  // every fabric known to this browser (other products' materials + the sample library),
  // for "Link Existing Materials". Returns [{ fabric, products: [product names] }]
  function allMaterials() {
    const byKey = new Map();
    const add = (fabric, product) => {
      const key = keyOf(`${fabric.name}|${fabric.code}|${fabric.supplier}`);
      if (!byKey.has(key)) byKey.set(key, { fabric, products: [] });
      if (product && !byKey.get(key).products.includes(product)) byKey.get(key).products.push(product);
    };
    Object.values(readAll()).forEach(p => (Array.isArray(p.materials) ? p.materials : []).forEach(f => add(f, p.name)));
    DEFAULT_MATERIALS.forEach(f => add(f, null));
    return [...byKey.values()];
  }

  function reset(product) {
    try {
      const all = readAll();
      delete all[keyOf(product)];
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  }

  return { SUPPLIERS, FILTER_TYPE, SAMPLE_GRID, VALUE_TYPES, MATERIAL_TYPES, load, save, reset, customProducts, createProduct, allMaterials };
})();
