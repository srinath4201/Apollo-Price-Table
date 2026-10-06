// Create / Edit Job: Select Report → Quotation flow.
//   Select Report ▾ → Quotation → quotation type
//     Standard    → choose quote versions → report preview → Send ▾ (format) → Email Options → Email sent
//     Interactive → Interactive Quotes (products + optional extras across versions) → Preview → Confirm → Email Options → Email sent
//   Email sent → Open customer view → customer picks products / extras → accepts → new quote version "Customer Accepted"
//   Other reports (Invoice, Order Confirmation, Delivery Note) open the report preview for the current version.
// Job bar ⋯ : Create > New quote version, New quote version, Compare quote version, Interactive Quotes, Back to All Job.
// Uses from js/create-job.js: $, esc, money, todayDMY, job, jobItems, quoteIds, quoteItems, switchQuote, addQuoteVersion, logActivity, flash.

(() => {
  // ---------- Quotation optional extras (sample catalogue, by product group) ----------
  const EXTRAS = {
    Rollers: [
      { id: "motor", name: "Motorised upgrade", desc: "Rechargeable motor in place of the chain", price: 120 },
      { id: "remote", name: "Remote control", desc: "5-channel handheld remote", price: 35 },
      { id: "cassette", name: "Cassette headrail", desc: "Covered top rail in a matching colour", price: 28 }
    ],
    Verts: [
      { id: "vmotor", name: "Motorised headrail", desc: "Motorised traverse and tilt", price: 150 },
      { id: "weights", name: "Bottom chain weights", desc: "Keeps the louvres aligned", price: 12 }
    ],
    Venetian: [
      { id: "wand", name: "Tilt wand upgrade", desc: "Wand tilt in place of cords", price: 15 },
      { id: "tapes", name: "Decorative tapes", desc: "Matching ladder tapes", price: 22 }
    ],
    Shutters: [
      { id: "tilt", name: "Hidden tilt rod", desc: "Clean look, no front rod", price: 60 },
      { id: "frame", name: "Colour-matched frame", desc: "Frame painted to the panel colour", price: 85 }
    ],
    "Soft Furnishing": [
      { id: "lining", name: "Blackout lining", desc: "Full blackout lining", price: 48 },
      { id: "tieback", name: "Tie-backs (pair)", desc: "Matching fabric tie-backs", price: 25 }
    ],
    "Outdoor Products": [
      { id: "wind", name: "Wind sensor", desc: "Retracts automatically in high wind", price: 245 },
      { id: "led", name: "LED lighting", desc: "Integrated warm-white lighting", price: 395 }
    ],
    common: [
      { id: "fit", name: "Professional fitting", desc: "Measured and fitted by our installer", price: 45 },
      { id: "removal", name: "Remove old blinds", desc: "Removal and disposal", price: 20 }
    ]
  };
  // products can carry their own extras (item.data.options, with mandatory ones); otherwise the group catalogue is offered
  const optionsFor = it => (it.data && Array.isArray(it.data.options) ? it.data.options : [...(EXTRAS[it.group] || []), ...EXTRAS.common]);
  const mandatoryIds = it => optionsFor(it).filter(o => o.mandatory).map(o => o.id);
  // extras ticked when a product is selected: the ones already on the quote + mandatory ones
  const defaultSet = it => new Set([...(it.extras || []).map(x => x.id), ...mandatoryIds(it)]);

  // ---------- money helpers (extras are folded into an item's net once accepted) ----------
  const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const gbp = n => `£ ${Number(r2(n)).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const sumX = list => (list || []).reduce((a, x) => a + Number(x.price || 0), 0);
  const rate = it => (it.net ? it.vat / it.net : 0.2);
  const baseNet = it => r2(it.net - sumX(it.extras));
  const lineNet = (it, extras) => r2(baseNet(it) + sumX(extras));
  const lineVat = (it, extras) => r2(lineNet(it, extras) * rate(it));
  const totals = lines => {
    const net = r2(lines.reduce((a, l) => a + lineNet(l.item, l.extras), 0));
    const vat = r2(lines.reduce((a, l) => a + lineVat(l.item, l.extras), 0));
    return { net, vat, total: r2(net + vat) };
  };
  const linesOf = items => items.map(item => ({ item, extras: item.extras || [] }));
  const location = it => it.data?.values?.Room || it.data?.values?.Location || "";
  const clone = v => JSON.parse(JSON.stringify(v));
  const ref = () => $("jobRef").value.trim() || "New job";
  const customerName = () => [$("cTitle").value, $("cFirst").value, $("cLast").value].filter(Boolean).join(" ") || "Customer";

  // ---------- open / close popups ----------
  const stack = [];
  function show(id) { const el = $(id); el.hidden = false; if (!stack.includes(id)) stack.push(id); }
  function hide(id) { $(id).hidden = true; const i = stack.indexOf(id); if (i > -1) stack.splice(i, 1); }
  document.querySelectorAll("[data-qm-close]").forEach(b => b.addEventListener("click", () => hide(b.closest(".modal-overlay").id)));
  window.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!$("rpFormats").hidden) { closeFormats(); e.stopImmediatePropagation(); return; }
    if (!$("jobMoreMenu").hidden) { closeMore(); $("jobMoreBtn").focus(); e.stopImmediatePropagation(); return; }
    if (!stack.length) return;
    e.stopImmediatePropagation();
    const top = stack[stack.length - 1];
    top === "iqModal" ? closeIQ() : top === "rpView" ? closeReport() : hide(top);
  }, true);

  // ---------- Select Report ▾ ----------
  const repBtn = $("selectReportBtn");
  const repMenu = $("reportMenu");
  function closeRepMenu() { repMenu.hidden = true; repBtn.setAttribute("aria-expanded", "false"); }
  repBtn.addEventListener("click", e => {
    e.stopPropagation();
    repMenu.hidden = !repMenu.hidden;
    repBtn.setAttribute("aria-expanded", String(!repMenu.hidden));
  });
  document.addEventListener("click", e => { if (!repMenu.hidden && !e.target.closest(".rep-wrap")) closeRepMenu(); });
  repMenu.addEventListener("click", e => {
    const b = e.target.closest("[data-report]");
    if (!b) return;
    closeRepMenu();
    if (b.dataset.report === "Quotation") {
      if (!versionsWithItems().length) { flash("Add a product to the job to create a quotation", false); return; }
      openType();
      return;
    }
    openReport(b.dataset.report, { [job.current]: { ...job.quotes[job.current], items: jobItems } });
  });

  // ---------- 1. Quotation type ----------
  const versionsWithItems = () => quoteIds().filter(id => quoteItems(id).length);
  function openType() {
    const n = versionsWithItems().length;
    const text = `${n} quote version${n === 1 ? "" : "s"} with products on this job`;
    $("qtStandardMeta").textContent = text;
    $("qtInteractiveMeta").textContent = text;
    show("qtTypeModal");
    $("qtTypeModal").querySelector("input:checked").focus();
  }
  $("qtTypeModal").addEventListener("dblclick", e => { if (e.target.closest(".qt-card")) $("qtTypeContinue").click(); });
  $("qtTypeContinue").addEventListener("click", () => {
    const type = $("qtTypeModal").querySelector("input[name=qtType]:checked").value;
    hide("qtTypeModal");
    type === "interactive" ? openIQ("rep") : openVersions();
  });

  // ---------- 2. Standard: choose quote versions ----------
  const qvChecks = () => [...$("qvRows").querySelectorAll("input[data-qv]")];
  function openVersions() {
    $("qvRows").innerHTML = quoteIds().map(id => {
      const items = quoteItems(id);
      const t = totals(linesOf(items));
      return `<tr class="${items.length ? "" : "dim"}">
        <td><input type="checkbox" class="jt-chk" data-qv="${id}" ${id === job.current && items.length ? "checked" : ""} ${items.length ? "" : "disabled"} aria-label="Include ${id}"></td>
        <td><b>${id}</b></td><td>${esc(job.quotes[id].status)}</td><td>${items.length}</td><td class="right">${gbp(t.total)}</td></tr>`;
    }).join("");
    $("qvError").textContent = "";
    syncVersions();
    show("qtVersionsModal");
  }
  function syncVersions() {
    const on = qvChecks().filter(c => !c.disabled);
    $("qvAll").checked = on.length > 0 && on.every(c => c.checked);
    $("qvAll").indeterminate = on.some(c => c.checked) && !$("qvAll").checked;
  }
  $("qvRows").addEventListener("change", () => { $("qvError").textContent = ""; syncVersions(); });
  $("qvAll").addEventListener("change", e => { qvChecks().filter(c => !c.disabled).forEach(c => { c.checked = e.target.checked; }); syncVersions(); });
  $("qvContinue").addEventListener("click", () => {
    const ids = qvChecks().filter(c => c.checked).map(c => c.dataset.qv);
    if (!ids.length) { $("qvError").textContent = "Select at least one quote version"; return; }
    hide("qtVersionsModal");
    openReport("Quotation", Object.fromEntries(ids.map(id => [id, { ...job.quotes[id], items: quoteItems(id) }])));
  });

  // ---------- 3. Report preview ----------
  let report = { type: "Quotation", quotes: {}, include: new Set() };
  const includedIds = () => Object.keys(report.quotes).filter(id => report.include.has(id));

  function openReport(type, quotes) {
    report = { type, quotes, include: new Set(Object.keys(quotes)) };
    $("rpTitle").textContent = type;
    renderReport();
    show("rpView");
    $("rpPages").scrollTop = 0;
  }
  function closeReport() { closeFormats(); hide("rpView"); }
  $("rpClose").addEventListener("click", closeReport);

  function renderReport() {
    const ids = Object.keys(report.quotes);
    $("rpSelect").innerHTML = `<span class="rp-sel-lbl">Include in email:</span>` + ids.map(id =>
      `<label class="rp-chip ${report.include.has(id) ? "on" : ""}"><input type="checkbox" class="jt-chk" data-inc="${id}" ${report.include.has(id) ? "checked" : ""}> ${id}</label>`).join("") +
      `<span class="rp-sel-count">${includedIds().length} of ${ids.length} selected</span>`;
    $("rpPages").innerHTML = ids.map((id, i) => page(id, report.quotes[id], i, ids.length)).join("");
    $("rpCount").textContent = `${ids.length} page${ids.length === 1 ? "" : "s"}`;
    const none = !includedIds().length;
    $("rpSend").disabled = none;
    $("rpPdf").disabled = none;
    $("rpSend").title = none ? "Include at least one quote version" : "Send";
  }
  $("rpView").addEventListener("change", e => {
    const id = e.target.dataset.inc;
    if (!id) return;
    e.target.checked ? report.include.add(id) : report.include.delete(id);
    renderReport();
  });

  function page(id, q, i, n) {
    const lines = linesOf(q.items);
    const t = totals(lines);
    const on = report.include.has(id);
    const addr = [$("cAddress1").value, $("cTown").value, $("cZip").value].filter(Boolean).map(esc).join("<br>");
    return `<article class="rp-page ${on ? "" : "excluded"}">
      <label class="rp-page-inc"><input type="checkbox" class="jt-chk" data-inc="${id}" ${on ? "checked" : ""}> Include ${id}</label>
      <header class="rp-page-head">
        <div class="rp-brand"><span class="logo"><span>Blindmatrix</span></span><div><b>Blindmatrix</b><small>sales@blindmatrix.com</small></div></div>
        <div class="rp-doc"><h2>${esc(report.type)}</h2><span>${esc(ref())} · ${id}</span></div>
      </header>
      <div class="rp-meta">
        <div><b>To</b><span>${esc(customerName())}${addr ? "<br>" + addr : ""}</span></div>
        <div><b>Job Ref No</b><span>${esc(ref())}</span><b>Quote version</b><span>${id} · ${esc(q.status)}</span></div>
        <div><b>Date</b><span>${todayDMY()}</span><b>${q.payment ? "Payment" : "Valid for"}</b><span>${esc(q.payment || "30 days")}</span></div>
      </div>
      <table class="rp-table">
        <colgroup><col><col style="width:50px"><col style="width:100px"><col style="width:90px"><col style="width:100px"></colgroup>
        <thead><tr><th>Description</th><th>Qty</th><th class="right">Net</th><th class="right">VAT</th><th class="right">Total</th></tr></thead>
        <tbody>${lines.length ? lines.map(({ item, extras }) => `<tr>
          <td><b>${esc(item.product)}</b><span>${esc(item.description)}</span>${location(item) ? `<span>Location: ${esc(location(item))}</span>` : ""}${extras.length ? `<span class="rp-x">Optional extras: ${extras.map(x => `${esc(x.name)} (+${gbp(x.price)})`).join(", ")}</span>` : ""}</td>
          <td>${item.qty}</td><td class="right">${gbp(lineNet(item, extras))}</td><td class="right">${gbp(lineVat(item, extras))}</td><td class="right">${gbp(lineNet(item, extras) + lineVat(item, extras))}</td></tr>`).join("")
          : `<tr><td colspan="5" class="rp-none">No products in this quote version</td></tr>`}</tbody>
      </table>
      <div class="rp-totals"><span>Net</span><b>${gbp(t.net)}</b><span>VAT</span><b>${gbp(t.vat)}</b><span class="grand">Total</span><b class="grand">${gbp(t.total)}</b></div>
      <footer class="rp-page-foot">Page ${i + 1} of ${n} · Prototype preview with sample data</footer>
    </article>`;
  }

  // Print / Save PDF
  $("rpPrint").addEventListener("click", () => {
    document.body.classList.add("rp-printing");
    window.print();
  });
  window.addEventListener("afterprint", () => document.body.classList.remove("rp-printing"));
  $("rpPdf").addEventListener("click", () => {
    const ids = includedIds();
    if (ids.length) downloadPdf(ids.map(id => [id, report.quotes[id]]), `${ref()}_${report.type.replace(/\s+/g, "_")}.pdf`);
  });

  // Send ▾ → format
  const formats = $("rpFormats");
  function closeFormats() { formats.hidden = true; $("rpSend").setAttribute("aria-expanded", "false"); }
  $("rpSend").addEventListener("click", e => {
    e.stopPropagation();
    formats.hidden = !formats.hidden;
    $("rpSend").setAttribute("aria-expanded", String(!formats.hidden));
  });
  formats.addEventListener("click", e => {
    const b = e.target.closest("[data-format]");
    if (!b) return;
    closeFormats();
    openEmail(b.dataset.format, Object.fromEntries(includedIds().map(id => [id, report.quotes[id]])));
  });
  document.addEventListener("click", e => { if (!formats.hidden && !e.target.closest(".rp-send-wrap")) closeFormats(); });

  // ---------- 4. Email Options ----------
  let mail = null; // { format, quotes, type }
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function messageHtml() {
    const token = Math.random().toString(36).slice(2, 10).toUpperCase();
    return `Dear ${esc(customerName())},<br><br>Please find your quotation for job ${esc(ref())}. You can choose the products and optional extras you want and accept online.<br><br><a href="#" data-token="${token}">View quotation</a><br><br>Kind regards,<br>Srinath`;
  }
  function openEmail(format, quotes) {
    const ids = Object.keys(quotes);
    mail = { format, quotes: clone(quotes), type: report.type };
    $("emFormat").textContent = `${report.type} as ${format}`;
    $("emTo").value = $("cEmail").value.trim();
    $("emCc").value = "";
    $("emSubject").value = `${ref()} - ${report.type} - ${ids.join(", ")}`;
    $("emTemplate").value = ids.length > 1 ? "multiple" : "standard";
    $("emMessage").innerHTML = messageHtml();
    $("emChips").innerHTML = ids.map(id => `<span class="em-chip">${id}</span>`).join("");
    $("emAttach").checked = false;
    $("emFiles").textContent = "";
    $("emError").textContent = "";
    $("emForm").querySelectorAll(".invalid").forEach(x => x.classList.remove("invalid"));
    show("emModal");
    ($("emTo").value ? $("emSubject") : $("emTo")).focus();
  }
  $("emAttach").addEventListener("change", e => {
    $("emFiles").textContent = e.target.checked ? Object.keys(mail.quotes).map(id => `${ref()}_${id}.pdf`).join("   ") : "";
  });
  $("emMessage").addEventListener("click", e => { if (e.target.closest("a")) e.preventDefault(); });
  $("emForm").addEventListener("input", e => { e.target.classList?.remove("invalid"); $("emError").textContent = ""; });
  $("emForm").addEventListener("change", e => { e.target.classList?.remove("invalid"); $("emError").textContent = ""; });
  $("emForm").addEventListener("submit", e => {
    e.preventDefault();
    const to = $("emTo").value.trim();
    const cc = $("emCc").value.trim();
    const fail = (id, text) => { $(id).classList.add("invalid"); $("emError").textContent = text; $(id).focus(); };
    if (!EMAIL.test(to)) return fail("emTo", "Enter a valid customer email");
    if (cc && cc.split(/[;,]/).some(v => !EMAIL.test(v.trim()))) return fail("emCc", "Enter valid Cc emails separated by commas");
    if (!$("emSubject").value.trim()) return fail("emSubject", "Enter a subject");
    if (!$("emTemplate").value) return fail("emTemplate", "Select a template");
    if (!$("emMessage").textContent.trim()) return fail("emMessage", "Enter a message");
    const ids = Object.keys(mail.quotes);
    mail.to = to;
    ids.forEach(id => { if (job.quotes[id] && job.quotes[id].status === "Draft") job.quotes[id].status = "Issued"; });
    if (typeof renderQuoteVer === "function") renderQuoteVer();
    hide("emModal");
    if (!$("iqModal").hidden) closeIQ();
    if (!$("rpView").hidden) closeReport();
    $("emSentText").innerHTML = `${ids.map(esc).join(", ")} sent to <b>${esc(to)}</b> as <b>${esc(mail.format)}</b>.`;
    show("emSentModal");
    logActivity(`${mail.type} ${ids.join(", ")} emailed to ${to}`);
  });
  $("emOpenCustomer").addEventListener("click", () => { hide("emSentModal"); openIQ("customer"); });

  // ---------- 5. Interactive Quotes / customer View Quotation ----------
  let iq = null;
  // iq = { mode: "rep" | "customer", ids: [] (included versions), active, step, sel: Map("Q1:0" → Set(extra ids)), name, note, checks, accepted }
  const source = id => (iq.mode === "customer" ? mail.quotes[id].items : quoteItems(id));
  const status = id => (iq.mode === "customer" ? mail.quotes[id].status : job.quotes[id].status);
  const payment = id => (iq.mode === "customer" ? mail.quotes[id].payment : job.quotes[id].payment);
  const navIds = () => (iq.mode === "customer" ? Object.keys(mail.quotes) : versionsWithItems());
  const key = (id, i) => `${id}:${i}`;
  const extrasOf = (it, set) => optionsFor(it).concat((it.extras || []).filter(x => !optionsFor(it).some(o => o.id === x.id))).filter(o => o.mandatory || set.has(o.id));
  const chosenLines = () => [...iq.sel.entries()].map(([k, set]) => {
    const [id, i] = k.split(":");
    const item = source(id)[+i];
    return { id, i: +i, item, extras: extrasOf(item, set) };
  }).filter(l => l.item && iq.ids.includes(l.id));

  function openIQ(mode) {
    if (mode === "customer" && !mail) return;
    iq = { mode, ids: [], active: null, step: 1, sel: new Map(), name: mode === "customer" ? customerName() : "Srinath", note: "", checks: { products: false, terms: false }, accepted: null };
    iq.ids = navIds();
    iq.active = iq.ids.includes(job.current) && mode === "rep" ? job.current : iq.ids[0];
    if (mode === "rep") iq.ids.forEach(id => source(id).forEach((it, i) => iq.sel.set(key(id, i), defaultSet(it))));
    $("iqModal").classList.toggle("customer", mode === "customer");
    $("iqTitle").textContent = mode === "customer" ? "View Quotation" : "Interactive Quotes";
    $("iqSub").textContent = mode === "customer" ? `Job ${ref()} · choose the products and optional extras you would like` : "Select products and optional extras from one or more quote versions";
    show("iqModal");
    renderIQ();
  }
  function closeIQ() { hide("iqModal"); }
  $("iqClose").addEventListener("click", closeIQ);

  function steps() {
    const names = ["Products", "Preview", "Confirm"];
    return `<ol class="iq-steps">${names.map((n, i) => `<li class="${iq.step === i + 1 ? "active" : iq.step > i + 1 ? "done" : ""}"><span>${iq.step > i + 1 ? "✓" : i + 1}</span>${n}</li>`).join("")}</ol>`;
  }
  function metrics(t, extra = "") {
    return `<div class="iq-metrics">${extra}<div><span>Net</span><b>${gbp(t.net)}</b></div><div><span>VAT</span><b>${gbp(t.vat)}</b></div><div><span>Total</span><b>${gbp(t.total)}</b></div></div>`;
  }

  function renderIQ() {
    const locked = iq.step >= 3;
    $("iqNav").innerHTML = navIds().map(id => {
      const t = totals(linesOf(source(id)));
      const inc = iq.ids.includes(id);
      const picked = chosenLines().filter(l => l.id === id).length;
      return `<div class="iq-ver ${iq.active === id ? "active" : ""} ${inc ? "" : "off"}">
        <input type="checkbox" class="jt-chk" data-inc-ver="${id}" ${inc ? "checked" : ""} ${locked ? "disabled" : ""} aria-label="Include ${id}">
        <button type="button" data-ver="${id}" ${locked || !inc ? "disabled" : ""}><b>${id}</b><span>${esc(status(id))}${picked ? ` · ${picked} selected` : ""}</span><em>${gbp(t.total)}</em></button>
      </div>`;
    }).join("");
    const main = $("iqMain");
    if (iq.step === 1) main.innerHTML = stepProducts();
    else if (iq.step === 2) main.innerHTML = stepPreview();
    else if (iq.step === 3) main.innerHTML = stepConfirm();
    else main.innerHTML = stepDone();
    renderFoot();
  }

  function stepProducts() {
    if (!iq.active) return steps() + `<p class="iq-empty">Include a quote version on the left to choose its products.</p>`;
    const items = source(iq.active);
    const all = items.length && items.every((_, i) => iq.sel.has(key(iq.active, i)));
    const sel = chosenLines();
    return steps() + `<div class="iq-title"><div><h4>${iq.active} products</h4><p>Your choices are kept when you switch quote versions.</p></div>
      <label class="iq-all"><input type="checkbox" class="jt-chk" id="iqAll" ${all ? "checked" : ""}> Select all</label></div>` +
      metrics(totals(sel), `<div><span>Selected</span><b>${sel.length} product${sel.length === 1 ? "" : "s"}</b></div>`) +
      items.map((it, i) => {
        const set = iq.sel.get(key(iq.active, i));
        const opts = optionsFor(it);
        return `<article class="iq-card ${set ? "on" : ""}">
          <div class="iq-card-main">
            <input type="checkbox" class="jt-chk" data-p="${i}" ${set ? "checked" : ""} aria-label="Select ${esc(it.product)}">
            <div class="iq-card-text"><b>${esc(it.product)}</b><span>${esc(it.description)}</span>${location(it) ? `<span class="iq-loc">Location: ${esc(location(it))}</span>` : ""}</div>
            <div class="iq-price"><b>${gbp(lineNet(it, set ? extrasOf(it, set) : []))}</b><small>Base ${gbp(baseNet(it))}</small></div>
          </div>
          <div class="iq-extras"><span class="iq-x-title">Optional extras</span>
            <div class="iq-x-grid">${opts.map(o => {
              const on = !!set && (set.has(o.id) || o.mandatory);
              return `<label class="iq-x ${on ? "on" : ""} ${o.mandatory ? "req" : ""}"><input type="checkbox" class="jt-chk" data-p="${i}" data-x="${o.id}" ${on ? "checked" : ""} ${o.mandatory && set ? "disabled" : ""}><span><b>${esc(o.name)}${o.mandatory ? ` <i class="iq-badge req" title="Always included with this product">Mandatory</i>` : on ? ` <i class="iq-badge">${iq.mode === "customer" ? "Selected" : "Rep selected"}</i>` : ""}</b><small>${esc(o.desc || "")}</small></span><em>+${gbp(o.price)}</em></label>`;
            }).join("")}</div>
          </div>
        </article>`;
      }).join("");
  }

  function stepPreview() {
    const lines = chosenLines();
    return steps() + `<div class="iq-title"><div><h4>Preview selected products</h4><p>Check the products, locations and optional extras before you continue.</p></div></div>` +
      metrics(totals(lines)) +
      lines.map(l => `<div class="iq-review">
        <div><b>${esc(l.item.product)}</b> <span class="em-chip">${l.id}</span><span>${esc(l.item.description)}</span>${location(l.item) ? `<span class="iq-loc">Location: ${esc(location(l.item))}</span>` : ""}
          <div class="iq-review-x">${l.extras.length ? l.extras.map(x => `<div><span>${esc(x.name)}${x.mandatory ? " (Mandatory)" : ""}</span><b>+${gbp(x.price)}</b></div>`).join("") : "<div><span>No optional extras</span></div>"}</div>
        </div>
        <div class="iq-price"><b>${gbp(lineNet(l.item, l.extras))}</b><small>Base ${gbp(baseNet(l.item))}</small></div>
      </div>`).join("");
  }

  function stepConfirm() {
    const cust = iq.mode === "customer";
    const t = totals(chosenLines());
    return steps() + `<div class="iq-title"><div><h4>${cust ? "Accept quotation" : "Confirm and send"}</h4><p>${cust ? "Accepting creates a new quote version with your choices." : "The customer receives these products and extras and can choose online."}</p></div></div>
      <div class="iq-form">
        <label class="cf-lbl" for="iqName">${cust ? "Your name" : "Sales rep"} <sup>*</sup></label><input class="cf-in" id="iqName" value="${esc(iq.name)}" autocomplete="off">
        <label class="cf-lbl" for="iqNote">Note</label><input class="cf-in" id="iqNote" value="${esc(iq.note)}" placeholder="Optional note" autocomplete="off">
      </div>
      ${cust ? `<div class="iq-checks">
        <label><input type="checkbox" class="jt-chk" id="iqChkProducts" ${iq.checks.products ? "checked" : ""}> I confirm the selected products, sizes, extras and prices are correct.</label>
        <label><input type="checkbox" class="jt-chk" id="iqChkTerms" ${iq.checks.terms ? "checked" : ""}> I accept the quotation <button type="button" class="iq-link" id="iqTerms">terms and conditions</button>.</label>
      </div>` : ""}
      <div class="iq-final"><span>Final amount</span><b>${gbp(t.total)}</b><small>${chosenLines().length} products · Net ${gbp(t.net)} · VAT ${gbp(t.vat)}</small></div>`;
  }

  function stepDone() {
    const a = iq.accepted;
    return steps() + `<div class="qm-done">
      <span class="qm-done-ic"><svg width="30" height="30" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="2"><path d="M5 10.5l3.2 3.2L15 7"/></svg></span>
      <h3>Quotation accepted</h3>
      <p><b>${a.id}</b> has been created on job ${esc(ref())} with ${a.count} products and ${a.extras} optional extras. Earlier quote versions stay unchanged.</p>
      <div class="iq-metrics center"><div><span>New quote</span><b>${a.id}</b></div><div><span>Status</span><b class="ok">Customer Accepted</b></div><div><span>Total</span><b>${gbp(a.total)}</b></div></div>
    </div>`;
  }

  function canConfirm() {
    if (!chosenLines().length || !iq.name.trim()) return false;
    return iq.mode !== "customer" || (iq.checks.products && iq.checks.terms);
  }

  function renderFoot() {
    const n = chosenLines().length;
    const vers = new Set(chosenLines().map(l => l.id)).size;
    const info = `<span class="iq-info">${n} product${n === 1 ? "" : "s"} selected from ${vers} quote version${vers === 1 ? "" : "s"}</span>`;
    const cust = iq.mode === "customer";
    $("iqFoot").innerHTML =
      iq.step === 1 ? `${info}<button type="button" class="m-btn m-save" data-go="2" ${n ? "" : "disabled"}>Preview selected</button><button type="button" class="m-btn m-cancel" data-iq-close>Cancel</button>`
      : iq.step === 2 ? `${info}<button type="button" class="m-btn m-save" data-go="3">Continue</button><button type="button" class="m-btn m-cancel" data-go="1">Back</button>`
      : iq.step === 3 ? `${info}${cust ? "" : `<button type="button" class="m-btn m-cancel" data-iq-report>Preview report</button>`}<button type="button" class="m-btn m-save" id="iqConfirm" ${canConfirm() ? "" : "disabled"}>${cust ? "Accept quotation" : "Send"}</button><button type="button" class="m-btn m-cancel" data-go="2">Back</button>`
      : `<button type="button" class="m-btn m-cancel" data-iq-pdf>Download PDF</button><button type="button" class="m-btn m-save" data-iq-job>Back to job</button>`;
  }

  // selections
  $("iqMain").addEventListener("change", e => {
    const t = e.target;
    if (t.id === "iqAll") {
      source(iq.active).forEach((it, i) => {
        const k = key(iq.active, i);
        if (!t.checked) iq.sel.delete(k);
        else if (!iq.sel.has(k)) iq.sel.set(k, defaultSet(it));
      });
    } else if (t.id === "iqChkProducts") { iq.checks.products = t.checked; renderFoot(); return; }
    else if (t.id === "iqChkTerms") { iq.checks.terms = t.checked; renderFoot(); return; }
    else if (t.dataset.p !== undefined) {
      const i = +t.dataset.p;
      const it = source(iq.active)[i];
      const k = key(iq.active, i);
      if (t.dataset.x) {
        // ticking an extra also selects its product
        const set = iq.sel.get(k) || defaultSet(it);
        if (mandatoryIds(it).includes(t.dataset.x)) t.checked = true;
        else t.checked ? set.add(t.dataset.x) : set.delete(t.dataset.x);
        iq.sel.set(k, set);
      } else if (t.checked) iq.sel.set(k, defaultSet(it));
      else iq.sel.delete(k);
    } else return;
    keepScroll(renderIQ);
  });
  $("iqMain").addEventListener("input", e => {
    if (e.target.id === "iqName") { iq.name = e.target.value; renderFoot(); }
    if (e.target.id === "iqNote") iq.note = e.target.value;
  });
  $("iqMain").addEventListener("click", e => { if (e.target.closest("#iqTerms")) show("termsModal"); });
  $("iqNav").addEventListener("click", e => {
    const b = e.target.closest("[data-ver]");
    if (!b || b.disabled) return;
    iq.active = b.dataset.ver;
    iq.step = 1;
    renderIQ();
    $("iqMain").scrollTop = 0;
  });
  $("iqNav").addEventListener("change", e => {
    const id = e.target.dataset.incVer;
    if (!id) return;
    if (e.target.checked) iq.ids = navIds().filter(x => x === id || iq.ids.includes(x));
    else {
      iq.ids = iq.ids.filter(x => x !== id);
      [...iq.sel.keys()].filter(k => k.startsWith(id + ":")).forEach(k => iq.sel.delete(k));
    }
    if (!iq.ids.includes(iq.active)) iq.active = iq.ids[0] || null;
    iq.step = 1;
    renderIQ();
  });
  $("iqFoot").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    if (b.dataset.go) { iq.step = +b.dataset.go; renderIQ(); $("iqMain").scrollTop = 0; return; }
    if (b.hasAttribute("data-iq-close")) { closeIQ(); return; }
    if (b.hasAttribute("data-iq-report")) { openReport("Quotation", grouped()); return; }
    if (b.id === "iqConfirm") { iq.mode === "customer" ? accept() : openEmailFromIQ(); return; }
    if (b.hasAttribute("data-iq-pdf")) { report.type = "Quotation"; downloadPdf([[iq.accepted.id, { ...job.quotes[iq.accepted.id], items: quoteItems(iq.accepted.id) }]], `${ref()}_${iq.accepted.id}_Quotation.pdf`); return; }
    if (b.hasAttribute("data-iq-job")) { const id = iq.accepted.id; closeIQ(); switchQuote(id); flash(`${id} is now the current quote version`, true); }
  });
  function keepScroll(fn) {
    const m = $("iqMain");
    const top = m.scrollTop;
    const focusSel = document.activeElement && document.activeElement.closest("#iqMain") ? selectorOf(document.activeElement) : null;
    fn();
    m.scrollTop = top;
    if (focusSel) m.querySelector(focusSel)?.focus({ preventScroll: true });
  }
  const selectorOf = el => (el.id ? `#${el.id}` : el.dataset.x ? `[data-p="${el.dataset.p}"][data-x="${el.dataset.x}"]` : el.dataset.p !== undefined ? `[data-p="${el.dataset.p}"]:not([data-x])` : null);

  // selected products grouped by quote version, extras folded in for the report/email
  function grouped() {
    const out = {};
    chosenLines().forEach(l => {
      if (!out[l.id]) out[l.id] = { status: status(l.id), payment: payment(l.id), items: [] };
      out[l.id].items.push({ ...clone(l.item), extras: clone(l.extras), net: lineNet(l.item, l.extras), vat: lineVat(l.item, l.extras) });
    });
    return out;
  }
  function openEmailFromIQ() {
    report.type = "Quotation";
    openEmail("Adobe PDF", grouped());
  }

  // customer accepts → new quote version on the job
  function accept() {
    if (!canConfirm() || iq.accepted) return;
    const items = chosenLines().map(l => {
      const it = clone(l.item);
      it.extras = clone(l.extras);
      it.net = lineNet(l.item, l.extras);
      it.vat = lineVat(l.item, l.extras);
      it.unit = it.qty ? it.net / it.qty : it.net;
      it.source = l.id;
      return it;
    });
    const id = addQuoteVersion("Customer Accepted", items);
    Object.assign(job.quotes[id], { payment: payment(chosenLines()[0].id) || "", acceptedBy: iq.name.trim(), acceptedOn: todayDMY(), note: iq.note.trim() });
    const t = totals(linesOf(items));
    iq.accepted = { id, count: items.length, extras: items.reduce((a, it) => a + it.extras.length, 0), total: t.total };
    if ($("jobStatus").value === "Lead" || $("jobStatus").value === "Agent Quote") $("jobStatus").value = "Order";
    logActivity(`${id} accepted by ${iq.name.trim()} – ${items.length} products, ${gbp(t.total)}${iq.note.trim() ? ` – "${iq.note.trim()}"` : ""}`);
    iq.step = 4;
    renderIQ();
  }

  // ---------- PDF quotation (offline writer, real application/pdf, A4) ----------
  // Layout: navy header band + pink rule, "Quotation to / Job details / Dates" panel, cyan product table
  // (description, location, optional extras), totals box, terms, acceptance, footer with page numbers.
  const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const SPECIAL = { "£": ["\\243", 556], "–": ["\\226", 556], "—": ["\\227", 1000], "·": ["\\267", 278], "×": ["\\327", 584], "’": ["\\222", 222] };
  const charW = c => (SPECIAL[c] ? SPECIAL[c][1] : HELV[c.charCodeAt(0) - 32] || 556);
  const textW = (t, size, bold) => [...String(t)].reduce((a, c) => a + charW(c), 0) * size / 1000 * (bold ? 1.06 : 1);
  const pdfStr = t => [...String(t)].map(c => SPECIAL[c] ? SPECIAL[c][0] : c === "\\" ? "\\\\" : c === "(" ? "\\(" : c === ")" ? "\\)" : c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126 ? c : "-").join("");
  function wrapW(t, width, size, bold) {
    const out = [];
    let row = "";
    String(t || "").split(/\s+/).filter(Boolean).forEach(w => {
      const next = row ? row + " " + w : w;
      if (row && textW(next, size, bold) > width) { out.push(row); row = w; } else row = next;
    });
    if (row) out.push(row);
    return out.length ? out : [""];
  }
  const COLORS = { navy: [28, 31, 58], pink: [229, 25, 125], cyan: [18, 176, 228], ink: [34, 34, 34], grey: [110, 116, 122], light: [245, 246, 248], line: [222, 226, 230], pale: [229, 244, 251], white: [255, 255, 255], green: [63, 155, 35] };
  const rgb = c => COLORS[c].map(v => (v / 255).toFixed(3)).join(" ");
  const addDays = (dmy, n) => { const [d, m, y] = dmy.split("-").map(Number); const t = new Date(y, m - 1, d + n); return `${String(t.getDate()).padStart(2, "0")}-${String(t.getMonth() + 1).padStart(2, "0")}-${t.getFullYear()}`; };

  function downloadPdf(entries, filename) {
    const W = 595, H = 842, L = 40, R = 555;
    const pages = [];
    let c = "";     // current page content
    let t = 0;      // distance from the top of the page
    const Y = top => (H - top).toFixed(2);
    const rect = (x, top, w, h, col) => { c += `${rgb(col)} rg ${x} ${Y(top + h)} ${w} ${h} re f\n`; };
    const hline = (x1, x2, top, col = "line", w = 0.7) => { c += `${rgb(col)} RG ${w} w ${x1} ${Y(top)} m ${x2} ${Y(top)} l S\n`; };
    const text = (s, x, top, size = 9, { bold = false, col = "ink", align = "left" } = {}) => {
      const tx = align === "right" ? x - textW(s, size, bold) : align === "center" ? x - textW(s, size, bold) / 2 : x;
      c += `BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(col)} rg ${tx.toFixed(2)} ${Y(top)} Td (${pdfStr(s)}) Tj ET\n`;
    };
    const docType = report.type || "Quotation";
    const name = customerName();
    const addr = [$("cAddress1").value, $("cAddress2").value, $("cTown").value, [$("cState").value, $("cZip").value].filter(Boolean).join(" ")].map(s => s.trim()).filter(Boolean);
    const contactLine = [$("cEmail").value, $("cPhone").value].map(s => s.trim()).filter(Boolean).join("  ·  ");
    const today = todayDMY();

    function footer() {
      hline(L, R, 806, "line", 0.7);
      text("Blindmatrix Ltd  ·  sales@blindmatrix.com  ·  0161 496 0000  ·  VAT reg. GB 123 4567 89", L, 820, 7.5, { col: "grey" });
    }
    function newPage(id, q, first) {
      if (c) { footer(); pages.push(c); }
      c = "";
      if (first) {
        rect(0, 0, W, 86, "navy");
        rect(0, 86, W, 3.5, "pink");
        // brand mark
        rect(L, 26, 34, 20, "pink");
        text("BM", L + 17, 40, 10, { bold: true, col: "white", align: "center" });
        text("Blindmatrix", L + 44, 38, 16, { bold: true, col: "white" });
        text("Blinds, curtains & awnings  ·  sales@blindmatrix.com  ·  0161 496 0000", L + 44, 54, 8, { col: "white" });
        text(docType.toUpperCase(), R, 42, 24, { bold: true, col: "white", align: "right" });
        text(`${ref()}  ·  ${id}`, R, 60, 9.5, { col: "white", align: "right" });

        // details panel
        const top = 108, h = 92, colW = (R - L) / 3;
        rect(L, top, R - L, h, "light");
        rect(L, top, 3, h, "cyan");
        const block = (i, title, rows) => {
          const x = L + 14 + i * colW;
          text(title, x, top + 18, 7.5, { bold: true, col: "grey" });
          rows.forEach((r, k) => {
            if (Array.isArray(r)) { text(r[0], x, top + 34 + k * 13, 8, { col: "grey" }); text(r[1], x + 62, top + 34 + k * 13, 8.5, { bold: true }); }
            else text(r, x, top + 34 + k * 13, k ? 8.5 : 10, { bold: !k, col: k ? "ink" : "ink" });
          });
        };
        block(0, `${docType.toUpperCase()} TO`, [name, ...addr.slice(0, 3), ...(contactLine ? [contactLine] : [])].slice(0, 5));
        block(1, "JOB DETAILS", [["Job Ref No", ref()], ["Version", id], ["Status", q.status || "Issued"], ["Account", $("accountRef").value.trim() || "–"]]);
        block(2, "DATES & TERMS", [["Date", today], ["Valid until", addDays(today, 30)], ["Payment", q.payment || "On order"], ["Prepared by", "Srinath"]]);
        t = top + h + 22;
      } else {
        rect(0, 0, W, 42, "navy");
        rect(0, 42, W, 2.5, "pink");
        text("Blindmatrix", L, 27, 12, { bold: true, col: "white" });
        text(`${docType}  ${ref()}  ·  ${id}  (continued)`, R, 27, 9, { col: "white", align: "right" });
        t = 66;
      }
      tableHead();
    }
    // columns: # | Description | Qty | Net | VAT | Total
    const X = { no: L + 8, desc: L + 26, descEnd: 342, qty: 362, net: 430, vat: 488, tot: R - 8 };
    function tableHead() {
      rect(L, t, R - L, 24, "cyan");
      text("#", X.no, t + 15.5, 8.5, { bold: true, col: "white" });
      text("DESCRIPTION", X.desc, t + 15.5, 8.5, { bold: true, col: "white" });
      text("QTY", X.qty, t + 15.5, 8.5, { bold: true, col: "white", align: "center" });
      text("NET", X.net, t + 15.5, 8.5, { bold: true, col: "white", align: "right" });
      text("VAT", X.vat, t + 15.5, 8.5, { bold: true, col: "white", align: "right" });
      text("TOTAL", X.tot, t + 15.5, 8.5, { bold: true, col: "white", align: "right" });
      t += 24;
    }

    entries.forEach(([id, q]) => {
      newPage(id, q, true);
      const lines = linesOf(q.items || []);
      if (!lines.length) { text("No products in this quote version.", L + 14, t + 24, 9.5, { col: "grey" }); t += 40; }
      lines.forEach(({ item, extras }, n) => {
        const descW = X.descEnd - X.desc;
        const desc = wrapW(item.description, descW, 8);
        const loc = location(item);
        const xs = extras.map(x => ({ label: wrapW(`+ ${x.name}${x.mandatory ? " (mandatory)" : ""}`, descW - 60, 8), price: gbp(x.price) }));
        const h = 12 + 13 + desc.length * 10.5 + (loc ? 13 : 0) + (xs.length ? 6 + xs.reduce((a, x) => a + x.label.length * 10.5, 0) : 0) + 8;
        if (t + h > 790) newPage(id, q, false);
        if (n % 2) rect(L, t, R - L, h, "light");
        let y = t + 17;
        text(String(n + 1), X.no, y, 9, { bold: true, col: "grey" });
        text(item.product, X.desc, y, 10, { bold: true });
        const net = lineNet(item, extras), vat = lineVat(item, extras);
        text(String(item.qty || 1), X.qty, y, 9, { align: "center" });
        text(gbp(net), X.net, y, 9, { align: "right" });
        text(gbp(vat), X.vat, y, 9, { align: "right" });
        text(gbp(net + vat), X.tot, y, 9.5, { bold: true, align: "right" });
        y += 13;
        desc.forEach(d => { text(d, X.desc, y, 8, { col: "grey" }); y += 10.5; });
        if (loc) { rect(X.desc, y - 8, 2, 10, "cyan"); text(`Location: ${loc}`, X.desc + 6, y, 8, { col: "ink" }); y += 13; }
        if (xs.length) {
          y += 4;
          xs.forEach(x => {
            x.label.forEach((l, k) => { text(l, X.desc + 6, y, 8, { col: "pink" }); if (!k) text(x.price, X.descEnd, y, 8, { col: "pink", align: "right" }); y += 10.5; });
          });
        }
        t += h;
        hline(L, R, t);
      });

      // totals + terms (move to a new page when they do not fit)
      const tt = totals(lines);
      if (t + 210 > 790) newPage(id, q, false);
      t += 18;
      const bx = 345, bw = R - bx;
      const row = (label, val, k) => { text(label, bx + 12, t + 15 + k * 18, 9, { col: "grey" }); text(val, R - 12, t + 15 + k * 18, 9.5, { bold: true, align: "right" }); };
      rect(bx, t, bw, 40, "light");
      row("Subtotal (net)", gbp(tt.net), 0);
      row("VAT", gbp(tt.vat), 1);
      rect(bx, t + 42, bw, 28, "navy");
      text("TOTAL", bx + 12, t + 60, 10, { bold: true, col: "white" });
      text(gbp(tt.total), R - 12, t + 61, 13, { bold: true, col: "white", align: "right" });
      const extrasCount = lines.reduce((a, l) => a + l.extras.length, 0);
      text("SUMMARY", L, t + 15, 7.5, { bold: true, col: "grey" });
      text(`${lines.length} product${lines.length === 1 ? "" : "s"}${extrasCount ? `  ·  ${extrasCount} optional extra${extrasCount === 1 ? "" : "s"}` : ""}`, L, t + 30, 9, { bold: true });
      if (q.payment) text(`Payment terms: ${q.payment}`, L, t + 44, 8.5, { col: "grey" });
      text(`Prices include VAT where shown. Valid until ${addDays(today, 30)}.`, L, t + 58, 8.5, { col: "grey" });
      t += 90;

      // terms
      text("TERMS & CONDITIONS", L, t, 7.5, { bold: true, col: "grey" });
      hline(L, R, t + 5);
      [
        `1. This quotation is valid for 30 days from ${today}.`,
        `2. ${q.payment ? q.payment.replace(/^./, s => s.toUpperCase()) + " is" : "A deposit is"} required before the order goes into production.`,
        "3. Sizes are confirmed at the survey; prices may change if the measurements differ.",
        "4. Optional extras are only supplied when they are listed on the accepted quotation."
      ].forEach((l, k) => text(l, L, t + 19 + k * 12, 8, { col: "ink" }));
      t += 74;

      // acceptance
      rect(L, t, R - L, 50, "pale");
      if (q.acceptedBy) {
        text("ACCEPTED", L + 14, t + 18, 8, { bold: true, col: "green" });
        text(`Accepted online by ${q.acceptedBy} on ${q.acceptedOn || today}${q.note ? `  ·  Note: ${q.note}` : ""}`, L + 14, t + 34, 9, { bold: true });
      } else {
        text("CUSTOMER ACCEPTANCE", L + 14, t + 17, 7.5, { bold: true, col: "grey" });
        text("Signature", L + 14, t + 40, 8, { col: "grey" });
        hline(L + 58, L + 230, t + 41, "grey", 0.6);
        text("Name", L + 250, t + 40, 8, { col: "grey" });
        hline(L + 278, L + 400, t + 41, "grey", 0.6);
        text("Date", L + 412, t + 40, 8, { col: "grey" });
        hline(L + 436, R - 14, t + 41, "grey", 0.6);
      }
      t += 60;
    });
    footer();
    pages.push(c);

    // page numbers
    const total = pages.length;
    const numbered = pages.map((p, i) => {
      const s = `Page ${i + 1} of ${total}`;
      return p + `BT /F1 7.5 Tf ${rgb("grey")} rg ${(R - textW(s, 7.5)).toFixed(2)} ${H - 820} Td (${s}) Tj ET\n`;
    });

    const obj = [null, "<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
    const kids = [];
    numbered.forEach(content => {
      kids.push(`${obj.length} 0 R`);
      obj.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${obj.length + 1} 0 R >>`);
      obj.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    });
    obj[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`;
    obj.push(`<< /Title (${pdfStr(`${docType} ${ref()}`)}) /Author (Blindmatrix) /Producer (Blindmatrix REQ) >>`);
    const info = obj.length - 1;
    let pdf = "%PDF-1.4\n";
    const off = [0];
    for (let i = 1; i < obj.length; i++) { off[i] = pdf.length; pdf += `${i} 0 obj\n${obj[i]}\nendobj\n`; }
    const xref = pdf.length;
    pdf += `xref\n0 ${obj.length}\n0000000000 65535 f \n` + off.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
    pdf += `trailer\n<< /Size ${obj.length} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = Uint8Array.from(pdf, ch => ch.charCodeAt(0) & 255);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return pdf;
  }

  // ---------- Job bar ⋯ menu ----------
  const moreBtn = $("jobMoreBtn");
  const moreMenu = $("jobMoreMenu");
  const createSub = $("jobCreateSub");
  const createBtn = moreMenu.querySelector('[data-more="create"]');
  function closeSub() { createSub.hidden = true; createBtn.setAttribute("aria-expanded", "false"); }
  function closeMore() { moreMenu.hidden = true; closeSub(); moreBtn.setAttribute("aria-expanded", "false"); }
  moreBtn.addEventListener("click", e => {
    e.stopPropagation();
    const open = moreMenu.hidden;
    closeMore();
    moreMenu.hidden = !open;
    moreBtn.setAttribute("aria-expanded", String(open));
  });
  const openSub = () => { createSub.hidden = false; createBtn.setAttribute("aria-expanded", "true"); };
  createBtn.addEventListener("mouseenter", openSub);
  moreMenu.addEventListener("mouseover", e => { const b = e.target.closest("button"); if (b && !b.closest(".jm-sub-wrap")) closeSub(); });
  moreMenu.addEventListener("click", e => {
    const b = e.target.closest("[data-more]");
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.more === "create") { createSub.hidden ? openSub() : closeSub(); return; }
    closeMore();
    if (b.dataset.more === "new") openNewVersion();
    else if (b.dataset.more === "compare") openCompare();
    else if (b.dataset.more === "interactive") {
      if (!versionsWithItems().length) { flash("Add a product first", false); return; }
      openIQ("rep");
    } else if (b.dataset.more === "back") location.href = "all-job.html";
  });
  document.addEventListener("click", e => { if (!moreMenu.hidden && !e.target.closest(".more-wrap")) closeMore(); });

  // ---------- New quote version (copy of an existing one) ----------
  const nextId = () => "Q" + (Math.max(0, ...quoteIds().map(q => Number(q.slice(1)))) + 1);
  function newVerSummary() {
    const id = $("newVerFrom").value;
    const items = quoteItems(id);
    const t = totals(linesOf(items));
    $("newVerSummary").textContent = items.length
      ? `${items.length} product${items.length === 1 ? "" : "s"}: ${items.map(i => i.product).join(", ")} · ${gbp(t.total)}`
      : "This version has no products yet.";
  }
  function openNewVersion() {
    $("newVerName").textContent = nextId();
    $("newVerFrom").innerHTML = quoteIds().map(id => `<option value="${id}" ${id === job.current ? "selected" : ""}>${id} – ${esc(job.quotes[id].status)}</option>`).join("");
    newVerSummary();
    show("newVerModal");
    $("newVerCreate").focus();
  }
  $("newVerFrom").addEventListener("change", newVerSummary);
  $("newVerCreate").addEventListener("click", () => {
    const from = $("newVerFrom").value;
    const id = addQuoteVersion("Draft", clone(quoteItems(from)));
    job.quotes[id].payment = job.quotes[from].payment;
    hide("newVerModal");
    switchQuote(id);
    logActivity(`${id} created from ${from}`);
    flash(`${id} created from ${from}`, true);
  });
  window.openNewVersion = openNewVersion;

  // ---------- Compare quote version ----------
  let cmp = new Set();
  const COMPARE_ROWS = [
    ["Status", q => q.status],
    ["Payment", q => q.payment || "–"],
    ["Products", q => String(q.items.length)],
    ["Product names", q => q.items.map(i => i.product).join(", ") || "–"],
    ["Locations", q => [...new Set(q.items.map(location).filter(Boolean))].join(", ") || "–"],
    ["Optional extras", q => q.items.flatMap(i => (i.extras || []).map(x => x.name)).join(", ") || "–"],
    ["Net price", q => gbp(totals(linesOf(q.items)).net)],
    ["VAT", q => gbp(totals(linesOf(q.items)).vat)],
    ["Gross price", q => gbp(totals(linesOf(q.items)).total)]
  ];
  const cmpQuote = id => ({ ...job.quotes[id], items: quoteItems(id) });
  function openCompare() {
    const ids = quoteIds();
    if (ids.length < 2) { flash("Create another quote version to compare", false); return; }
    const other = ids.find(id => id !== job.current);
    cmp = new Set([job.current, other]);
    $("compareDiff").checked = false;
    $("compareError").textContent = "";
    renderCompare();
    show("compareModal");
  }
  function renderCompare() {
    const all = quoteIds();
    $("compareVers").innerHTML = all.map(id => `<label class="rp-chip ${cmp.has(id) ? "on" : ""}"><input type="checkbox" class="jt-chk" data-cmp="${id}" ${cmp.has(id) ? "checked" : ""}> ${id}</label>`).join("");
    const ids = all.filter(id => cmp.has(id));
    if (!ids.length) { $("compareTable").innerHTML = `<p class="iq-empty">Select quote versions to compare.</p>`; return; }
    const diffOnly = $("compareDiff").checked;
    const rows = COMPARE_ROWS.map(([label, fn]) => {
      const vals = ids.map(id => fn(cmpQuote(id)));
      return { label, vals, changed: vals.some(v => v !== vals[0]) };
    }).filter(r => !diffOnly || r.changed);
    $("compareTable").innerHTML = `<table class="qg cp-table">
      <colgroup><col style="width:150px">${ids.map(() => "<col>").join("")}</colgroup>
      <thead><tr><th>Comparison fields</th>${ids.map(id => `<th>${id}${id === job.current ? " (current)" : ""}</th>`).join("")}</tr></thead>
      <tbody>${rows.length ? rows.map(r => `<tr><td class="cp-lbl">${r.label}</td>${r.vals.map((v, i) => `<td class="${i && v !== r.vals[0] ? "cp-diff-cell" : ""}">${esc(v)}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${ids.length + 1}" class="iq-empty">No differences between the selected versions.</td></tr>`}</tbody>
    </table>`;
  }
  $("compareModal").addEventListener("change", e => {
    const id = e.target.dataset.cmp;
    if (id) e.target.checked ? cmp.add(id) : cmp.delete(id);
    $("compareError").textContent = "";
    renderCompare();
  });
  $("compareExport").addEventListener("click", () => {
    const ids = quoteIds().filter(id => cmp.has(id));
    if (!ids.length) { $("compareError").textContent = "Select at least one quote version"; return; }
    report.type = "Quotation";
    downloadPdf(ids.map(id => [id, cmpQuote(id)]), `${ref()}_quote_comparison.pdf`);
  });
  $("compareIQ").addEventListener("click", () => { hide("compareModal"); openIQ("rep"); });
})();
