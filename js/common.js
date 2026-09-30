// Shared top-bar behaviour: the "+" add popup
const addBtn = document.getElementById("addBtn");
const addMenu = document.getElementById("addMenu");

addBtn.addEventListener("click", e => {
  if (addMenu.contains(e.target)) {
    // choosing an option closes the menu; clicks on the padding keep it open
    if (e.target.closest("a")) addBtn.classList.remove("open");
    return;
  }
  addBtn.classList.toggle("open");
});

document.addEventListener("click", e => {
  if (!addBtn.contains(e.target)) addBtn.classList.remove("open");
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") addBtn.classList.remove("open");
});

// ---------- Toast message (top of the page) ----------
// showToast({ title: "Error", message: "…", type: "error" | "success", duration: ms })
function showToast({ title = "Error", message = "", type = "error", duration = 15000 } = {}) {
  let root = document.getElementById("toastRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "toastRoot";
    root.className = "toast-root";
    document.body.appendChild(root);
  }
  // the same message again just restarts its timer
  const same = [...root.children].find(t => t.dataset.key === title + message);
  if (same) same.remove();

  const icon = type === "error" ? '<path d="M7 7l6 6M13 7l-6 6"/>' : '<path d="M6 10.5l2.7 2.7L14 8"/>';
  const toast = document.createElement("div");
  toast.className = "toast toast-" + type;
  toast.dataset.key = title + message;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.title = "Click to close";
  toast.innerHTML = '<span class="toast-ic"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="1.6"><circle cx="10" cy="10" r="8.5"/>' +
    icon + '</svg></span><span class="toast-text"><b></b><span></span></span>';
  toast.querySelector("b").textContent = title;
  toast.querySelector(".toast-text span").textContent = message;
  root.appendChild(toast);

  const close = () => { toast.classList.add("leaving"); setTimeout(() => toast.remove(), 200); };
  const timer = setTimeout(close, duration);
  toast.addEventListener("click", () => { clearTimeout(timer); close(); });
}
