(() => {
  "use strict";

  const root = document.querySelector("[data-dashboard-root]");
  if (!root) return;

  const rows = Array.from(root.querySelectorAll("[data-dashboard-row]"));
  const countEl = root.querySelector('[data-role="recipe-count"]');
  const emptyStateEl = root.querySelector(".recipe-dashboard__empty");
  const emptyTextEl = emptyStateEl
    ? emptyStateEl.querySelector('[data-role="dashboard-empty-text"]')
    : null;
  const listEl = root.querySelector(".recipe-dashboard__list");
  const searchForm = root.querySelector(".recipe-list__search");
  const searchInput = root.querySelector("#dashboard-search-input");
  const profileInput = root.querySelector("#dashboard-profile-select-native");
  const resetLink = root.querySelector(".recipe-list__reset");

  function clean(value) {
    return String(value || "").trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function setCount(total, queryRaw = "", profileRaw = "") {
    if (!countEl) return;
    const plural = total > 1 ? "s" : "";

    if (queryRaw || profileRaw) {
      let text = `${total} recette${plural} trouvee${plural}`;
      if (queryRaw) text += ` pour "${queryRaw}"`;
      if (profileRaw) text += queryRaw ? ` dans le profil "${profileRaw}"` : ` pour le profil "${profileRaw}"`;
      countEl.textContent = `${text}.`;
      return;
    }

    countEl.textContent = `${total} recette${plural} dans le dashboard.`;
  }

  function getRowTitle(row) {
    return lower(row.dataset.recipeTitle);
  }

  function getRowProfile(row) {
    return lower(row.dataset.recipeProfile);
  }

  function initProfileSelect() {
    const selectRoot = root.querySelector("[data-dashboard-profile-select]");
    if (!selectRoot) return;

    const nativeSelect = selectRoot.querySelector(".recipe-list__search-select-native");
    const trigger = selectRoot.querySelector(".recipe-select__trigger");
    const menu = selectRoot.querySelector(".recipe-select__menu");
    const label = selectRoot.querySelector('[data-role="selected-label"]');
    const options = Array.from(selectRoot.querySelectorAll(".recipe-select__option"));

    if (!nativeSelect || !trigger || !menu || !label || !options.length) return;

    selectRoot.classList.add("is-enhanced");

    function isMenuOpen() {
      return selectRoot.classList.contains("is-open");
    }

    function closeMenu() {
      if (!isMenuOpen()) return;
      selectRoot.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }

    function openMenu() {
      if (isMenuOpen()) return;
      selectRoot.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
    }

    function setSelectedValue(value, emitChange = false) {
      const selected =
        options.find((option) => option.dataset.value === value) || options[0];

      options.forEach((option) => {
        option.classList.toggle("is-selected", option === selected);
      });

      nativeSelect.value = selected.dataset.value || "";
      label.textContent = selected.textContent.trim();

      if (emitChange) {
        nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    setSelectedValue(nativeSelect.value || "", false);

    nativeSelect.addEventListener("change", () => {
      setSelectedValue(nativeSelect.value || "", false);
    });

    trigger.addEventListener("click", () => {
      if (isMenuOpen()) closeMenu();
      else openMenu();
    });

    options.forEach((option) => {
      option.addEventListener("click", () => {
        setSelectedValue(option.dataset.value || "", true);
        closeMenu();
        trigger.focus();
      });
    });

    document.addEventListener("click", (event) => {
      if (!selectRoot.contains(event.target)) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isMenuOpen()) closeMenu();
    });
  }

  function applyFilters() {
    const queryRaw = clean(searchInput ? searchInput.value : "");
    const profileRaw = clean(profileInput ? profileInput.value : "");
    const query = lower(queryRaw);
    const profile = lower(profileRaw);
    let visibleCount = 0;

    rows.forEach((row) => {
      const title = getRowTitle(row);
      const recipeProfile = getRowProfile(row);
      const matchesQuery = !query || title.includes(query) || recipeProfile.includes(query);
      const matchesProfile = !profile || recipeProfile === profile;
      const visible = matchesQuery && matchesProfile;

      row.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (listEl) listEl.hidden = visibleCount === 0;
    if (emptyStateEl) emptyStateEl.hidden = visibleCount !== 0;
    if (emptyTextEl) {
      emptyTextEl.textContent =
        queryRaw || profileRaw
          ? "Aucun resultat ne correspond aux filtres actuels."
          : "Ajoutez une recette pour commencer a remplir votre tableau de bord.";
    }
    if (resetLink) resetLink.hidden = !(queryRaw || profileRaw);
    setCount(visibleCount, queryRaw, profileRaw);
  }

  function initLiveFiltering() {
    if (!searchForm || !searchInput || !profileInput) {
      setCount(rows.length);
      return;
    }

    let debounceTimer = null;
    let isComposing = false;

    function queueApply() {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        applyFilters();
      }, 180);
    }

    searchInput.addEventListener("compositionstart", () => {
      isComposing = true;
    });

    searchInput.addEventListener("compositionend", () => {
      isComposing = false;
      queueApply();
    });

    searchInput.addEventListener("input", (event) => {
      if (isComposing || event.isComposing) return;
      queueApply();
    });

    profileInput.addEventListener("change", () => {
      applyFilters();
    });

    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      applyFilters();
    });

    if (resetLink) {
      resetLink.addEventListener("click", (event) => {
        event.preventDefault();
        searchInput.value = "";

        if (profileInput.value !== "") {
          profileInput.value = "";
          profileInput.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          applyFilters();
        }

        searchInput.focus();
      });
    }

    applyFilters();
  }

  initProfileSelect();
  initLiveFiltering();

  // Etat focus clavier sur les lignes (feedback visuel simple)
  rows.forEach((row) => {
    row.addEventListener("focusin", () => {
      row.classList.add("is-focused");
    });
    row.addEventListener("focusout", () => {
      row.classList.remove("is-focused");
    });
  });
})();
