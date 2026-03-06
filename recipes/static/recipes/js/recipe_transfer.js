(() => {
  "use strict";

  // Handles import/export modals on dashboard (open/close, preview, submit).
  const root = document.querySelector("[data-dashboard-root]");
  if (!root) return;

  const importTrigger = root.querySelector('[data-role="open-import-modal"]');
  const importModal = document.getElementById("recipeImportModal");
  const exportModal = document.getElementById("recipeExportModal");

  if (!importModal || !exportModal) return;

  [importModal, exportModal].forEach((modal) => {
    // Move modals to <body> so overlays are not clipped by dashboard containers.
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  });

  const importForm = importModal.querySelector('[data-role="import-form"]');
  const importFileInput = importModal.querySelector('[data-role="import-file"]');
  const importTextarea = importModal.querySelector('[data-role="import-textarea"]');
  const importPreview = importModal.querySelector('[data-role="import-preview"]');
  const importFeedback = importModal.querySelector('[data-role="import-feedback"]');
  const importSubmit = importModal.querySelector('[data-role="import-submit"]');
  const importBackdrop = importModal.querySelector('[data-role="import-backdrop"]');
  const importCancel = importModal.querySelector('[data-role="import-cancel"]');

  const exportBackdrop = exportModal.querySelector('[data-role="export-backdrop"]');
  const exportCancel = exportModal.querySelector('[data-role="export-cancel"]');
  const exportTitle = exportModal.querySelector('[data-role="export-title"]');
  const exportProfile = exportModal.querySelector('[data-role="export-profile"]');
  const exportDescription = exportModal.querySelector('[data-role="export-description"]');
  const exportJsonLink = exportModal.querySelector('[data-role="export-json"]');
  const exportWordLink = exportModal.querySelector('[data-role="export-word"]');
  const exportPdfLink = exportModal.querySelector('[data-role="export-pdf"]');

  if (
    !importTrigger ||
    !importForm ||
    !importFileInput ||
    !importTextarea ||
    !importPreview ||
    !importFeedback ||
    !importSubmit ||
    !importBackdrop ||
    !importCancel ||
    !exportBackdrop ||
    !exportCancel ||
    !exportTitle ||
    !exportProfile ||
    !exportDescription ||
    !exportJsonLink ||
    !exportWordLink ||
    !exportPdfLink
  ) {
    return;
  }

  const defaultSchema = importTextarea.value.trim();
  let importLastTrigger = null;
  let exportLastTrigger = null;
  let importDebounce = null;
  let isSubmittingImport = false;

  function clean(value) {
    return String(value || "").trim();
  }

  function syncBodyLock() {
    // Prevent background scrolling when any overlay modal/menu is open.
    const hasOpenOverlay = Boolean(
      document.querySelector(
        ".recipe-delete-modal:not([hidden]), .recipe-transfer-modal:not([hidden]), .mobile-nav-overlay:not([hidden])"
      )
    );
    document.body.classList.toggle("no-scroll", hasOpenOverlay);
  }

  function openModal(modal, trigger, focusTarget) {
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    syncBodyLock();

    if (modal === importModal) {
      importLastTrigger = trigger || importTrigger;
    } else if (modal === exportModal) {
      exportLastTrigger = trigger || null;
    }

    if (focusTarget) {
      window.setTimeout(() => {
        focusTarget.focus();
      }, 0);
    }
  }

  function closeModal(modal) {
    if (modal.hidden) return;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    syncBodyLock();

    if (modal === importModal && importLastTrigger) {
      importLastTrigger.focus();
      importLastTrigger = null;
    } else if (modal === exportModal && exportLastTrigger) {
      exportLastTrigger.focus();
      exportLastTrigger = null;
    }
  }

  function setImportFeedback(message, type) {
    importFeedback.textContent = message || "";
    importFeedback.classList.remove("is-error", "is-success");

    if (!message) {
      importFeedback.hidden = true;
      return;
    }

    importFeedback.hidden = false;
    if (type === "error") importFeedback.classList.add("is-error");
    if (type === "success") importFeedback.classList.add("is-success");
  }

  function extractImportRecipes(payload) {
    // Accepts both {"recipes":[...]} and a single recipe object for convenience.
    if (Array.isArray(payload)) return payload;

    if (payload && typeof payload === "object") {
      if (Array.isArray(payload.recipes)) return payload.recipes;
      if ("title" in payload || "sections" in payload) return [payload];
    }

    throw new Error("Le JSON doit contenir une cle 'recipes' ou une recette unique.");
  }

  function renderImportEmpty(message) {
    importPreview.textContent = "";
    const empty = document.createElement("p");
    empty.className = "recipe-transfer-empty";
    empty.textContent = message;
    importPreview.appendChild(empty);
  }

  function appendPreviewList(target, items, ordered = false) {
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "recipe-transfer-preview__empty-line";
      empty.textContent = ordered ? "Aucune etape." : "Aucun ingredient.";
      target.appendChild(empty);
      return;
    }

    const list = document.createElement(ordered ? "ol" : "ul");
    list.className = "recipe-transfer-preview__detail-list";

    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });

    target.appendChild(list);
  }

  function buildIngredientText(ingredient) {
    if (!ingredient || typeof ingredient !== "object") return "";

    const parts = [];
    const quantity = clean(ingredient.quantity);
    const unit = clean(ingredient.unit);
    const name = clean(ingredient.name);

    if (quantity) parts.push(quantity);
    if (unit) parts.push(unit);
    if (name) parts.push(name);

    return parts.join(" ");
  }

  function buildStepText(step) {
    if (!step || typeof step !== "object") return "";

    const title = clean(step.title);
    const text = clean(step.text || step.instruction);
    if (!title) return text;
    if (!text) return title;
    return `${title}: ${text}`;
  }

  function renderImportPreview() {
    // Build a live preview from textarea content to validate JSON structure quickly.
    const raw = clean(importTextarea.value);

    if (!raw || raw === defaultSchema) {
      renderImportEmpty(
        "Le schema JSON pre-rempli est pret. Remplissez-le ou chargez un fichier pour previsualiser les recettes."
      );
      return;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (_error) {
      renderImportEmpty("JSON invalide: corrigez la syntaxe pour afficher l'apercu.");
      return;
    }

    let recipes;
    try {
      recipes = extractImportRecipes(payload);
    } catch (error) {
      renderImportEmpty(error.message);
      return;
    }

    const validRecipes = recipes.filter((item) => item && typeof item === "object");
    if (!validRecipes.length) {
      renderImportEmpty("Aucune recette exploitable detectee dans ce JSON.");
      return;
    }

    importPreview.textContent = "";

    validRecipes.forEach((recipe, index) => {
      const sections = Array.isArray(recipe.sections) ? recipe.sections : [];
      let ingredientCount = 0;
      let stepCount = 0;

      sections.forEach((section) => {
        if (!section || typeof section !== "object") return;
        if (Array.isArray(section.ingredients)) ingredientCount += section.ingredients.length;
        if (Array.isArray(section.steps)) stepCount += section.steps.length;
      });

      const card = document.createElement("div");
      card.className = "recipe-transfer-preview__card";

      const title = document.createElement("h4");
      title.className = "recipe-transfer-preview__card-title";
      title.textContent = clean(recipe.title) || `Recette ${index + 1}`;

      const meta = document.createElement("p");
      meta.className = "recipe-transfer-preview__card-meta";
      meta.textContent = `Profil: ${clean(recipe.profile) || "Non renseigne"}`;

      const body = document.createElement("p");
      body.className = "recipe-transfer-preview__card-body";
      body.textContent =
        `${sections.length} section(s) • ${ingredientCount} ingredient(s) • ${stepCount} etape(s)`;

      const description = document.createElement("p");
      description.className = "recipe-transfer-preview__card-body";
      description.textContent =
        clean(recipe.description) || "Aucune description.";

      const sectionList = document.createElement("div");
      sectionList.className = "recipe-transfer-preview__section-list";

      sections.forEach((section, sectionIndex) => {
        if (!section || typeof section !== "object") return;

        const sectionEl = document.createElement("section");
        sectionEl.className = "recipe-transfer-preview__section";

        const sectionTitle = document.createElement("h5");
        sectionTitle.className = "recipe-transfer-preview__section-title";
        sectionTitle.textContent =
          clean(section.title || section.name) || `Section ${sectionIndex + 1}`;
        sectionEl.appendChild(sectionTitle);

        const ingredientsTitle = document.createElement("p");
        ingredientsTitle.className = "recipe-transfer-preview__subhead";
        ingredientsTitle.textContent = "Ingredients";
        sectionEl.appendChild(ingredientsTitle);

        const ingredients = Array.isArray(section.ingredients)
          ? section.ingredients
              .map(buildIngredientText)
              .filter(Boolean)
          : [];
        appendPreviewList(sectionEl, ingredients, false);

        const stepsTitle = document.createElement("p");
        stepsTitle.className = "recipe-transfer-preview__subhead";
        stepsTitle.textContent = "Etapes";
        sectionEl.appendChild(stepsTitle);

        const steps = Array.isArray(section.steps)
          ? section.steps
              .map(buildStepText)
              .filter(Boolean)
          : [];
        appendPreviewList(sectionEl, steps, true);

        sectionList.appendChild(sectionEl);
      });

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(body);
      card.appendChild(description);
      if (sectionList.childElementCount) {
        card.appendChild(sectionList);
      } else {
        const noSection = document.createElement("p");
        noSection.className = "recipe-transfer-preview__empty-line";
        noSection.textContent = "Aucune section detectee.";
        card.appendChild(noSection);
      }
      importPreview.appendChild(card);
    });
  }

  function queueImportPreview() {
    // Debounce preview rebuild while typing in large JSON payloads.
    if (importDebounce !== null) {
      window.clearTimeout(importDebounce);
    }

    importDebounce = window.setTimeout(() => {
      importDebounce = null;
      renderImportPreview();
    }, 140);
  }

  async function loadFileIntoTextarea(file) {
    if (!file) return;

    try {
      const text = await file.text();
      importTextarea.value = text;
      setImportFeedback("", "");
      renderImportPreview();
    } catch (_error) {
      setImportFeedback("Impossible de lire ce fichier JSON.", "error");
    }
  }

  async function submitImport(event) {
    // AJAX submit keeps the modal UX smooth, then redirects to dashboard on success.
    event.preventDefault();
    if (isSubmittingImport) return;

    setImportFeedback("", "");
    isSubmittingImport = true;
    importSubmit.disabled = true;
    importSubmit.textContent = "Import en cours...";

    try {
      const response = await fetch(importForm.action, {
        method: "POST",
        body: new FormData(importForm),
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_error) {
        data = null;
      }

      if (!response.ok || !data || !data.ok) {
        throw new Error((data && data.error) || "L'import a echoue.");
      }

      setImportFeedback(
        `${data.imported} recette(s) importee(s). Redirection...`,
        "success"
      );
      window.location.href = data.redirect_url || window.location.href;
    } catch (error) {
      setImportFeedback(error.message || "L'import a echoue.", "error");
      isSubmittingImport = false;
      importSubmit.disabled = false;
      importSubmit.textContent = "Importer les recettes";
    }
  }

  function openImportModal() {
    renderImportPreview();
    openModal(importModal, importTrigger, importFileInput);
  }

  function openExportModal(trigger) {
    // Read row dataset and inject it into the export modal before opening.
    const row = trigger.closest("[data-dashboard-row]");
    if (!row) return;

    exportTitle.textContent = clean(row.dataset.recipeTitle) || "Recette";
    exportProfile.textContent = clean(row.dataset.recipeProfile) || "Non renseigne";
    exportDescription.textContent =
      clean(row.dataset.recipeDescription) || "Aucune description.";

    exportJsonLink.href = trigger.dataset.exportJsonUrl || "#";
    exportWordLink.href = trigger.dataset.exportWordUrl || "#";
    exportPdfLink.href = trigger.dataset.exportPdfUrl || "#";

    openModal(exportModal, trigger, exportJsonLink);
  }

  importTrigger.addEventListener("click", openImportModal);
  importBackdrop.addEventListener("click", () => closeModal(importModal));
  importCancel.addEventListener("click", () => closeModal(importModal));
  importFileInput.addEventListener("change", () => {
    const [file] = importFileInput.files || [];
    loadFileIntoTextarea(file);
  });
  importTextarea.addEventListener("input", () => {
    setImportFeedback("", "");
    queueImportPreview();
  });
  importForm.addEventListener("submit", submitImport);

  root.addEventListener("click", (event) => {
    const exportTrigger = event.target.closest('[data-role="open-export-modal"]');
    if (!exportTrigger || !root.contains(exportTrigger)) return;

    openExportModal(exportTrigger);
  });

  exportBackdrop.addEventListener("click", () => closeModal(exportModal));
  exportCancel.addEventListener("click", () => closeModal(exportModal));

  [exportJsonLink, exportWordLink, exportPdfLink].forEach((link) => {
    link.addEventListener("click", () => {
      closeModal(exportModal);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!exportModal.hidden) closeModal(exportModal);
    else if (!importModal.hidden) closeModal(importModal);
  });

  renderImportPreview();
})();
