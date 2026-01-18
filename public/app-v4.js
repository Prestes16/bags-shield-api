// Helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

// STORE
const STORE = {
  currentView: "splash"
};

// ACTIONS
const ACTIONS = {
  nav_home: () => {
    showView("home");
  },

  nav_scan: () => {
    alert("TODO: scan screen");
  },

  nav_simulate: () => {
    alert("TODO: simulate screen");
  },

  nav_settings: () => {
    alert("TODO: settings screen");
  }
};

// View management
function showView(id) {
  STORE.currentView = id;
  $$(".view").forEach(view => {
    view.classList.toggle("hidden", view.id !== `view-${id}`);
  });
}

// Wire actions
function wireActions() {
  $$("[data-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const key = btn.getAttribute("data-action");
      const fn = ACTIONS[key];
      if (fn) {
        fn();
      }
    });
  });
}

// Boot
function boot() {
  wireActions();
  showView("splash");
}

document.addEventListener("DOMContentLoaded", boot);
