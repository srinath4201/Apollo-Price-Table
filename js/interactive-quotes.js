// Interactive Quotes demo page (interactive-quotes.html).
// Runs the Select Report → Quotation flow from js/job-quotes.js on job ON5507 (Markilux sample in js/job-store.js),
// without the rest of Create / Edit Job. Provides the helpers job-quotes.js expects:
// $, esc, money, todayDMY, job, jobItems, quoteIds, quoteItems, switchQuote, addQuoteVersion, renderQuoteVer, logActivity, flash.
// Every change (new version, acceptance, emails) is saved to job ON5507, so Edit Job shows the same data.

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const todayDMY = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`; };
const gbp = n => `£ ${Number(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DEMO_REF = "ON5507";
const saved = JobStore.load(DEMO_REF);

// ---------- job + quote versions (same shape as js/create-job.js) ----------
const jobItems = [];
const job = { quotes: saved.quotes, current: saved.quotes[saved.current] ? saved.current : Object.keys(saved.quotes)[0], activity: saved.activity || [] };
const quoteIds = () => Object.keys(job.quotes).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
const quoteItems = id => (id === job.current ? jobItems : job.quotes[id].items);
jobItems.push(...job.quotes[job.current].items);
job.quotes[job.current].items = jobItems;

// header + customer (read only here; edit them in Edit Job)
$("jobRef").value = saved.ref;
$("jobStatus").value = saved.status || "Lead";
$("accountRef").value = saved.account || "";
const c = saved.contact || {};
const CUSTOMER = { cTitle: "title", cFirst: "first", cLast: "last", cEmail: "email", cPhone: "phone", cAddress1: "address1", cAddress2: "address2", cTown: "town", cState: "state", cZip: "zip" };
Object.entries(CUSTOMER).forEach(([id, alias]) => { $(id).value = c[id] ?? c[alias] ?? ""; });

function persist() {
  job.quotes[job.current].items = jobItems;
  JobStore.save({ ...saved, status: $("jobStatus").value, current: job.current, quotes: job.quotes, activity: job.activity });
}
$("jobStatus").addEventListener("change", persist);

// ---------- products of the current version ----------
function renderItems() {
  const loc = it => it.data?.values?.Room || it.data?.values?.Location || "";
  $("iqdRows").innerHTML = jobItems.length
    ? jobItems.map((it, i) => `<tr>
        <td>${i + 1}</td>
        <td><b>${esc(it.product)}</b></td>
        <td class="iqd-desc"><span>${esc(it.description)}</span>${loc(it) ? `<span class="jd-sub">Location: ${esc(loc(it))}</span>` : ""}${(it.extras || []).length ? `<span class="jd-sub"><b>Extras:</b> ${esc(it.extras.map(x => x.name).join(", "))}</span>` : ""}</td>
        <td>${it.qty}</td><td class="right">${gbp(it.net)}</td><td class="right">${gbp(it.vat)}</td><td class="right"><b>${gbp(it.net + it.vat)}</b></td></tr>`).join("")
    : `<tr><td colspan="7" class="iqd-empty">No products in this quote version</td></tr>`;
  const net = jobItems.reduce((a, it) => a + Number(it.net || 0), 0);
  const vat = jobItems.reduce((a, it) => a + Number(it.vat || 0), 0);
  $("iqdVer").textContent = `(${job.current})`;
  $("iqdNet").textContent = gbp(net);
  $("iqdVat").textContent = gbp(vat);
  $("iqdTotal").textContent = gbp(net + vat);
}

// quote versions card
function renderVersions() {
  $("iqdVersions").innerHTML = quoteIds().map(id => {
    const items = quoteItems(id);
    const total = items.reduce((a, it) => a + Number(it.net || 0) + Number(it.vat || 0), 0);
    const extras = items.reduce((a, it) => a + (it.extras || []).length, 0);
    return `<button type="button" class="iqd-ver ${id === job.current ? "current" : ""}" data-quote="${id}">
      <b>${id}</b><span>${esc(job.quotes[id].status)} · ${items.length} product${items.length === 1 ? "" : "s"}${extras ? ` · ${extras} extras` : ""}</span><em>${gbp(total)}</em></button>`;
  }).join("");
}
$("iqdVersions").addEventListener("click", e => { const b = e.target.closest("[data-quote]"); if (b) switchQuote(b.dataset.quote); });

// ---------- Q1 ▾ menu ----------
const qvMenu = $("quoteVerMenu");
function renderQuoteVer() {
  $("quoteVerLabel").textContent = job.current;
  qvMenu.innerHTML = quoteIds().map(id => `<button type="button" role="menuitemradio" aria-checked="${id === job.current}" data-quote="${id}" class="${id === job.current ? "current" : ""}"><b>${id}</b><span>${esc(job.quotes[id].status)}</span></button>`).join("") +
    `<button type="button" role="menuitem" class="qv-new" data-quote-new>+ New quote version</button>`;
  renderVersions();
}
function switchQuote(id) {
  if (!job.quotes[id] || id === job.current) return;
  job.quotes[job.current].items = jobItems.slice();
  jobItems.length = 0;
  jobItems.push(...job.quotes[id].items);
  job.quotes[id].items = jobItems;
  job.current = id;
  renderQuoteVer();
  renderItems();
  persist();
}
function addQuoteVersion(status, items) {
  const id = "Q" + (Math.max(0, ...quoteIds().map(q => Number(q.slice(1)))) + 1);
  job.quotes[id] = { status, items };
  renderQuoteVer();
  persist();
  return id;
}
$("quoteVerBtn").addEventListener("click", e => {
  e.stopPropagation();
  renderQuoteVer();
  qvMenu.hidden = !qvMenu.hidden;
  $("quoteVerBtn").setAttribute("aria-expanded", String(!qvMenu.hidden));
});
qvMenu.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  qvMenu.hidden = true;
  $("quoteVerBtn").setAttribute("aria-expanded", "false");
  if (b.dataset.quote) switchQuote(b.dataset.quote);
  else openNewVersion(); // js/job-quotes.js
});
document.addEventListener("click", e => { if (!qvMenu.hidden && !e.target.closest(".jh-ref")) { qvMenu.hidden = true; $("quoteVerBtn").setAttribute("aria-expanded", "false"); } });

// ---------- activities + messages ----------
function logActivity(text) {
  const d = new Date();
  job.activity.unshift({ text, time: `${todayDMY()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` });
  renderActivity();
  renderVersions();
  persist();
}
function renderActivity() {
  $("actList").innerHTML = job.activity.map(a => `<div class="act-row"><span title="${esc(a.text)}">${esc(a.text)}</span><time>${esc(a.time)}</time></div>`).join("");
  $("actList").hidden = !job.activity.length;
  $("actEmpty").hidden = !!job.activity.length;
}
let flashTimer;
function flash(text, ok) {
  const m = $("jobMsg");
  m.textContent = text;
  m.className = `job-msg ${ok ? "ok" : "err"}`;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { m.textContent = ""; }, 4000);
}

// Reset demo data → back to the Markilux sample
$("iqdReset").addEventListener("click", () => {
  if (!confirm("Reset job ON5507 to the original Markilux sample? Quote versions and activities added in the demo are removed.")) return;
  JobStore.remove(DEMO_REF);
  location.reload();
});

renderQuoteVer();
renderItems();
renderActivity();
