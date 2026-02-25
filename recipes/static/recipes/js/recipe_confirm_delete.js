(() => {
  "use strict";

  const dashboardRoot = document.querySelector("[data-dashboard-root]");
  const modal = document.getElementById("recipeDeleteModal");
  if (!dashboardRoot || !modal) return;

  // Garantit un overlay plein écran, indépendant du conteneur dashboard.
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  const form = modal.querySelector('[data-role="delete-form"]');
  const backdrop = modal.querySelector('[data-role="delete-backdrop"]');
  const cancelButtons = Array.from(modal.querySelectorAll('[data-role="delete-cancel"]'));
  const titleEl = modal.querySelector('[data-role="delete-title"]');
  const profileEl = modal.querySelector('[data-role="delete-profile"]');
  const descriptionEl = modal.querySelector('[data-role="delete-description"]');

  let lastTrigger = null;

  function clean(value) {
    return String(value || "").trim();
  }

  function openModal(trigger) {
    const row = trigger.closest("[data-dashboard-row]");
    if (!row || !form) return;

    const actionUrl = trigger.getAttribute("href");
    if (!actionUrl) return;

    form.setAttribute("action", actionUrl);

    if (titleEl) titleEl.textContent = clean(row.dataset.recipeTitle) || "Recette";
    if (profileEl) profileEl.textContent = clean(row.dataset.recipeProfile) || "Non renseigne";
    if (descriptionEl) {
      descriptionEl.textContent =
        clean(row.dataset.recipeDescription) || "Aucune description.";
    }

    lastTrigger = trigger;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");

    const firstCancel = cancelButtons[0];
    if (firstCancel) firstCancel.focus();
  }

  function closeModal() {
    if (modal.hidden) return;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");

    if (lastTrigger) {
      lastTrigger.focus();
      lastTrigger = null;
    }
  }

  dashboardRoot.addEventListener("click", (event) => {
    const trigger = event.target.closest(".recipe-dashboard__action--delete");
    if (!trigger || !dashboardRoot.contains(trigger)) return;

    event.preventDefault();
    openModal(trigger);
  });

  if (backdrop) {
    backdrop.addEventListener("click", closeModal);
  }

  cancelButtons.forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (modal.hidden) return;
    closeModal();
  });
})();
