// Jobs saved from Create / Edit Job (localStorage "bm.jobs.v1").
// A job keeps its quote versions: { ref, status, orderStatus, account, invoice, contact, current, quotes: { Q1: { status, items } } }
// Jobs that were never saved (the sample rows on All Job) get sample quote versions the first time they are opened.

const JobStore = (() => {
  const KEY = "bm.jobs.v1";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const write = all => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* storage full or blocked */ } };

  // sample job item, same shape as the items saved by the product popup
  function item(product, group, size, extra, net, values) {
    const vat = Math.round(net * 0.2 * 100) / 100;
    return {
      product, group, description: [size, ...extra].filter(Boolean).join(", "),
      cost: Math.round(net * 0.45 * 100) / 100, qty: 1, unit: net, net, vat,
      data: { values, unit: "mm", status: "", recipe: "Standard", ready: false, created: "", due: "", vatOn: true, vatRate: "20", round: "none", override: 0 }
    };
  }

  function sample(ref) {
    return {
      ref, status: "Lead", orderStatus: "Not confirmed yet", account: "641", invoice: "",
      contact: { title: "Mr", first: "John", last: "Smith", email: "john.smith@example.com", phone: "020 7946 0018", mobile: "07700 900123", address1: "12 High Street", town: "London", state: "Greater London", zip: "SW1A 1AA", manager: "Srinath" },
      current: "Q1",
      quotes: {
        Q1: { status: "Issued", items: [
          item("Roller Blinds", "Rollers", "W 1200mm x D 1500mm", ["Blackout", "Arena"], 185, { Room: "Living room", Width: "1200", Drop: "1500" }),
          item("Zebra Blinds", "Rollers", "W 900mm x D 1200mm", ["Day & Night", "Decora"], 142, { Room: "Bedroom", Width: "900", Drop: "1200" })
        ] },
        Q2: { status: "Issued", items: [
          item("Roller Blinds", "Rollers", "W 1200mm x D 1500mm", ["Dim out", "Arena"], 158, { Room: "Living room", Width: "1200", Drop: "1500" }),
          item("Verticals", "Verts", "W 2400mm x D 2100mm", ["Louvres 89mm", "Louvolite"], 264, { Room: "Patio doors", Width: "2400", Drop: "2100" }),
          item("Fauxwood Venetian", "Venetian", "W 600mm x D 900mm", ["50mm slat", "White"], 96, { Room: "Kitchen", Width: "600", Drop: "900" })
        ] },
        Q3: { status: "Draft", items: [
          item("Ecowood Plus Shutter", "Shutters", "W 1200mm x D 1500mm", ["89mm louvre", "Full height"], 640, { Room: "Living room", Width: "1200", Drop: "1500" }),
          item("Roller Blinds", "Rollers", "W 900mm x D 1200mm", ["Blackout", "Arena"], 148, { Room: "Bedroom", Width: "900", Drop: "1200" })
        ] }
      }
    };
  }

  // ---------- ON5507: Markilux awnings job (Interactive Quotes sample) ----------
  const opt = (id, name, desc, price, mandatory = false) => ({ id, name, desc, price, mandatory });
  // optional extras offered on products that have no extras of their own
  const CONTROL_EXTRAS = [
    opt("MTR-REM", "Motor upgrade + remote", "Somfy io motor with handheld remote", 395),
    opt("WND-SEN", "Wind sensor", "Automatic retract protection in high winds", 245),
    opt("WALL-TX", "Wall transmitter", "Additional wireless wall-mounted control", 85),
    opt("MTR-SMART", "Motor + smart remote", "io-homecontrol motor with multi-channel remote", 475),
    opt("SUN-WND", "Sun & wind sensor", "Automated sun extension and wind retraction", 295),
    opt("LED-LINE", "LED line", "Dimmable integrated cassette lighting", 795),
    opt("PATIO-HTR", "Patio heater 2 kW", "Wall-mounted infrared heater with remote control", 540)
  ];
  // base = price without extras; chosen = ids of the extras already on the quote (mandatory ones are always included)
  function mk(product, group, desc, room, w, d, base, options = CONTROL_EXTRAS, chosen = []) {
    const extras = options.filter(o => o.mandatory || chosen.includes(o.id)).map(o => ({ ...o }));
    const net = Math.round((base + extras.reduce((a, x) => a + x.price, 0)) * 100) / 100;
    return {
      product, group, description: desc, cost: Math.round(base * 0.45 * 100) / 100, qty: 1, unit: net, net,
      vat: Math.round(net * 0.2 * 100) / 100, extras,
      data: { values: { Room: room, Width: String(w), Drop: String(d) }, options: options.map(o => ({ ...o })), unit: "mm", status: "", recipe: "Standard", ready: false, created: "", due: "", vatOn: true, vatRate: "20", round: "none", override: 0 }
    };
  }
  function markilux(ref) {
    const m990 = [opt("MTR-REM", "Motor upgrade + remote", "Somfy io motor with handheld remote", 395, true), opt("WND-SEN", "Wind sensor", "Automatic retract protection in high winds", 245), opt("LED-SPT", "LED lighting", "Integrated warm-white under-cassette LED lighting", 625), opt("WALL-TX", "Wall transmitter", "Additional wireless wall-mounted control", 85)];
    const mx3 = [opt("MTR-SMART", "Motor + smart remote", "io-homecontrol motor with multi-channel remote", 475, true), opt("SUN-WND", "Sun & wind sensor", "Automated sun extension and wind retraction", 295), opt("LED-LINE", "LED line", "Dimmable integrated cassette lighting", 795), opt("PATIO-HTR", "Patio heater 2 kW", "Wall-mounted infrared heater with remote control", 540)];
    return {
      ref, status: "Lead", orderStatus: "Not confirmed yet", account: "752", invoice: "", due: "2026-09-30",
      contact: { cAccountType: "Domestic", cTitle: "", cFirst: "Mr & Mrs", cLast: "Taylor", cEmail: "taylor.family@example.com", cPhone: "01632 960 418", cMobile: "07700 900 314", cAddress1: "27 Orchard Way", cTown: "Guildford", cState: "Surrey", cZip: "GU1 4QT", jManager: "Srinath", jStatusNotes: "Markilux awnings" },
      current: "Q1",
      quotes: {
        Q1: { status: "Issued", payment: "30% deposit", items: [
          mk("Markilux 990", "Outdoor Products", "4000 x 2500 mm | Full cassette | Anthracite frame | Sunvas fabric 31409", "Rear Garden Terrace", 4000, 2500, 3785, m990, ["WND-SEN"]),
          mk("Markilux MX-3", "Outdoor Products", "5000 x 3000 mm | Curved full cassette | Stone Grey Metallic | Sunvas fabric 41680", "Rear Garden Terrace", 5000, 3000, 5120, mx3, ["SUN-WND", "LED-LINE"])
        ] },
        Q2: { status: "Issued", payment: "30% deposit", items: [
          mk("Markilux 5010", "Outdoor Products", "5500 x 3000 mm | Full cassette | Traffic White frame", "Kitchen & Dining Patio", 5500, 3000, 6295),
          mk("Markilux MX-4", "Outdoor Products", "6000 x 3500 mm | Premium full cassette | Havana Brown", "Side Garden / Lounge Patio", 6000, 3500, 7850)
        ] },
        Q3: { status: "Issued", payment: "50% deposit", items: [
          mk("Vertical blinds", "Verts", "500 x 600 mm | Expressions Faux Wood | Snow", "Bedroom", 500, 600, 8240),
          mk("Roller Shade", "Rollers", "500 x 500 mm | Alessi | Stone", "Kitchen", 500, 500, 7067),
          mk("Venetian Blinds", "Venetian", "600 x 900 mm | 25 mm Aluminium | White", "Study room", 600, 900, 4103)
        ] },
        Q4: { status: "Draft", payment: "50% deposit", items: [
          mk("Vertical Shade", "Verts", "Hall | 500 x 600 mm | Pearl | Motorised", "Hall", 500, 600, 11800),
          mk("Faux wood blinds", "Venetian", "500 x 500 mm | Slate | Upgraded lining", "Dining room", 500, 500, 9250),
          mk("Plantation Shutters", "Shutters", "900 x 1200 mm | 89 mm louvre | White", "Living room", 900, 1200, 8245)
        ] }
      }
    };
  }

  return {
    load(ref) {
      if (!ref) return null;
      return read()[ref] || (ref === "ON5507" ? markilux(ref) : sample(ref));
    },
    save(job) {
      const all = read();
      all[job.ref] = job;
      write(all);
    },
    remove(ref) {
      const all = read();
      delete all[ref];
      write(all);
    },
    list() { return Object.values(read()); },
    // next free ONxxxx number above the highest one in use
    nextRef(taken = []) {
      const nums = [...taken, ...Object.keys(read())].map(r => Number(String(r).replace(/\D/g, "")) || 0);
      return "ON" + (Math.max(5507, ...nums) + 1);
    }
  };
})();
