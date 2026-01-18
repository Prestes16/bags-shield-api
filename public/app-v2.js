function show(id) {
  document.getElementById("view-splash").classList.add("hidden");
  document.getElementById("view-home").classList.add("hidden");
  document.getElementById(id).classList.remove("hidden");
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  if (action === "getStarted") {
    show("view-home");
  }
});

show("view-splash");
