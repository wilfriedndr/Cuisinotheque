(() => {
  "use strict";

  const root = document.querySelector("[data-recipe-detail]");
  if (!root) return;

  const sectionCards = Array.from(root.querySelectorAll("[data-section-card]"));
  const toggles = Array.from(root.querySelectorAll("[data-section-toggle]"));
  const mobileMq = window.matchMedia("(max-width: 760px)");

  function setCardCollapsed(card, collapsed) {
    if (!card) return;
    const toggle = card.querySelector("[data-section-toggle]");
    const label = toggle ? toggle.querySelector('[data-role="toggle-label"]') : null;

    card.classList.toggle("is-collapsed", collapsed);

    if (toggle) {
      const expanded = !collapsed;
      toggle.setAttribute("aria-expanded", String(expanded));
      if (label) label.textContent = expanded ? "Réduire" : "Déplier";
    }
  }

  function syncSectionToggleMode() {
    if (!mobileMq.matches) {
      sectionCards.forEach((card) => setCardCollapsed(card, false));
    }
  }

  function initSectionToggles() {
    if (!toggles.length) return;

    toggles.forEach((toggle) => {
      toggle.addEventListener("click", () => {
        if (!mobileMq.matches) return;
        const card = toggle.closest("[data-section-card]");
        if (!card) return;

        const isCollapsed = card.classList.contains("is-collapsed");
        setCardCollapsed(card, !isCollapsed);
      });
    });

    if (typeof mobileMq.addEventListener === "function") {
      mobileMq.addEventListener("change", syncSectionToggleMode);
    } else if (typeof mobileMq.addListener === "function") {
      mobileMq.addListener(syncSectionToggleMode);
    }

    syncSectionToggleMode();
  }

  initSectionToggles();
})();
