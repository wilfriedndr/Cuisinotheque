(function () {
  const form = document.getElementById("recipeForm");
  const addSectionBtn = document.getElementById("addSectionBtn");
  const sectionsRoot = document.getElementById("sectionsRoot");
  const payloadInput = document.getElementById("recipePayload");

  if (!form || !addSectionBtn || !sectionsRoot || !payloadInput) {
    console.warn("recipe_form.js: éléments introuvables (IDs HTML ≠ JS).");
    return;
  }

  const state = {
    sections: [],
  };

  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function syncPayload() {
    payloadInput.value = JSON.stringify(state);
  }

  function render() {
    sectionsRoot.innerHTML = "";

    state.sections.forEach((section, sIndex) => {
      const sectionEl = document.createElement("div");
      sectionEl.className = "rf-card";
      sectionEl.dataset.sectionId = section.id;

      sectionEl.innerHTML = `
        <div class="rf-sections-head rf-section-head">
          <div class="rf-section-name-wrap">
            <strong class="rf-section-name-label">Section</strong>
            <input type="text" class="section-name" placeholder="ex: Génoise, Crème, Montage"
                   value="${escapeHtml(section.name)}">
          </div>
          <button type="button" class="btn btn--ghost btn-remove-section">Supprimer</button>
        </div>

        <div class="rf-section-body">
          <div>
            <div class="rf-subsection-head">
              <strong class="rf-subsection-title">Ingrédients</strong>
              <button type="button" class="btn btn--soft btn-add-ingredient">+ Ajouter ingrédient</button>
            </div>
            <div class="ingredients"></div>
          </div>

          <div>
            <div class="rf-subsection-head">
              <strong class="rf-subsection-title">Étapes</strong>
              <button type="button" class="btn btn--soft btn-add-step">+ Ajouter étape</button>
            </div>
            <div class="steps"></div>
          </div>
        </div>
      `;

      // --- ingredients render
      const ingWrap = sectionEl.querySelector(".ingredients");
      section.ingredients.forEach((ing, iIndex) => {
        const row = document.createElement("div");
        row.className = "rf-grid rf-ingredient-row";

        row.innerHTML = `
          <div class="rf-field">
            <label>Nom</label>
            <input type="text" class="ing-name" placeholder="ex: Farine" value="${escapeHtml(ing.name)}">
          </div>
          <div class="rf-field">
            <label>Quantité</label>
            <input type="text" class="ing-qty" placeholder="ex: 250" value="${escapeHtml(ing.quantity)}">
          </div>
          <div class="rf-field">
            <label>Unité</label>
            <input type="text" class="ing-unit" placeholder="g, ml, c.à.s" value="${escapeHtml(ing.unit)}">
          </div>
          <button type="button" class="btn btn--ghost btn-remove-ingredient rf-remove-btn">✕</button>
        `;

        // listeners ingredient inputs
        row.querySelector(".ing-name").addEventListener("input", (e) => {
          ing.name = e.target.value;
          syncPayload();
        });
        row.querySelector(".ing-qty").addEventListener("input", (e) => {
          ing.quantity = e.target.value;
          syncPayload();
        });
        row.querySelector(".ing-unit").addEventListener("input", (e) => {
          ing.unit = e.target.value;
          syncPayload();
        });
        row.querySelector(".btn-remove-ingredient").addEventListener("click", () => {
          section.ingredients.splice(iIndex, 1);
          render();
          syncPayload();
        });

        ingWrap.appendChild(row);
      });

      // --- steps render
      const stepsWrap = sectionEl.querySelector(".steps");
      section.steps.forEach((st, stIndex) => {
        const row = document.createElement("div");
        row.className = "rf-field rf-step-row";

        row.innerHTML = `
          <label>Étape ${stIndex + 1}</label>
          <div class="rf-step-input-row">
            <textarea class="step-text" rows="2" placeholder="Décris l'étape...">${escapeHtml(st.text)}</textarea>
            <button type="button" class="btn btn--ghost btn-remove-step rf-remove-btn">✕</button>
          </div>
        `;

        row.querySelector(".step-text").addEventListener("input", (e) => {
          st.text = e.target.value;
          syncPayload();
        });
        row.querySelector(".btn-remove-step").addEventListener("click", () => {
          section.steps.splice(stIndex, 1);
          render();
          syncPayload();
        });

        stepsWrap.appendChild(row);
      });

      // section name listener
      sectionEl.querySelector(".section-name").addEventListener("input", (e) => {
        section.name = e.target.value;
        syncPayload();
      });

      // add ingredient
      sectionEl.querySelector(".btn-add-ingredient").addEventListener("click", () => {
        section.ingredients.push({ name: "", quantity: "", unit: "" });
        render();
        syncPayload();
      });

      // add step
      sectionEl.querySelector(".btn-add-step").addEventListener("click", () => {
        section.steps.push({ text: "" });
        render();
        syncPayload();
      });

      // remove section
      sectionEl.querySelector(".btn-remove-section").addEventListener("click", () => {
        state.sections.splice(sIndex, 1);
        render();
        syncPayload();
      });

      sectionsRoot.appendChild(sectionEl);
    });
  }

  function escapeHtml(str) {
    return (str ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  addSectionBtn.addEventListener("click", () => {
    state.sections.push({
      id: uid(),
      name: "",
      ingredients: [],
      steps: [],
    });
    render();
    syncPayload();
  });

  form.addEventListener("submit", () => {
    syncPayload();
  });

  // init
  syncPayload();
  render();
})();
