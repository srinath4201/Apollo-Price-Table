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
  const v = (value, priceGroup = "", outOfStock = false) => ({ value, priceGroup, outOfStock });
  const FIELD_VALUES = {
    "Measure To": [v("Recess"), v("Exact"), v("Blind size")],
    "Fabric": [
      v("Blackout White", "89 Group A"), v("Dimout Grey", "89 Group A"),
      v("Sunscreen Beige", "89 Group B"), v("Basswood White", "89 Group B"),
      v("Faux Wood Oak", "89 Group C"),
      v("Linen Natural", "127 Group A"), v("Aluminium Silver", "127 Group A"),
      v("Vinyl Silver", "127 Group B", true),
      v("Jacquard Cream", "127 Group C")
    ],
    "Cassette Type": [v("Open roll"), v("Cassette 70mm"), v("Cassette 90mm")],
    "Fabric allowance": [v("50mm"), v("100mm"), v("150mm")],
    "Motor": [v("Somfy"), v("Nice", "", true), v("Louvolite")]
  };

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
    return { fields: copy(DEFAULT_FIELDS), productTypes: [...PRODUCT_TYPES], typeGroups: copy(TYPE_GROUPS), fieldValues: copy(FIELD_VALUES) };
  }

  // Setups saved by earlier versions: type "Pricing group filter" → "Pricing Group Filter", "Blind Type" → "Styles", "Product Type" (Pricing Group) → "Pricing",
  // and keep the linked fields together as Supplier → Styles → Pricing → Fabric.
  function migrate(saved) {
    const fields = saved.fields;
    const rename = (f, to) => {
      if (saved.fieldValues && saved.fieldValues[f[0]] && !saved.fieldValues[to]) {
        saved.fieldValues[to] = saved.fieldValues[f[0]];
        delete saved.fieldValues[f[0]];
      }
      f[0] = to;
    };
    fields.forEach(f => {
      if (String(f[2]).toLowerCase() === FILTER_TYPE.toLowerCase()) f[2] = FILTER_TYPE; // was "Pricing group filter"
      if (f[0] === "Blind Type" && f[2] === FILTER_TYPE) { rename(f, "Styles"); if (f[1] === "BT") f[1] = "ST"; }
      if (f[0] === "Product Type" && f[2] === "Pricing Group") rename(f, "Pricing");
    });
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
      fieldValues: saved.fieldValues && typeof saved.fieldValues === "object" ? saved.fieldValues : d.fieldValues
    };
  }

  function save(product, data) {
    try {
      const all = readAll();
      all[keyOf(product)] = data;
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* storage full or blocked: changes stay on this page only */ }
  }

  function reset(product) {
    try {
      const all = readAll();
      delete all[keyOf(product)];
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch { /* ignore */ }
  }

  return { SUPPLIERS, FILTER_TYPE, SAMPLE_GRID, VALUE_TYPES, MATERIAL_TYPES, load, save, reset };
})();
