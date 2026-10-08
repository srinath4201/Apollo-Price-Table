// BM Copilot: chat assistant that opens from "Ask BM Copilot" in the top bar (every page).
// Self-contained: injects css/bm-copilot.css and its own markup, and only reads page helpers when they exist
// (JobStore from js/job-store.js for job summaries, showToast from js/common.js for messages).
// Prototype: answers come from the sample data below and from saved jobs, not from a live AI service.
// To connect a real service, replace answer() — it returns { plan, blocks: [html], chips, note }.
// Storage (this browser only): chats "bm.copilot.chats.v1", layout "bm.copilot.layout", effort "bm.copilot.effort",
// feature ideas "bm.copilot.ideas.v1".
// Layout: side panel; Expand = full screen with the chat history sidebar.

(() => {
  const trigger = document.querySelector(".copilot");
  if (!trigger) return;

  // stylesheet next to this script: js/bm-copilot.js → css/bm-copilot.css
  const src = (document.currentScript && document.currentScript.src) || "js/bm-copilot.js";
  if (!document.querySelector("link[data-bmc]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = src.replace(/js\/bm-copilot\.js(\?.*)?$/, "css/bm-copilot.css");
    link.dataset.bmc = "";
    document.head.appendChild(link);
  }

  // ---------- helpers ----------
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const gbp = n => `£ ${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pad = n => String(n).padStart(2, "0");
  const today = new Date();
  const todayDMY = `${pad(today.getDate())}-${pad(today.getMonth() + 1)}-${today.getFullYear()}`;
  const todayLong = today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } };
  const notify = (title, message, type = "success") => {
    if (typeof showToast === "function") showToast({ title, message, type, duration: 4000 });
  };
  const jobLink = ref => `<a href="create-job.html?ref=${encodeURIComponent(ref)}">${esc(ref)}</a>`;
  const textOf = n => (n ? n.innerText || n.textContent || "" : "");
  // "account with highest job count." → "Account With Highest Job Count"
  const titleOf = text => {
    const t = text.trim().replace(/[.?!]+$/, "").replace(/\s+/g, " ");
    const short = t.length > 48 ? t.slice(0, 48).replace(/\s\S*$/, "") + "…" : t;
    return short.replace(/(^|\s)([a-z])/g, (m, s, c) => s + c.toUpperCase());
  };

  const I = {
    spark: (s = 20, c = "#5b6cf0") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/></svg>`,
    wand: (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#5b6cf0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20L15 9"/><path d="M13 7l4 4"/><path d="M8 3v3M6.5 4.5h3M19 3v3M17.5 4.5h3M19 13v3M17.5 14.5h3"/></svg>`,
    plus: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11"/></svg>`,
    expand: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></svg>`,
    collapse: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10h-6V4M14 10l7-7M4 14h6v6M10 14l-7 7"/></svg>`,
    history: (s = 18, c = "currentColor") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6l-2.5 2.5"/><path d="M3.5 4v4.5H8M12 7.5V12l3 2"/></svg>`,
    compose: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L12 14.8l-4 1 1-4z"/></svg>`,
    close: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>`,
    x: `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2 2l6 6M8 2L2 8"/></svg>`,
    search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555b66" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>`,
    page: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>`,
    mic: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>`,
    send: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>`,
    stop: `<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><rect width="12" height="12" rx="2.5" fill="#fff"/></svg>`,
    caret: `<svg width="9" height="6" viewBox="0 0 9 6" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M1 1l3.5 3.5L8 1"/></svg>`,
    chevR: `<svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="#555" stroke-width="1.6" aria-hidden="true"><path d="M1.5 1.5L6 6l-4.5 4.5"/></svg>`,
    back: `<svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6.5 1.5L2 6l4.5 4.5"/></svg>`,
    down: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5.5 12.5L12 19l6.5-6.5"/></svg>`,
    copy: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>`,
    check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>`,
    edit: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>`,
    speak: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>`,
    up: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11H3V10zM7 10l4-8a3 3 0 0 1 3 3v4h6a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.6 21H7"/></svg>`,
    downvote: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V3h4v11zM17 14l-4 8a3 3 0 0 1-3-3v-4H4a2 2 0 0 1-2-2.3l1.4-8A2 2 0 0 1 5.4 3H17"/></svg>`,
    retry: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6l2.5 2.5"/><path d="M20.5 3.5V8.5H15.5"/></svg>`,
    dots: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`,
    trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/></svg>`,
    // reasoning effort: ring filled a third / two thirds / full
    ring: level => { const len = [0, 15.7, 31.4, 47.1][level]; return `<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="#e3e5f0" stroke-width="2.4"/><circle cx="10" cy="10" r="7.5" fill="none" stroke="#f0b429" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${len} 47.1" transform="rotate(-90 10 10)"/></svg>`; }
  };

  // ---------- sample data (matches the All Job list) ----------
  const STATUS_COUNTS = [["Lead", 11], ["Agent Quote", 5], ["Invoiced", 4], ["Quote Rejected", 2], ["Order", 1], ["Partially paid", 1], ["Backorder", 1]];
  const OVERDUE = [["ON5484", "14-09-2026", "Lead"], ["ON5485", "15-09-2026", "Invoiced"], ["ON5487", "15-09-2026", "Invoiced"], ["ON5486", "17-09-2026", "Lead"],
    ["ON5489", "21-09-2026", "Agent Quote"], ["ON5492", "22-09-2026", "Lead"], ["ON5493", "22-09-2026", "Partially paid"], ["ORD5499", "23-09-2026", "Invoiced"]];
  const ACCOUNTS = [["Stella's Curtains And Blinds", 74], ["Special Blinds (2023)", 41], ["Nice Blinds", 18], ["Kensington Blinds", 9], ["Arena Interiors", 6], ["Taylor Home Living", 2]];
  const APPOINTMENTS = [
    ["09:30", "Measure & survey", "Mr & Mrs Taylor", "27 Orchard Way, Guildford", "ON5507", "Srinath"],
    ["11:00", "Fitting", "Raj", "14 Mill Lane, Woking", "ON5497", "Srinath"],
    ["14:00", "Showroom visit", "Hem", "Showroom", "ORD5500", "Priya"],
    ["16:30", "Call back", "John", "Phone", "ON5490", "Srinath"]
  ];
  const TASKS = [
    ["Follow up the Markilux quote versions with Mr & Mrs Taylor", "ON5507", "High"],
    ["Chase the remaining balance (partially paid)", "ON5493", "High"],
    ["Confirm production date for the order", "ORD5500", "Normal"],
    ["Check stock for the backordered fabric", "ON5490", "Normal"],
    ["Send the invoice reminder", "ON5487", "Low"]
  ];
  // last four months, the current one to date
  const MONTHS = [3, 2, 1, 0].map(back => {
    const d = new Date(today.getFullYear(), today.getMonth() - back, 1);
    return d.toLocaleDateString("en-GB", { month: "short" }) + (back === 0 ? " (to date)" : "");
  });
  const CREATED = [48, 51, 57, 9];
  const COMPLETED = [40, 44, 46, 6];
  const SUGGESTIONS = ["Jobs created vs completed monthly.", "Today's appointments.", "Today's tasks."];

  // ---------- page context ("+" → Use this page as context) ----------
  function pageContext() {
    const params = new URLSearchParams(location.search);
    const refInput = document.getElementById("jobRef");
    const ref = params.get("ref") || (refInput && refInput.value) || "";
    const page = (document.querySelector(".subhead h1") || {}).textContent || document.title;
    return { page: page.trim(), ref: ref.trim() };
  }

  // ---------- answers: { plan, blocks[], chips[], note } ----------
  const PILL = { "Lead": "blue", "Order": "green", "Invoiced": "green", "Quote Rejected": "pink", "Partially paid": "pink", "High": "pink", "Normal": "blue", "Issued": "blue", "Draft": "", "Customer Accepted": "green" };
  const pill = s => `<span class="bmc-pill ${PILL[s] || ""}">${esc(s)}</span>`;

  function chart() {
    const max = Math.ceil(Math.max(...CREATED, ...COMPLETED) / 20) * 20;
    const bar = (v, color, label, m) => `<div class="bmc-bar" tabindex="0" role="img" aria-label="${esc(m)}: ${v} ${label}" data-tip="<b>${esc(m)}</b><br>${label}: ${v}" style="height:${(v / max) * 100}%;background:${color}"><span>${v}</span></div>`;
    return `<div class="bmc-chart">
      <div class="bmc-chart-head"><b>Jobs created vs completed</b><span class="bmc-legend"><span><i style="background:#5b6cf0"></i>Created</span><span><i style="background:#6abf4b"></i>Completed</span></span></div>
      <div class="bmc-plot">${MONTHS.map((m, i) => `<div class="bmc-group">${bar(CREATED[i], "#5b6cf0", "Created", m)}${bar(COMPLETED[i], "#6abf4b", "Completed", m)}</div>`).join("")}</div>
      <div class="bmc-xlab">${MONTHS.map(m => `<span>${esc(m)}</span>`).join("")}</div>
    </div>`;
  }

  function jobSummary(ref) {
    const plan = `I'll pull up job ${ref} with its customer, quote versions and products.`;
    if (typeof JobStore === "undefined") {
      return { plan, blocks: [`<p>I can't read job data on this page. Open ${jobLink(ref)} or ask me from <a href="all-job.html">All Job</a>.</p>`] };
    }
    const job = JobStore.load(ref);
    if (!job) return { plan, blocks: [`<p>I couldn't find job <b>${esc(ref)}</b>.</p>`] };
    const c = job.contact || {};
    const name = [c.cTitle || c.title, c.cFirst || c.first, c.cLast || c.last].filter(Boolean).join(" ") || "No contact yet";
    const ids = Object.keys(job.quotes).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    const total = items => items.reduce((a, it) => a + Number(it.net || 0) + Number(it.vat || 0), 0);
    const cur = job.quotes[job.current] || job.quotes[ids[0]];
    return {
      plan,
      blocks: [
        `<p>Job ${jobLink(ref)} is for <b>${esc(name)}</b>${c.cTown || c.town ? ` in ${esc(c.cTown || c.town)}` : ""}. Status ${pill(job.status || "Lead")}, order ${esc(job.orderStatus || "not confirmed yet").toLowerCase()}.</p>`,
        `<h4>Quote versions</h4>`,
        `<table class="bmc-table"><thead><tr><th>Version</th><th>Status</th><th class="r">Products</th><th class="r">Total</th></tr></thead><tbody>${ids.map(id =>
          `<tr><td><b>${id}</b>${id === job.current ? " <span class=\"bmc-muted\">(current)</span>" : ""}</td><td>${pill(job.quotes[id].status)}</td><td class="r">${job.quotes[id].items.length}</td><td class="r">${gbp(total(job.quotes[id].items))}</td></tr>`).join("")}</tbody></table>`,
        `<h4>${esc(job.current)} products</h4>`,
        `<ul>${cur.items.map(it => `<li><b>${esc(it.product)}</b>: ${esc(it.description)}${(it.extras || []).length ? ` + ${esc(it.extras.map(x => x.name).join(", "))}` : ""}</li>`).join("") || "<li>No products yet</li>"}</ul>`,
        `<p>The current version totals <b>${gbp(total(cur.items))}</b> including VAT.${c.cEmail || c.email ? ` Customer email: ${esc(c.cEmail || c.email)}.` : ""}</p>`
      ],
      chips: [`Compare ${ids[0]} and ${ids[1] || ids[0]} for ${ref}`, "Today's tasks.", "Overdue jobs"],
      note: `Read ${ids.length} quote versions of ${ref} from the saved job.`
    };
  }

  function answer(prompt, ctx) {
    const q = prompt.toLowerCase();
    const refMatch = prompt.match(/\b(ON|ORD)\d{3,6}\b/i);
    const ref = refMatch ? refMatch[0].toUpperCase() : (/\b(this|current) (job|quote)\b/.test(q) && ctx && ctx.ref ? ctx.ref : "");

    if (/^(hi|hello|hey)\b/.test(q)) return { plan: "", blocks: [`<p>Hello! I can look up jobs, quotes, accounts, appointments and tasks. What would you like to know?</p>`], chips: ["Today's appointments.", "Today's tasks.", "Account with highest job count."] };
    if (/thank/.test(q)) return { plan: "", blocks: [`<p>You're welcome. Anything else?</p>`] };

    if (/compare/.test(q) && ref) {
      if (typeof JobStore === "undefined") return jobSummary(ref);
      const job = JobStore.load(ref);
      const ids = (prompt.match(/\bQ\d+\b/gi) || []).map(s => s.toUpperCase()).filter(id => job.quotes[id]);
      const pick = ids.length >= 2 ? ids.slice(0, 2) : Object.keys(job.quotes).slice(0, 2);
      const tot = id => job.quotes[id].items.reduce((a, it) => a + Number(it.net || 0) + Number(it.vat || 0), 0);
      const [a, b] = pick;
      const diff = tot(b) - tot(a);
      return {
        plan: `I'll compare the status, products and totals of ${a} and ${b} on ${ref}.`,
        blocks: [
          `<table class="bmc-table"><thead><tr><th></th><th>${a}</th><th>${b}</th></tr></thead><tbody>
            <tr><td>Status</td><td>${pill(job.quotes[a].status)}</td><td>${pill(job.quotes[b].status)}</td></tr>
            <tr><td>Products</td><td>${esc(job.quotes[a].items.map(i => i.product).join(", ") || "–")}</td><td>${esc(job.quotes[b].items.map(i => i.product).join(", ") || "–")}</td></tr>
            <tr><td>Total</td><td class="r">${gbp(tot(a))}</td><td class="r">${gbp(tot(b))}</td></tr></tbody></table>`,
          `<p>${b} is <b>${gbp(Math.abs(diff))} ${diff >= 0 ? "more" : "less"}</b> than ${a} on ${jobLink(ref)}. Use <b>⋯ → Compare quote version</b> in the job to see every field side by side.</p>`
        ],
        note: `Compared the totals and products of ${a} and ${b}.`
      };
    }
    if (ref) return jobSummary(ref);

    if (/account|customer/.test(q)) {
      const [top, second] = ACCOUNTS;
      return {
        plan: "I'll show the accounts ranked by their number of active jobs, with the highest counts first.",
        blocks: [
          `<p>The account with the highest number of jobs is <b>${esc(top[0])}</b>, with <b>${top[1]} jobs</b>. This clearly leads the pack among all accounts based on job count.</p>`,
          `<p>Looking at the data, ${esc(top[0])} has significantly more jobs than the second-highest account, ${esc(second[0])}, which has <b>${second[1]} jobs</b>. Many other accounts have substantially fewer entries, often just 1 or <b>2 jobs</b> each.</p>`,
          `<table class="bmc-table"><thead><tr><th>Account</th><th class="r">Jobs</th></tr></thead><tbody>${ACCOUNTS.map(([n, j]) => `<tr><td>${esc(n)}</td><td class="r">${j}</td></tr>`).join("")}</tbody></table>`,
          `<p>If you'd like, I can provide further details on these accounts or help with a specific region or period. Happy to assist with any deeper analysis you need.</p>`
        ],
        chips: ["Job status overview", "Jobs created vs completed monthly."],
        note: `Counted active jobs per account across ${ACCOUNTS.length} accounts (sample data).`
      };
    }
    if (/created|completed|monthly|month/.test(q)) {
      const rate = Math.round(COMPLETED.slice(0, 3).reduce((x, y) => x + y) / CREATED.slice(0, 3).reduce((x, y) => x + y) * 100);
      const best = MONTHS[CREATED.indexOf(Math.max(...CREATED))];
      return {
        plan: "I'll compare the jobs created and completed in each of the last four months.",
        blocks: [
          `<p>Here's how jobs created compare with jobs completed over the last four months.</p>`,
          chart(),
          `<table class="bmc-table"><thead><tr><th>Month</th><th class="r">Created</th><th class="r">Completed</th><th class="r">Completion</th></tr></thead><tbody>${MONTHS.map((m, i) =>
            `<tr><td>${esc(m)}</td><td class="r">${CREATED[i]}</td><td class="r">${COMPLETED[i]}</td><td class="r">${Math.round(COMPLETED[i] / CREATED[i] * 100)}%</td></tr>`).join("")}</tbody></table>`,
          `<p><b>${best}</b> had the most new jobs. Across the last three full months <b>${rate}%</b> of created jobs were completed, so the open backlog grew by ${CREATED.slice(0, 3).reduce((x, y) => x + y) - COMPLETED.slice(0, 3).reduce((x, y) => x + y)} jobs.</p>`
        ],
        chips: ["Overdue jobs", "Job status overview", "Today's tasks."],
        note: "Counted jobs by created date and completed date (sample data)."
      };
    }
    if (/appointment|calendar|schedule|visit/.test(q)) return {
      plan: "I'll list today's appointments in time order with the customer and job.",
      blocks: [
        `<p>You have <b>${APPOINTMENTS.length} appointments</b> today, ${esc(todayLong)}.</p>`,
        `<table class="bmc-table"><thead><tr><th>Time</th><th>Appointment</th><th>Customer</th><th>Job</th></tr></thead><tbody>${APPOINTMENTS.map(([t, type, who, where, ref, rep]) =>
          `<tr><td><b>${t}</b></td><td>${esc(type)}<br><span class="bmc-muted">${esc(where)} · ${esc(rep)}</span></td><td>${esc(who)}</td><td>${jobLink(ref)}</td></tr>`).join("")}</tbody></table>`,
        `<p>The first one is the <b>${esc(APPOINTMENTS[0][1].toLowerCase())}</b> with ${esc(APPOINTMENTS[0][2])} at ${APPOINTMENTS[0][0]}.</p>`
      ],
      chips: ["Summarise ON5507", "Today's tasks."],
      note: `Read today's calendar (${todayDMY}).`
    };
    if (/task|to.?do/.test(q)) return {
      plan: "I'll list the tasks due today, highest priority first.",
      blocks: [
        `<p>You have <b>${TASKS.length} tasks</b> due today.</p>`,
        `<ul class="bmc-tasks">${TASKS.map(([t, ref, p]) => `<li>${esc(t)} · ${jobLink(ref)} ${pill(p)}</li>`).join("")}</ul>`
      ],
      chips: ["Overdue jobs", "Today's appointments."],
      note: `Filtered tasks due ${todayDMY}.`
    };
    if (/overdue|late|past due/.test(q)) return {
      plan: "I'll find the jobs that are past their due date.",
      blocks: [
        `<p><b>${OVERDUE.length} jobs</b> are past their due date.</p>`,
        `<table class="bmc-table"><thead><tr><th>Job</th><th>Due</th><th>Status</th></tr></thead><tbody>${OVERDUE.map(([ref, due, st]) => `<tr><td>${jobLink(ref)}</td><td>${due}</td><td>${pill(st)}</td></tr>`).join("")}</tbody></table>`,
        `<p>${OVERDUE.filter(o => o[2] === "Lead").length} of them are still leads, so a follow-up call is the quickest win.</p>`
      ],
      chips: ["Job status overview", "Today's tasks."]
    };
    if (/status|overview|pipeline|how many|summar/.test(q)) {
      const total = STATUS_COUNTS.reduce((a, [, n]) => a + n, 0);
      return {
        plan: "I'll group all jobs by their job status.",
        blocks: [
          `<p>There are <b>${total} jobs</b> on All Job. By status:</p>`,
          `<table class="bmc-table"><thead><tr><th>Job status</th><th class="r">Jobs</th><th class="r">Share</th></tr></thead><tbody>${STATUS_COUNTS.map(([s, n]) => `<tr><td>${pill(s)}</td><td class="r">${n}</td><td class="r">${Math.round(n / total * 100)}%</td></tr>`).join("")}</tbody></table>`,
          `<p>Leads are the largest group (${STATUS_COUNTS[0][1]}). ${OVERDUE.length} jobs are overdue.</p>`
        ],
        chips: ["Overdue jobs", "Jobs created vs completed monthly."]
      };
    }
    if (/quot|interactive|pdf|email/.test(q)) return {
      plan: "I'll walk you through sending a quotation from a job.",
      blocks: [
        `<p>To send a quotation from a job:</p>`,
        `<ol><li>Open the job and click <b>Select Report → Quotation</b>.</li><li>Choose <b>Standard</b> (pick quote versions, then preview, print or save the PDF) or <b>Interactive</b> (pick products and optional extras across versions).</li><li>Click <b>Send</b>, choose the format and complete the <b>Email Options</b>.</li><li>The customer opens <b>View quotation</b>, chooses and accepts. That creates a new <b>Customer Accepted</b> version.</li></ol>`,
        `<p>Try it on ${jobLink("ON5507")} (Markilux awnings, 4 quote versions).</p>`
      ],
      chips: ["Summarise ON5507"]
    };
    return {
      plan: "",
      blocks: [`<p>I don't have an answer for "${esc(prompt.length > 80 ? prompt.slice(0, 80) + "…" : prompt)}" yet. In this preview I can help with jobs, quote versions, accounts, appointments and tasks.</p>`],
      chips: ["Account with highest job count.", "Summarise ON5507", "Overdue jobs"]
    };
  }

  // ---------- markup ----------
  // no dark overlay: the chat sits beside the page and the page stays usable
  const panel = document.createElement("aside");
  panel.className = "bmc bmc-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", "bmcTitle");
  panel.innerHTML = `
    <header class="bmc-head">
      ${I.spark(22)}
      <h2 id="bmcTitle">BM Copilot</h2><span class="bmc-beta">New</span>
      <span class="bmc-spacer"></span>
      <button type="button" class="bmc-ib" data-act="expand" title="Full screen" aria-pressed="false">${I.expand}</button>
      <button type="button" class="bmc-ib" data-act="history" title="Chat history" aria-pressed="false">${I.history()}<span class="bmc-count" data-count>0</span></button>
      <button type="button" class="bmc-ib" data-act="new" title="New chat">${I.compose}</button>
      <button type="button" class="bmc-ib" data-act="close" title="Close">${I.close}</button>
    </header>
    <div class="bmc-main">
      <nav class="bmc-side" data-side aria-label="Chat history" hidden>
        <div class="bmc-side-head">${I.history(20, "#5b6cf0")}<b>Chat history</b><span class="bmc-side-count" data-side-count>0</span><span class="bmc-spacer"></span>
          <button type="button" class="bmc-ib" data-act="side-close" title="Close chat history">${I.close}</button></div>
        <label class="bmc-side-search">${I.search}<input type="search" data-search placeholder="Search conversations..." aria-label="Search conversations" autocomplete="off"></label>
        <div class="bmc-side-list" data-list></div>
        <div class="bmc-menu bmc-item-menu" data-item-menu role="menu" hidden>
          <button type="button" role="menuitem" data-act="rename">${I.edit}Rename</button>
          <button type="button" role="menuitem" data-act="delete" class="danger">${I.trash}Delete</button>
        </div>
      </nav>
      <div class="bmc-col" data-col>
        <div class="bmc-body" data-body></div>
        <footer class="bmc-foot" data-foot>
          <button type="button" class="bmc-down" data-act="to-latest" title="Scroll to latest" aria-label="Scroll to latest message" hidden>${I.down}</button>
          <div class="bmc-foot-in">
            <form class="bmc-box" data-form>
              <textarea class="bmc-input" data-input rows="1" placeholder="Ask anything about BlindMatrix..." aria-label="Message BM Copilot"></textarea>
              <div class="bmc-box-row">
                <div class="bmc-pop">
                  <button type="button" class="bmc-ib bmc-round" data-act="plus" title="Add context" aria-haspopup="menu" aria-expanded="false">${I.plus}</button>
                  <div class="bmc-menu bmc-plus-menu" data-plus-menu role="menu" hidden>
                    <button type="button" role="menuitemcheckbox" data-act="context" aria-checked="false">${I.page}<span><b>Use this page as context</b><small data-ctx-page></small></span></button>
                  </div>
                </div>
                <div class="bmc-ctx" data-ctx hidden></div>
                <span class="bmc-spacer"></span>
                <div class="bmc-pop">
                  <button type="button" class="bmc-effort-btn" data-act="effort" aria-haspopup="menu" aria-expanded="false" title="Reasoning effort"><span data-ring></span><span data-effort-label>Low</span>${I.caret}</button>
                  <div class="bmc-menu bmc-effort-menu" data-effort-menu role="menu" hidden>
                    <button type="button" role="menuitemradio" data-effort="1"><span><b>Low</b><small>Fastest answers</small></span></button>
                    <button type="button" role="menuitemradio" data-effort="2"><span><b>Medium</b><small>Balanced</small></span></button>
                    <button type="button" role="menuitemradio" data-effort="3"><span><b>High</b><small>Thinks longer, shows its working</small></span></button>
                  </div>
                </div>
                <button type="button" class="bmc-ib bmc-mic" data-act="mic" title="Voice input">${I.mic}</button>
                <button type="submit" class="bmc-send" data-send title="Send" aria-label="Send" disabled>${I.send}</button>
              </div>
            </form>
          </div>
        </footer>
        <div class="bmc-after" data-after hidden></div>
        <p class="bmc-disclaimer">BM Copilot can make mistakes. Verify important info.</p>
      </div>
    </div>
    <div class="bmc-sr" data-live aria-live="polite"></div>`;
  document.body.appendChild(panel);
  const tip = document.createElement("div");
  tip.className = "bmc-tip";
  tip.hidden = true;
  document.body.appendChild(tip);

  const q = sel => panel.querySelector(sel);
  const col = q("[data-col]"), body = q("[data-body]"), foot = q("[data-foot]"), after = q("[data-after]");
  const form = q("[data-form]"), input = q("[data-input]"), sendBtn = q("[data-send]"), downBtn = q('[data-act="to-latest"]');
  const side = q("[data-side]"), list = q("[data-list]"), search = q("[data-search]"), itemMenu = q("[data-item-menu]");
  const ctxBar = q("[data-ctx]"), effortMenu = q("[data-effort-menu]"), plusMenu = q("[data-plus-menu]"), live = q("[data-live]");

  trigger.setAttribute("role", "button");
  trigger.setAttribute("tabindex", "0");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");

  // ---------- state ----------
  const STORE = "bm.copilot.chats.v1";
  let chats = read(STORE, []);
  let chat = null;            // the open conversation, or null for a new one
  let view = "chat";          // chat | suggest
  let effort = Number(read("bm.copilot.effort", 1)) || 1;
  let ctx = null;             // attached page context
  let run = null;             // the answer being written: { stop() }
  let menuFor = null;         // chat id the ⋯ menu belongs to
  const layout = Object.assign({ full: false, side: true }, read("bm.copilot.layout", {}));

  const updateCounts = () => { q("[data-count]").textContent = chats.length; q("[data-side-count]").textContent = chats.length; };
  const saveChats = () => { chats = chats.slice(0, 50); write(STORE, chats); updateCounts(); renderList(); };
  updateCounts();

  // ---------- menus (+, effort, chat ⋯) ----------
  const MENUS = () => [[plusMenu, q('[data-act="plus"]')], [effortMenu, q('[data-act="effort"]')], [itemMenu, null]];
  function closeMenus() {
    MENUS().forEach(([m, b]) => { m.hidden = true; if (b) b.setAttribute("aria-expanded", "false"); });
    menuFor = null;
  }
  function toggleMenu(menu, btn) {
    const opening = menu.hidden;
    closeMenus();
    menu.hidden = !opening;
    btn.setAttribute("aria-expanded", String(opening));
    if (opening) (menu.querySelector('[aria-checked="true"]') || menu.querySelector("button")).focus();
  }
  document.addEventListener("click", e => { if (!e.target.closest(".bmc-pop, .bmc-item-more, [data-item-menu]")) closeMenus(); });

  // ---------- layout: side panel ↔ full screen with history sidebar ----------
  function applyLayout() {
    panel.classList.toggle("full", layout.full);
    const showSide = layout.full && layout.side;
    side.hidden = !showSide;
    const ex = q('[data-act="expand"]');
    ex.innerHTML = layout.full ? I.collapse : I.expand;
    ex.title = layout.full ? "Exit full screen" : "Full screen";
    ex.setAttribute("aria-pressed", String(layout.full));
    const hb = q('[data-act="history"]');
    hb.classList.toggle("on", showSide);
    hb.setAttribute("aria-pressed", String(showSide));
    write("bm.copilot.layout", layout);
    renderList();
    if (!panel.hidden && (!chat || !chat.messages.length)) render(); // the welcome screen differs per layout
  }

  // ---------- open / close ----------
  // instant = reopened after following a link in the chat: shown straight away, no slide-in
  function open({ instant = false } = {}) {
    panel.hidden = false;
    applyLayout();
    render();
    if (instant) {
      panel.classList.add("bmc-instant", "show");
      requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.remove("bmc-instant")));
    } else {
      requestAnimationFrame(() => panel.classList.add("show"));
    }
    trigger.classList.add("bmc-on");
    trigger.setAttribute("aria-expanded", "true");
    setTimeout(() => (view === "chat" ? input : panel.querySelector("button")).focus({ preventScroll: true }), 60);
  }
  function close() {
    if (run) run.stop();
    stopSpeaking();
    closeMenus();
    panel.classList.remove("show");
    trigger.classList.remove("bmc-on");
    trigger.setAttribute("aria-expanded", "false");
    hideTip();
    setTimeout(() => { if (!panel.classList.contains("show")) panel.hidden = true; }, 220);
    trigger.focus();
  }
  const isOpen = () => !panel.hidden && panel.classList.contains("show");
  trigger.addEventListener("click", () => (isOpen() ? close() : open()));
  trigger.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); trigger.click(); } });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !isOpen()) return;
    const openMenu = MENUS().find(([m]) => !m.hidden);
    if (openMenu) { closeMenus(); if (openMenu[1]) openMenu[1].focus(); return; }
    if (e.target.closest && e.target.closest(".bmc-rename, .bmc-edit")) return; // handled by the field itself
    if (layout.full) { layout.full = false; applyLayout(); return; } // Esc leaves full screen first
    close();
  });

  // ---------- rendering ----------
  const isEmpty = () => view === "chat" && (!chat || !chat.messages.length);
  function render() {
    foot.hidden = view !== "chat";
    col.classList.toggle("is-empty", isEmpty());
    after.hidden = true;
    after.innerHTML = "";
    if (view === "suggest") return renderSuggest();
    if (isEmpty()) return renderWelcome();
    body.innerHTML = `<div class="bmc-wrap bmc-thread" data-thread></div>`;
    const thread = q("[data-thread]");
    const lastAi = chat.messages.map(m => m.role).lastIndexOf("ai");
    chat.messages.forEach((m, i) => thread.appendChild(m.role === "user" ? userEl(m, i) : aiEl(m, i, i === lastAi)));
    body.scrollTop = body.scrollHeight;
    syncDown();
  }

  function renderWelcome() {
    const hero = `<div class="bmc-hero">
        <span class="bmc-hero-ic">${I.spark(30)}</span>
        <h3>What can I help with?</h3>
        <p>BM Copilot is using data from job, account, appointments and task. Ask me to analyze, summarize, or predict.</p>
      </div>`;
    const feature = `<button type="button" class="bmc-sug bmc-feature" data-act="suggest"><span class="bmc-fic">${I.spark(16)}</span><span>Suggest a BM Copilot feature<small>Share an idea for BM Copilot</small></span>${I.chevR}</button>`;
    // side panel and full screen alike: greeting and composer in the middle, suggestions underneath
    body.innerHTML = `<div class="bmc-wrap bmc-empty">${hero}</div>`;
    after.innerHTML = `<div class="bmc-wrap bmc-try-full">
      <div class="bmc-chiprow">${[...SUGGESTIONS, "Account with highest job count."].map(s => `<button type="button" class="bmc-sugchip" data-ask="${esc(s)}">${I.wand(16)}<span>${esc(s)}</span></button>`).join("")}</div>
      ${feature}</div>`;
    after.hidden = false;
  }

  // history sidebar, grouped by date
  function groupOf(t) {
    const d = new Date(t), start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const day = 86400000;
    if (d >= start) return "Today";
    if (d >= start - day) return "Yesterday";
    if (d >= start - 7 * day) return "Previous 7 days";
    if (d >= start - 30 * day) return "Previous 30 days";
    return "Older";
  }
  function renderList() {
    if (side.hidden) return;
    const term = search.value.trim().toLowerCase();
    const hits = chats.filter(c => !term || c.title.toLowerCase().includes(term) ||
      c.messages.some(m => m.role === "user" && m.text.toLowerCase().includes(term)));
    if (!hits.length) { list.innerHTML = `<p class="bmc-none">${term ? "No conversations match your search." : "No conversations yet. Ask BM Copilot something to start one."}</p>`; return; }
    const groups = [];
    hits.forEach(c => { const g = groupOf(c.updated); const last = groups[groups.length - 1]; if (last && last.name === g) last.items.push(c); else groups.push({ name: g, items: [c] }); });
    list.innerHTML = groups.map(g => `<div class="bmc-group-label">${g.name}</div>` + g.items.map(c => {
      const cur = chat && chat.id === c.id;
      return `<div class="bmc-item ${cur ? "current" : ""}" data-id="${esc(c.id)}">
        <button type="button" class="bmc-item-open" data-open="${esc(c.id)}" title="${esc(c.title)}"${cur ? ' aria-current="true"' : ""}>${esc(c.title)}</button>
        <button type="button" class="bmc-ib bmc-item-more" data-more="${esc(c.id)}" title="More options" aria-haspopup="menu" aria-label="More options for ${esc(c.title)}">${I.dots}</button>
      </div>`;
    }).join("")).join("");
  }
  search.addEventListener("input", renderList);

  function renderSuggest(sent) {
    body.innerHTML = `<div class="bmc-wrap bmc-view">
      <button type="button" class="bmc-back" data-act="back">${I.back} Back to chat</button>
      <h3>Suggest a BM Copilot feature</h3>
      ${sent ? `<p class="bmc-hint">Thanks! Your idea has been saved for the BM Copilot team.</p><div class="bmc-row" style="justify-content:flex-start"><button type="button" class="bmc-btn primary" data-act="back">Back to chat</button></div>`
        : `<p class="bmc-hint">What should BM Copilot do for you? For example "Draft a follow-up email for quotes not accepted after 7 days".</p>
          <textarea class="bmc-field" data-idea aria-label="Your idea" maxlength="1000"></textarea>
          <div class="bmc-row"><button type="button" class="bmc-btn ghost" data-act="back">Cancel</button><button type="button" class="bmc-btn primary" data-act="submit-idea" disabled>Submit idea</button></div>`}
    </div>`;
    const idea = q("[data-idea]");
    if (idea) { idea.addEventListener("input", () => { q('[data-act="submit-idea"]').disabled = !idea.value.trim(); }); idea.focus(); }
  }

  // ---------- message elements ----------
  function userEl(m, index) {
    const d = document.createElement("div");
    d.className = "bmc-msg-user";
    d.dataset.index = index;
    d.innerHTML = `<div class="bmc-bubble"></div>
      <div class="bmc-actions">
        <button type="button" class="bmc-ib" data-act="copy" title="Copy" aria-label="Copy message">${I.copy}</button>
        <button type="button" class="bmc-ib" data-act="edit" title="Edit" aria-label="Edit message">${I.edit}</button>
      </div>`;
    d.firstElementChild.textContent = m.text;
    return d;
  }
  const thinkHtml = m => (m.plan || m.note)
    ? `<details class="bmc-think"><summary>Thought for ${(m.secs || 0.6).toFixed(1)}s</summary><div class="bmc-think-body">${m.plan ? `<p>${esc(m.plan)}</p>` : ""}${m.note ? `<p>${esc(m.note)}</p>` : ""}</div></details>` : "";
  function aiActions(m, isLast) {
    return `<div class="bmc-actions">
      <button type="button" class="bmc-ib" data-act="copy" title="Copy" aria-label="Copy answer">${I.copy}</button>
      <button type="button" class="bmc-ib" data-act="speak" title="Read aloud" aria-pressed="false">${I.speak}</button>
      <button type="button" class="bmc-ib ${m.rating === "up" ? "on" : ""}" data-act="up" title="Good response" aria-pressed="${m.rating === "up"}">${I.up}</button>
      <button type="button" class="bmc-ib ${m.rating === "down" ? "on" : ""}" data-act="down" title="Bad response" aria-pressed="${m.rating === "down"}">${I.downvote}</button>
      ${isLast ? `<button type="button" class="bmc-ib" data-act="retry" title="Regenerate">${I.retry}</button>` : ""}
    </div>${isLast && m.chips && m.chips.length ? `<div class="bmc-chips">${m.chips.map(c => `<button type="button" class="bmc-chip" data-ask="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}`;
  }
  function aiEl(m, index, isLast) {
    const d = document.createElement("div");
    d.className = "bmc-msg-ai" + (isLast ? " is-last" : "");
    d.dataset.index = index;
    d.innerHTML = `<span class="bmc-mark">${I.spark(16)}</span><div class="bmc-ai-col">${thinkHtml(m)}<div class="bmc-ai-body">${m.html || ""}</div>${aiActions(m, isLast)}</div>`;
    return d;
  }

  // ---------- scrolling ----------
  const nearBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < 80;
  const syncDown = () => { downBtn.hidden = isEmpty() || view !== "chat" || nearBottom(); };
  body.addEventListener("scroll", () => { syncDown(); hideTip(); });

  // ---------- asking + streaming ----------
  function ask(text, { skipUser = false } = {}) {
    text = text.trim();
    if (!text || run) return;
    closeMenus();
    view = "chat";
    if (!chat) {
      chat = { id: "c" + Date.now(), title: titleOf(text), updated: Date.now(), messages: [] };
      chats.unshift(chat);
    } else {
      chats = [chat, ...chats.filter(c => c.id !== chat.id)];
    }
    if (!skipUser) chat.messages.push({ role: "user", text });
    chat.updated = Date.now();
    saveChats();
    render();

    const thread = q("[data-thread]");
    thread.querySelectorAll(".bmc-msg-ai.is-last").forEach(el => { el.classList.remove("is-last"); el.querySelector('[data-act="retry"]')?.remove(); el.querySelector(".bmc-chips")?.remove(); });
    const res = answer(text, ctx || pageContext());
    const wait = [700, 1300, 2100][effort - 1];
    const ai = { role: "ai", prompt: text, plan: res.plan || "", note: effort === 3 ? res.note || "" : "", html: "", secs: wait / 1000 };
    const index = chat.messages.push(ai) - 1;
    const el = document.createElement("div");
    el.className = "bmc-msg-ai is-last is-busy";
    el.dataset.index = index;
    el.innerHTML = `<span class="bmc-mark">${I.spark(16)}</span><div class="bmc-ai-col"><div class="bmc-thinking" role="status">Preparing your response…</div><div class="bmc-ai-body" aria-busy="true"></div></div>`;
    thread.appendChild(el);
    body.scrollTop = body.scrollHeight;
    const out = el.querySelector(".bmc-ai-body");
    const colEl = el.querySelector(".bmc-ai-col");

    const timers = [];
    let stopped = false;
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const caret = document.createElement("span");
    caret.className = "bmc-caret";
    const stick = fn => { const was = nearBottom(); fn(); if (was) body.scrollTop = body.scrollHeight; syncDown(); };

    const finish = () => {
      caret.remove();
      out.querySelectorAll("[data-pending]").forEach(n => n.remove());
      out.querySelectorAll(".bmc-fade").forEach(n => n.classList.remove("bmc-fade"));
      el.querySelector(".bmc-thinking")?.remove();
      if (stopped) out.insertAdjacentHTML("beforeend", `<p class="bmc-muted">Stopped.</p>`);
      out.removeAttribute("aria-busy");
      el.classList.remove("is-busy");
      ai.html = out.innerHTML;
      ai.chips = stopped ? [] : res.chips || [];
      chat.updated = Date.now();
      saveChats();
      colEl.insertAdjacentHTML("beforeend", aiActions(ai, true));
      run = null;
      setBusy(false);
      live.textContent = stopped ? "Response stopped." : "BM Copilot answered.";
      stick(() => {});
    };
    run = { stop() { if (stopped) return; stopped = true; timers.forEach(clearTimeout); finish(); } };
    setBusy(true);

    // stream the blocks: text word by word with a caret, tables and charts fade in whole
    const wordsPerTick = effort === 1 ? 3 : 2;
    const streamBlock = (html, done) => {
      const holder = document.createElement("div");
      holder.innerHTML = html;
      const nodes = [...holder.children];
      const rich = nodes.some(n => n.matches("table, .bmc-chart") || n.querySelector("table, .bmc-chart"));
      if (rich) {
        nodes.forEach(n => n.classList.add("bmc-fade"));
        stick(() => nodes.forEach(n => out.appendChild(n))); // measure "near bottom" before the block adds its height
        later(done, 220);
        return;
      }
      nodes.forEach(n => out.appendChild(n)); // text blocks start hidden (data-pending) so adding them changes nothing yet
      const texts = [];
      nodes.forEach(n => {
        const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
        for (let t = walker.nextNode(); t; t = walker.nextNode()) { texts.push({ node: t, parts: t.data.split(/(\s+)/), shown: 0 }); t.data = ""; }
        [n, ...n.querySelectorAll("p, li, h4")].forEach(x => x.setAttribute("data-pending", ""));
      });
      let k = 0;
      const tick = () => {
        if (stopped) return;
        const cur = texts[k];
        if (!cur) { caret.remove(); return done(); }
        for (let p = cur.node.parentElement; p && p !== out; p = p.parentElement) p.removeAttribute("data-pending");
        stick(() => {
          cur.shown = Math.min(cur.parts.length, cur.shown + wordsPerTick * 2);
          cur.node.data = cur.parts.slice(0, cur.shown).join("");
          cur.node.after(caret);
        });
        if (cur.shown >= cur.parts.length) k++;
        later(tick, 28);
      };
      tick();
    };

    later(() => {
      el.querySelector(".bmc-thinking").outerHTML = thinkHtml(ai);
      let i = 0;
      const next = () => { if (stopped) return; if (i >= res.blocks.length) return finish(); streamBlock(res.blocks[i++], next); };
      next();
    }, wait);
  }

  function setBusy(busy) {
    sendBtn.innerHTML = busy ? I.stop : I.send;
    sendBtn.title = busy ? "Stop" : "Send";
    sendBtn.setAttribute("aria-label", sendBtn.title);
    sendBtn.classList.toggle("is-stop", busy);
    sendBtn.disabled = busy ? false : !input.value.trim();
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (run) { run.stop(); return; }
    const text = input.value;
    if (!text.trim()) return;
    input.value = "";
    grow();
    ask(text);
  });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!run) form.requestSubmit(); }
  });
  form.addEventListener("click", e => { if (e.target === form || e.target.classList.contains("bmc-box-row") || e.target.classList.contains("bmc-spacer")) input.focus(); });
  const grow = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 180) + "px"; if (!run) sendBtn.disabled = !input.value.trim(); };
  input.addEventListener("input", grow);

  // ---------- effort ----------
  const EFFORT = ["", "Low", "Medium", "High"];
  function showEffort() {
    q("[data-ring]").innerHTML = I.ring(effort);
    q("[data-effort-label]").textContent = EFFORT[effort];
    effortMenu.querySelectorAll("[data-effort]").forEach(b => b.setAttribute("aria-checked", String(Number(b.dataset.effort) === effort)));
  }
  effortMenu.addEventListener("click", e => {
    const b = e.target.closest("[data-effort]");
    if (!b) return;
    effort = Number(b.dataset.effort);
    write("bm.copilot.effort", effort);
    showEffort();
    closeMenus();
    input.focus();
  });
  showEffort();

  // ---------- page context chip ----------
  function showCtx() {
    const item = q('[data-act="context"]');
    item.setAttribute("aria-checked", String(!!ctx));
    q('[data-act="plus"]').classList.toggle("on", !!ctx);
    ctxBar.hidden = !ctx;
    ctxBar.innerHTML = ctx ? `<span>${I.page}${esc(ctx.page)}${ctx.ref ? " · " + esc(ctx.ref) : ""}<button type="button" data-act="ctx-remove" title="Remove context" aria-label="Remove page context">${I.x}</button></span>` : "";
  }

  // ---------- voice in / read aloud ----------
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  function toggleMic(btn) {
    if (!Speech) { notify("Voice input", "Voice input isn't supported in this browser.", "error"); return; }
    if (rec) { rec.stop(); return; }
    rec = new Speech();
    rec.lang = "en-GB";
    rec.interimResults = true;
    const start = input.value ? input.value + " " : "";
    rec.onresult = e => { input.value = start + [...e.results].map(r => r[0].transcript).join(""); grow(); };
    rec.onend = () => { rec = null; btn.classList.remove("listening"); btn.title = "Voice input"; input.focus(); };
    rec.onerror = () => notify("Voice input", "Couldn't hear anything. Check microphone access.", "error");
    btn.classList.add("listening");
    btn.title = "Stop listening";
    rec.start();
  }
  let speakingBtn = null;
  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (speakingBtn) { speakingBtn.classList.remove("on"); speakingBtn.setAttribute("aria-pressed", "false"); speakingBtn.title = "Read aloud"; speakingBtn = null; }
  }
  function speak(btn, text) {
    const was = speakingBtn === btn;
    stopSpeaking();
    if (was) return;
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") { notify("Read aloud", "Read aloud isn't supported in this browser.", "error"); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.onend = u.onerror = () => { if (speakingBtn === btn) stopSpeaking(); };
    speakingBtn = btn;
    btn.classList.add("on");
    btn.setAttribute("aria-pressed", "true");
    btn.title = "Stop reading";
    window.speechSynthesis.speak(u);
  }
  function copied(btn) {
    btn.innerHTML = I.check;
    btn.title = "Copied";
    btn.classList.add("ok");
    setTimeout(() => { btn.innerHTML = I.copy; btn.title = "Copy"; btn.classList.remove("ok"); }, 1500);
  }

  // ---------- edit a sent message (re-asks from there) ----------
  function startEdit(msgEl, index) {
    const m = chat.messages[index];
    msgEl.classList.add("editing");
    msgEl.innerHTML = `<div class="bmc-edit"><textarea class="bmc-input" aria-label="Edit message"></textarea>
      <div class="bmc-row"><button type="button" class="bmc-btn ghost" data-act="edit-cancel">Cancel</button><button type="button" class="bmc-btn primary" data-act="edit-send">Send</button></div></div>`;
    const ta = msgEl.querySelector("textarea");
    ta.value = m.text;
    const fit = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 220) + "px"; };
    ta.addEventListener("input", fit);
    ta.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); render(); }
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); msgEl.querySelector('[data-act="edit-send"]').click(); }
    });
    fit();
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  // ---------- rename a chat (sidebar) ----------
  function startRename(id) {
    const row = [...list.querySelectorAll(".bmc-item")].find(r => r.dataset.id === id);
    const c = chats.find(x => x.id === id);
    if (!row || !c) return;
    row.innerHTML = `<input class="bmc-rename" aria-label="Chat name" maxlength="80">`;
    const field = row.firstElementChild;
    field.value = c.title;
    let done = false;
    const end = save => {
      if (done) return;
      done = true;
      if (save && field.value.trim()) c.title = field.value.trim();
      saveChats();
    };
    field.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); end(true); }
      if (e.key === "Escape") { e.preventDefault(); end(false); }
    });
    field.addEventListener("blur", () => end(true));
    field.focus();
    field.select();
  }

  // ---------- clicks inside the panel ----------
  function openChat(id) {
    if (run) run.stop();
    chat = chats.find(c => c.id === id) || null;
    view = "chat";
    render();
    renderList();
    if (window.innerWidth <= 760) { layout.side = false; applyLayout(); } // the sidebar overlays the chat on small screens
    input.focus();
  }
  function newChat() { if (run) run.stop(); chat = null; view = "chat"; render(); renderList(); input.focus(); }

  panel.addEventListener("click", e => {
    // a link inside an answer (e.g. a job number) opens that page with this chat still open
    const link = e.target.closest(".bmc-ai-body a[href]");
    if (link) {
      if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) keepOpenAfterLoad(link);
      return;
    }
    const askBtn = e.target.closest("[data-ask]");
    if (askBtn) { ask(askBtn.dataset.ask); return; }
    const openBtn = e.target.closest("[data-open]");
    if (openBtn) { openChat(openBtn.dataset.open); return; }
    const moreBtn = e.target.closest("[data-more]");
    if (moreBtn) {
      const id = moreBtn.dataset.more;
      const was = menuFor === id && !itemMenu.hidden;
      closeMenus();
      if (was) return;
      menuFor = id;
      const r = moreBtn.getBoundingClientRect(), s = side.getBoundingClientRect();
      itemMenu.style.top = (r.bottom - s.top + 4) + "px";
      itemMenu.style.left = Math.max(8, r.right - s.left - 150) + "px";
      itemMenu.hidden = false;
      itemMenu.querySelector("button").focus();
      return;
    }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "close") close();
    else if (act === "expand") { layout.full = !layout.full; applyLayout(); }
    else if (act === "history") {
      // the history sidebar lives in full screen; from the side panel it opens full screen with the list
      if (!layout.full) { layout.full = true; layout.side = true; } else layout.side = !layout.side;
      applyLayout();
      if (!side.hidden) search.focus();
    } else if (act === "side-close") { layout.side = false; applyLayout(); q('[data-act="history"]').focus(); }
    else if (act === "new") newChat();
    else if (act === "rename") { const id = menuFor; closeMenus(); startRename(id); }
    else if (act === "delete") {
      const id = menuFor;
      closeMenus();
      const c = chats.find(x => x.id === id);
      chats = chats.filter(x => x.id !== id);
      if (chat && chat.id === id) { if (run) run.stop(); chat = null; render(); }
      saveChats();
      if (c) notify("Chat deleted", `"${c.title}" was deleted.`);
    } else if (act === "back") { view = "chat"; render(); input.focus(); }
    else if (act === "suggest") { view = "suggest"; render(); }
    else if (act === "submit-idea") {
      const idea = q("[data-idea]").value.trim();
      if (!idea) return;
      write("bm.copilot.ideas.v1", [...read("bm.copilot.ideas.v1", []), { idea, page: pageContext().page, at: new Date().toISOString() }]);
      renderSuggest(true);
      notify("Thank you", "Your idea has been saved.");
    } else if (act === "plus") { q("[data-ctx-page]").textContent = pageContext().page; toggleMenu(plusMenu, b); }
    else if (act === "context") { ctx = ctx ? null : pageContext(); showCtx(); closeMenus(); input.focus(); }
    else if (act === "ctx-remove") { ctx = null; showCtx(); input.focus(); }
    else if (act === "effort") toggleMenu(effortMenu, b);
    else if (act === "mic") toggleMic(b);
    else if (act === "to-latest") body.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
    else {
      const msgEl = b.closest(".bmc-msg-ai, .bmc-msg-user");
      if (!msgEl || !chat) return;
      const i = Number(msgEl.dataset.index);
      const m = chat.messages[i];
      if (act === "copy" || act === "speak") {
        const text = msgEl.classList.contains("bmc-msg-ai") ? textOf(msgEl.querySelector(".bmc-ai-body")) : m.text;
        if (act === "speak") { speak(b, text); return; }
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => copied(b), () => notify("Copy", "Couldn't copy. Select the text instead.", "error")); else copied(b);
      } else if (act === "up" || act === "down") {
        m.rating = m.rating === act ? "" : act;
        msgEl.querySelectorAll('[data-act="up"],[data-act="down"]').forEach(x => {
          const on = x.dataset.act === m.rating;
          x.classList.toggle("on", on);
          x.setAttribute("aria-pressed", String(on));
        });
        saveChats();
        if (m.rating) notify("Thanks for the feedback", m.rating === "up" ? "Glad it helped." : "We'll use this to improve BM Copilot.");
      } else if (act === "retry") {
        if (run) return;
        chat.messages.splice(i);
        ask(m.prompt, { skipUser: true });
      } else if (act === "edit") {
        if (run) run.stop();
        startEdit(msgEl, i);
      } else if (act === "edit-cancel") render();
      else if (act === "edit-send") {
        const text = msgEl.querySelector("textarea").value.trim();
        if (!text) return;
        chat.messages.splice(i); // drop this message and everything after it, then ask again
        ask(text);
      }
    }
  });

  // ---------- chart tooltips ----------
  function hideTip() { tip.hidden = true; }
  function showTip(el) {
    tip.innerHTML = el.dataset.tip;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(window.innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2)) + "px";
    tip.style.top = Math.max(8, r.top - t.height - 8) + "px";
  }
  panel.addEventListener("mouseover", e => { const el = e.target.closest("[data-tip]"); if (el) showTip(el); });
  panel.addEventListener("mouseout", e => { if (e.target.closest("[data-tip]")) hideTip(); });
  panel.addEventListener("focusin", e => { const el = e.target.closest("[data-tip]"); if (el) showTip(el); });
  panel.addEventListener("focusout", hideTip);

  // ---------- keep the chat open across a link click ----------
  // sessionStorage = this browser tab only; the note expires after a minute so an old one never reopens the chat
  // The note also records which message held the link and where it sat in the chat, so the next page shows
  // the chat at the same place instead of jumping to the start.
  const RESUME = "bm.copilot.resume";
  function keepOpenAfterLoad(link) {
    if (run) run.stop(); // save what has been written so far
    const msg = link.closest("[data-index]");
    const note = {
      chat: chat ? chat.id : null,
      at: Date.now(),
      index: msg ? Number(msg.dataset.index) : null,
      offset: msg ? msg.getBoundingClientRect().top - body.getBoundingClientRect().top : 0,
      scrollTop: body.scrollTop
    };
    try { sessionStorage.setItem(RESUME, JSON.stringify(note)); } catch (e) { /* storage blocked */ }
  }
  function restoreScroll(note) {
    const msg = note.index == null ? null : [...body.querySelectorAll(".bmc-thread > [data-index]")].find(n => Number(n.dataset.index) === note.index);
    if (msg) body.scrollTop += msg.getBoundingClientRect().top - body.getBoundingClientRect().top - note.offset;
    else body.scrollTop = note.scrollTop || 0;
    syncDown();
  }
  let resume = null;
  try { resume = JSON.parse(sessionStorage.getItem(RESUME)); sessionStorage.removeItem(RESUME); } catch (e) { resume = null; }
  if (resume && Date.now() - resume.at < 60000) {
    chat = chats.find(c => c.id === resume.chat) || null;
    if (layout.full) layout.full = false; // full screen would hide the page that was just opened
    panel.style.visibility = "hidden";   // stay invisible until styled and scrolled into place
    open({ instant: true });
    const css = document.querySelector("link[data-bmc]");
    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      requestAnimationFrame(() => { restoreScroll(resume); panel.style.visibility = ""; });
    };
    if (css && !css.sheet) { css.addEventListener("load", show); css.addEventListener("error", show); setTimeout(show, 1500); } else show();
  }
})();
