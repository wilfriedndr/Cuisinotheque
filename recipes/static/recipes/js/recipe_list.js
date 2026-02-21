(() => {
  "use strict";

  // Script dédié à la page "liste des recettes"
  const listRoot = document.querySelector(".recipe-list");
  if (!listRoot) return;

  // Select profil custom (on conserve le select natif pour la valeur du filtre)
  function initProfileSelect() {
    const selectRoot = listRoot.querySelector("[data-profile-select]");
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

  initProfileSelect();

  // Pancarte hover affichée au survol d'une carte recette
  const popup = document.getElementById("recipeHoverCard");

  if (!popup) return;

  const cards = Array.from(listRoot.querySelectorAll(".recipe-card"));
  const searchForm = listRoot.querySelector(".recipe-list__search");
  const searchInput = listRoot.querySelector("#recipe-search-input");
  const profileInput = listRoot.querySelector(".recipe-list__search-select-native");
  const gridEl = listRoot.querySelector(".recipe-grid");
  const emptyStateEl = listRoot.querySelector(".recipe-empty");
  const emptyTextEl = emptyStateEl
    ? emptyStateEl.querySelector(".recipe-empty__text")
    : null;
  const subtitleEl = listRoot.querySelector(".recipe-list__subtitle");
  const resetLink = listRoot.querySelector(".recipe-list__reset");

  const titleEl = popup.querySelector('[data-role="title"]');
  const profileEl = popup.querySelector('[data-role="profile"]');
  const timesEl = popup.querySelector('[data-role="times"]');
  const descriptionEl = popup.querySelector('[data-role="description"]');
  const ingredientsEl = popup.querySelector('[data-role="ingredients"]');
  const stepsEl = popup.querySelector('[data-role="steps"]');

  if (!titleEl || !profileEl || !timesEl || !descriptionEl || !ingredientsEl || !stepsEl) return;

  const gap = 12;
  const viewportMargin = 12;
  const hoverOpenDelayMs = 1000;

  let activeCard = null;
  let pendingCard = null;
  let showTimer = null;
  let hideTimer = null;
  let positionRaf = null;
  let isVisible = false;
  let transitionNonce = 0;

  function clean(value) {
    return String(value || "").trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function getCardTitle(card) {
    const el = card.querySelector(".recipe-card__title");
    return lower(el ? el.textContent : card.dataset.recipeTitle);
  }

  function getCardProfile(card) {
    const el = card.querySelector(".recipe-card__profile");
    return lower(el ? el.textContent : card.dataset.recipeProfile);
  }

  function getAnimationApi() {
    // API GSAP exposée depuis animations.js
    const api = window.recipeListPopupAnimations;
    if (!api) return null;
    if (typeof api.show !== "function" || typeof api.hide !== "function") {
      return null;
    }
    return api;
  }

  function clearHideTimer() {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function clearShowTimer() {
    if (showTimer !== null) {
      window.clearTimeout(showTimer);
      showTimer = null;
    }
    pendingCard = null;
  }

  function resetPopupPosition() {
    popup.style.removeProperty("left");
    popup.style.removeProperty("top");
    popup.removeAttribute("data-placement");
  }

  function buildTimesText(card) {
    const prep = clean(card.dataset.recipePrep);
    const cook = clean(card.dataset.recipeCook);
    const rest = clean(card.dataset.recipeRest);
    const parts = [];

    if (prep) parts.push(`Prep: ${prep}`);
    if (cook) parts.push(`Cuisson: ${cook}`);
    if (rest) parts.push(`Repos: ${rest}`);

    return parts.join(" | ");
  }

  function fillList(target, source, emptyText) {
    if (!target) return;
    target.textContent = "";

    const sourceItems = source ? Array.from(source.querySelectorAll(":scope > li")) : [];

    if (!sourceItems.length) {
      const emptyItem = document.createElement("li");
      emptyItem.textContent = emptyText;
      target.appendChild(emptyItem);
      return;
    }

    sourceItems.forEach((item) => {
      target.appendChild(item.cloneNode(true));
    });
  }

  function fillPopupContent(card) {
    const title = clean(card.dataset.recipeTitle);
    const profile = clean(card.dataset.recipeProfile);
    const descriptionSource = card.querySelector('[data-role="description-source"]');
    const description = clean(
      descriptionSource ? descriptionSource.textContent : card.dataset.recipeDescription
    );
    const times = buildTimesText(card);
    const ingredientsSource = card.querySelector('[data-role="ingredients-source"]');
    const stepsSource = card.querySelector('[data-role="steps-source"]');

    titleEl.textContent = title || "Recette";
    profileEl.textContent = profile || "Profil non renseigne";
    timesEl.textContent = times || "Temps non renseignes";
    descriptionEl.textContent =
      description || "Aucune description pour le moment.";
    fillList(ingredientsEl, ingredientsSource, "Aucun ingredient.");
    fillList(stepsEl, stepsSource, "Aucune etape.");
  }

  function placePopup(card) {
    // Placement intelligent: droite/gauche selon la place disponible
    if (!card || popup.hidden) return;

    popup.style.left = "0px";
    popup.style.top = "0px";

    const cardRect = card.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    const rightSpace = window.innerWidth - cardRect.right - gap - viewportMargin;
    const leftSpace = cardRect.left - gap - viewportMargin;

    let placement = "right";
    let left = cardRect.right + gap;

    if (rightSpace >= popupRect.width) {
      placement = "right";
      left = cardRect.right + gap;
    } else if (leftSpace >= popupRect.width) {
      placement = "left";
      left = cardRect.left - popupRect.width - gap;
    } else if (rightSpace >= leftSpace) {
      placement = "right";
      left = window.innerWidth - popupRect.width - viewportMargin;
    } else {
      placement = "left";
      left = viewportMargin;
    }

    const maxTop = window.innerHeight - popupRect.height - viewportMargin;
    const centeredTop = cardRect.top + (cardRect.height - popupRect.height) / 2;
    const top = Math.min(Math.max(centeredTop, viewportMargin), Math.max(viewportMargin, maxTop));

    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
    popup.setAttribute("data-placement", placement);
  }

  function requestReposition() {
    // Repositionne la pancarte au scroll/resize sans surcharge (rAF)
    if (!isVisible || !activeCard) return;
    if (positionRaf !== null) return;

    positionRaf = window.requestAnimationFrame(() => {
      positionRaf = null;
      if (!isVisible || !activeCard) return;
      placePopup(activeCard);
    });
  }

  function showPopup(card) {
    if (!card) return;

    clearShowTimer();
    clearHideTimer();
    transitionNonce += 1;
    activeCard = card;
    fillPopupContent(card);

    popup.hidden = false;
    popup.setAttribute("aria-hidden", "false");
    placePopup(card);

    const animationApi = getAnimationApi();
    if (animationApi) {
      animationApi.show(popup);
    }

    isVisible = true;
  }

  function hidePopup() {
    clearShowTimer();
    clearHideTimer();

    if (!isVisible && popup.hidden) return;

    isVisible = false;
    activeCard = null;
    const nonce = ++transitionNonce;

    const finalize = () => {
      if (nonce !== transitionNonce) return;
      resetPopupPosition();
    };

    const animationApi = getAnimationApi();
    if (animationApi) {
      animationApi.hide(popup, finalize);
    } else {
      popup.hidden = true;
      popup.setAttribute("aria-hidden", "true");
      finalize();
    }
  }

  function scheduleHide(delay = 80) {
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      hideTimer = null;
      hidePopup();
    }, delay);
  }

  function scheduleShow(card, delay = hoverOpenDelayMs) {
    // Délai d'ouverture demandé avant d'afficher la pancarte
    clearShowTimer();
    pendingCard = card;
    showTimer = window.setTimeout(() => {
      showTimer = null;
      if (pendingCard !== card) return;
      pendingCard = null;
      showPopup(card);
    }, delay);
  }

  function getHoveredCard() {
    for (const card of cards) {
      if (card.hidden) continue;
      if (card.matches(":hover")) return card;
    }
    return null;
  }

  function syncHoverStateAfterFocus() {
    // Corrige le cas retour focus navigateur: si une carte est déjà hover, on affiche la pancarte
    const hoveredCard = getHoveredCard();
    if (!hoveredCard) return;
    if (isVisible && activeCard === hoveredCard) return;
    if (pendingCard === hoveredCard) return;
    scheduleShow(hoveredCard);
  }

  function scheduleShowFromTarget(target) {
    // Fallback de détection hover via délégation d'événement
    if (!target || typeof target.closest !== "function") return;
    const hoveredCard = target.closest(".recipe-card");
    if (!hoveredCard || hoveredCard.hidden) return;
    if (isVisible && activeCard === hoveredCard) return;
    if (pendingCard === hoveredCard) return;
    scheduleShow(hoveredCard);
  }

  function buildSubtitle(total, queryRaw, profileRaw) {
    const plural = total > 1 ? "s" : "";
    if (queryRaw || profileRaw) {
      let text = `${total} recette${plural} trouvee${plural}`;
      if (queryRaw) text += ` pour "${queryRaw}"`;
      if (profileRaw) text += queryRaw ? ` dans le profil "${profileRaw}"` : ` pour le profil "${profileRaw}"`;
      return `${text}.`;
    }
    return `${total} recette${plural} disponible${plural} dans votre cuisinothèque.`;
  }

  function applyFilters() {
    // Filtrage live sur titre/profil + mise à jour des blocs UI (grille, empty state, sous-titre)
    const queryRaw = clean(searchInput ? searchInput.value : "");
    const profileRaw = clean(profileInput ? profileInput.value : "");
    const query = lower(queryRaw);
    const profile = lower(profileRaw);
    let visibleCount = 0;

    cards.forEach((card) => {
      const title = getCardTitle(card);
      const recipeProfile = getCardProfile(card);
      const matchesQuery =
        !query || title.includes(query) || recipeProfile.includes(query);
      const matchesProfile = !profile || recipeProfile === profile;
      const visible = matchesQuery && matchesProfile;

      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (gridEl) gridEl.hidden = visibleCount === 0;
    if (emptyStateEl) emptyStateEl.hidden = visibleCount !== 0;
    if (emptyTextEl) {
      emptyTextEl.textContent =
        queryRaw || profileRaw
          ? "Aucun resultat ne correspond aux filtres actuels."
          : "Votre catalogue est vide pour le moment.";
    }
    if (subtitleEl) subtitleEl.textContent = buildSubtitle(visibleCount, queryRaw, profileRaw);
    if (resetLink) resetLink.hidden = !(queryRaw || profileRaw);

    if (activeCard && activeCard.hidden) hidePopup();
  }

  function initLiveFiltering() {
    // Recherche dynamique avec debounce pour éviter un recalcul à chaque frappe
    if (!searchForm || !searchInput || !profileInput) return;

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

    applyFilters();
  }

  initLiveFiltering();

  cards.forEach((card) => {
    card.addEventListener("mouseenter", () => {
      scheduleShow(card);
    });

    card.addEventListener("mouseleave", (event) => {
      clearShowTimer();
      const next = event.relatedTarget;
      if (next && popup.contains(next)) return;
      scheduleHide();
    });

    card.addEventListener("focusin", () => {
      clearShowTimer();
      showPopup(card);
    });

    card.addEventListener("focusout", (event) => {
      const next = event.relatedTarget;
      if (next && popup.contains(next)) return;
      scheduleHide(0);
    });
  });

  popup.addEventListener("mouseenter", () => {
    clearShowTimer();
    clearHideTimer();
  });

  popup.addEventListener("mouseleave", (event) => {
    const next = event.relatedTarget;
    if (next && activeCard && activeCard.contains(next)) return;
    scheduleHide(0);
  });

  listRoot.addEventListener("mousemove", (event) => {
    scheduleShowFromTarget(event.target);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hidePopup();
  });

  window.addEventListener("focus", () => {
    window.setTimeout(syncHoverStateAfterFocus, 30);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearShowTimer();
      return;
    }
    window.setTimeout(syncHoverStateAfterFocus, 30);
  });

  window.addEventListener("scroll", requestReposition, true);
  window.addEventListener("resize", requestReposition);
})();
