(() => {
  "use strict";

  // ----------------------------
  // Helpers
  // ----------------------------
  const root = document.documentElement;
  const themeBtn = document.getElementById("themeToggle");
  const themeIcon = themeBtn ? themeBtn.querySelector(".theme-icon") : null;

  const hasGSAP = () => typeof window.gsap !== "undefined";
  const gsap = () => window.gsap;

  const reduceMotion = () =>
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const qAnim = (name) => document.querySelector(`[data-anim="${name}"]`);
  const qAnimAll = (name) =>
    Array.from(document.querySelectorAll(`[data-anim="${name}"]`));
  const compact = (arr) => arr.filter(Boolean);

  // ----------------------------
  // Recipe list hover card (GSAP API)
  // ----------------------------
  function setPopupVisibleState(panel, isVisible) {
    if (!panel) return;
    panel.hidden = !isVisible;
    panel.setAttribute("aria-hidden", String(!isVisible));
  }

  const recipeListPopupAnimations = {
    show(panel) {
      if (!panel) return;

      if (reduceMotion() || !hasGSAP()) {
        panel.style.opacity = "1";
        panel.style.transform = "none";
        return;
      }

      const placement = panel.getAttribute("data-placement") || "right";
      const fromX = placement === "right" ? -34 : 34;
      const fromRotate = placement === "right" ? -2.4 : 2.4;

      gsap().killTweensOf(panel);
      gsap().set(panel, {
        autoAlpha: 0,
        x: fromX,
        y: 8,
        scale: 0.86,
        rotate: fromRotate,
        filter: "blur(4px)",
        transformOrigin: placement === "right" ? "0% 50%" : "100% 50%",
      });

      const tl = gsap().timeline();
      tl.to(panel, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1.03,
        rotate: 0,
        filter: "blur(0px)",
        duration: 0.34,
        ease: "expo.out",
      }).to(panel, {
        scale: 1,
        duration: 0.14,
        ease: "power2.out",
      }, "-=0.05");
    },

    hide(panel, onComplete) {
      if (!panel) {
        if (typeof onComplete === "function") onComplete();
        return;
      }

      const finish = () => {
        if (hasGSAP()) {
          gsap().set(panel, { clearProps: "opacity,transform,visibility,filter" });
        } else {
          panel.style.removeProperty("opacity");
          panel.style.removeProperty("transform");
          panel.style.removeProperty("filter");
        }
        setPopupVisibleState(panel, false);
        if (typeof onComplete === "function") onComplete();
      };

      if (panel.hidden || panel.getAttribute("aria-hidden") === "true") {
        finish();
        return;
      }

      if (reduceMotion() || !hasGSAP()) {
        finish();
        return;
      }

      gsap().killTweensOf(panel);
      gsap().to(panel, {
        autoAlpha: 0,
        x: panel.getAttribute("data-placement") === "right" ? -20 : 20,
        y: 4,
        scale: 0.9,
        rotate: panel.getAttribute("data-placement") === "right" ? -1.2 : 1.2,
        filter: "blur(2px)",
        duration: 0.24,
        ease: "power3.in",
        onComplete: finish,
      });
    },
  };

  // Rendu accessible depuis recipe_list.js (show/hide de la pancarte)
  window.recipeListPopupAnimations = recipeListPopupAnimations;

  // ----------------------------
  // Theme (apply + icon)
  // ----------------------------
  function getPreferredTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;

    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    return prefersDark ? "dark" : "light";
  }

  function setThemeClasses(theme) {
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
    root.setAttribute("data-theme", theme);
  }

  function setToggleAria(theme) {
    if (!themeBtn) return;
    themeBtn.setAttribute(
      "aria-label",
      theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre"
    );
  }

  function setIcon(theme) {
    if (!themeIcon) return;
    themeIcon.classList.remove("fa-moon", "fa-sun");
    themeIcon.classList.add(theme === "dark" ? "fa-sun" : "fa-moon");

    // sécurité : garder l’icône bien "droite"
    if (hasGSAP())
      gsap().set(themeIcon, { rotate: 0, transformOrigin: "50% 50%" });
    else themeIcon.style.transform = "rotate(0deg)";
  }

  function applyTheme(theme, animate = false) {
    const rm = reduceMotion();

    // transition CSS uniquement quand l'utilisateur clique
    if (animate && !rm) {
      root.classList.add("theme-switching");
      window.setTimeout(() => root.classList.remove("theme-switching"), 360);
    }

    setThemeClasses(theme);
    setToggleAria(theme);

    // animation d’icône uniquement au clic et si GSAP dispo
    if (!animate || rm || !hasGSAP() || !themeBtn || !themeIcon) {
      setIcon(theme);
      return;
    }

    const brandMark = document.querySelector(".brand-mark");
    const logoCard = document.querySelector(".logo-card");
    const heroLogo = document.querySelector(".logo-hero");

    const tl = gsap().timeline();
    gsap().set(themeIcon, { rotate: 0, transformOrigin: "50% 50%" });

    tl.to(themeBtn, { scale: 0.96, duration: 0.12, ease: "power2.out" }, 0)
      .to(themeIcon, { rotate: 180, duration: 0.22, ease: "power2.out" }, 0)
      .add(() => setIcon(theme), 0.11)
      .to(themeIcon, { rotate: 360, duration: 0.22, ease: "power2.out" }, 0.22)
      .to(themeIcon, { rotate: 0, duration: 0.001 }, 0.44)
      .to(themeBtn, { scale: 1, duration: 0.18, ease: "power2.out" }, 0.10)
      .fromTo(
        compact([brandMark, heroLogo]),
        { scale: 0.99, y: -1 },
        { scale: 1, y: 0, duration: 0.35, ease: "power2.out" },
        0.02
      )
      .fromTo(
        logoCard ? [logoCard] : [],
        { scale: 0.995 },
        { scale: 1, duration: 0.45, ease: "power2.out" },
        0.02
      );
  }

  function toggleTheme() {
    if (root.classList.contains("theme-switching")) return;

    const current = root.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    applyTheme(next, true);
  }

  // Init theme
  applyTheme(getPreferredTheme(), false);
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

  // ----------------------------
  // Mobile nav overlay (GSAP)
  // ----------------------------
  const navToggle = document.getElementById("navToggle");
  const overlay = document.getElementById("mobileNavOverlay");
  const panel = document.getElementById("mobileNavPanel");
  const backdrop = document.getElementById("mobileNavBackdrop");
  const closeBtn = document.getElementById("mobileNavClose");

  let navTl = null;

  function setOpen(isOpen) {
    if (!overlay || !navToggle) return;
    navToggle.setAttribute("aria-expanded", String(isOpen));
    overlay.hidden = !isOpen;
    overlay.setAttribute("aria-hidden", String(!isOpen));
    document.body.classList.toggle("no-scroll", isOpen);
  }

  function openNav() {
    if (!overlay || !panel) return;
    setOpen(true);

    // réutilise les helpers
    if (reduceMotion() || !hasGSAP()) return;

    if (!navTl) {
      navTl = gsap().timeline({ paused: true });
      navTl
        .fromTo(
          backdrop,
          { opacity: 0 },
          { opacity: 1, duration: 0.18, ease: "power1.out" },
          0
        )
        .fromTo(
          panel,
          { x: 40, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.28, ease: "power2.out" },
          0
        );
    }

    navTl.play(0);
    if (closeBtn) setTimeout(() => closeBtn.focus(), 0);

    // Stagger des liens
    const links = panel.querySelectorAll(".mobile-nav-links .nav-link");
    gsap().killTweensOf(links);
    gsap().set(links, { clearProps: "opacity,transform" });
    gsap().fromTo(
      links,
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.22, stagger: 0.05, ease: "power2.out" }
    );
  }

  function closeNav() {
    if (!overlay || !panel) return;

    const finish = () => setOpen(false);

    // réutilise les helpers
    if (reduceMotion() || !hasGSAP() || !navTl) {
      finish();
      return;
    }

    // reset des liens avant la fermeture pour repartir clean
    const links = panel.querySelectorAll(".mobile-nav-links .nav-link");
    gsap().killTweensOf(links);
    gsap().set(links, { clearProps: "opacity,transform" });

    navTl.eventCallback("onReverseComplete", finish);
    navTl.reverse();
  }

  if (navToggle && overlay && panel && backdrop && closeBtn) {
    setOpen(false);

    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      isOpen ? closeNav() : openNav();
    });

    backdrop.addEventListener("click", closeNav);
    closeBtn.addEventListener("click", closeNav);

    // ferme au clic sur un lien
    overlay.addEventListener("click", (e) => {
      if (e.target && e.target.tagName === "A") closeNav();
    });

    // ESC pour fermer
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        navToggle.getAttribute("aria-expanded") === "true"
      ) {
        closeNav();
      }
    });

    // si on repasse en desktop, on ferme le menu
    const mq = window.matchMedia("(min-width: 881px)");
    mq.addEventListener("change", (e) => {
      if (e.matches) closeNav();
    });
  }

  // ----------------------------
  // GSAP: entrance animations + breathe
  // ----------------------------
  if (reduceMotion() || !hasGSAP()) return;

  // Recette list page: focus d'abord sur la recherche/filtre, puis cartes en "pop"
  const recipeListSection = document.querySelector(".recipe-list");
  if (recipeListSection) {
    const recipeHeader = recipeListSection.querySelector(".recipe-list__header");
    const recipeSearchInput = recipeListSection.querySelector(".recipe-list__search-input");
    const recipeProfileFilter = recipeListSection.querySelector(".recipe-list__filter-wrap");
    const recipeResetLink = recipeListSection.querySelector(".recipe-list__reset:not([hidden])");
    const recipeCards = Array.from(recipeListSection.querySelectorAll(".recipe-card"));
    const recipeEmptyState = recipeListSection.querySelector(".recipe-empty:not([hidden])");

    const searchFirst = compact([
      recipeHeader,
      recipeSearchInput,
      recipeProfileFilter,
      recipeResetLink,
    ]);

    gsap().set(searchFirst, { autoAlpha: 0, y: 12 });
    gsap().set(recipeCards, {
      autoAlpha: 0,
      y: 16,
      scale: 0.96,
      transformOrigin: "50% 50%",
    });
    if (recipeEmptyState) gsap().set(recipeEmptyState, { autoAlpha: 0, y: 12 });

    const listTl = gsap().timeline({ defaults: { ease: "power2.out" } });
    // UX: on montre d'abord la recherche/filtre, puis les cartes en "pop"
    listTl.to(searchFirst, {
      autoAlpha: 1,
      y: 0,
      duration: 0.42,
      stagger: 0.08,
    });

    if (recipeCards.length) {
      listTl.to(
        recipeCards,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.44,
          stagger: 0.05,
          ease: "back.out(1.55)",
        },
        "-=0.08"
      );
    } else if (recipeEmptyState) {
      listTl.to(
        recipeEmptyState,
        { autoAlpha: 1, y: 0, duration: 0.42 },
        "-=0.08"
      );
    }

    listTl.eventCallback("onComplete", () => {
      const toClear = compact([
        ...searchFirst,
        ...recipeCards,
        recipeEmptyState,
      ]);
      gsap().set(toClear, { clearProps: "opacity,transform,visibility" });
    });

    return;
  }

  // Recipe detail page: en-tête puis sections en cascade
  const recipeDetailSection = document.querySelector(".recipe-detail");
  if (recipeDetailSection) {
    const detailBack = recipeDetailSection.querySelector(".recipe-detail__back");
    const detailHero = recipeDetailSection.querySelector(".recipe-detail__hero");
    const detailSections = Array.from(
      recipeDetailSection.querySelectorAll(".recipe-detail__section")
    );
    const detailEmpty = recipeDetailSection.querySelector(".recipe-detail__empty-card");

    const detailIntro = compact([detailBack, detailHero]);

    gsap().set(detailIntro, { autoAlpha: 0, y: 12 });
    gsap().set(detailSections, {
      autoAlpha: 0,
      y: 16,
      scale: 0.985,
      transformOrigin: "50% 50%",
    });
    if (detailEmpty) gsap().set(detailEmpty, { autoAlpha: 0, y: 12 });

    const detailTl = gsap().timeline({ defaults: { ease: "power2.out" } });

    detailTl.to(detailIntro, {
      autoAlpha: 1,
      y: 0,
      duration: 0.42,
      stagger: 0.08,
    });

    if (detailSections.length) {
      detailTl.to(
        detailSections,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.44,
          stagger: 0.07,
          ease: "back.out(1.45)",
        },
        "-=0.08"
      );
    } else if (detailEmpty) {
      detailTl.to(detailEmpty, { autoAlpha: 1, y: 0, duration: 0.40 }, "-=0.06");
    }

    detailTl.eventCallback("onComplete", () => {
      const toClear = compact([...detailIntro, ...detailSections, detailEmpty]);
      gsap().set(toClear, { clearProps: "opacity,transform,visibility" });
    });

    return;
  }

  // Recipe form page: header, cartes principales, actions
  const recipeFormPage = document.querySelector(".recipe-form-page");
  if (recipeFormPage) {
    const formHeader = recipeFormPage.querySelector(".recipe-form-header");
    const formCards = Array.from(recipeFormPage.querySelectorAll(".recipe-form > .rf-card"));
    const formActions = recipeFormPage.querySelector(".rf-actions");

    const formIntro = compact([formHeader]);
    const formTail = compact([formActions]);

    gsap().set(formIntro, { autoAlpha: 0, y: 10 });
    gsap().set(formCards, {
      autoAlpha: 0,
      y: 16,
      scale: 0.985,
      transformOrigin: "50% 50%",
    });
    gsap().set(formTail, { autoAlpha: 0, y: 10 });

    const formTl = gsap().timeline({ defaults: { ease: "power2.out" } });

    formTl.to(formIntro, {
      autoAlpha: 1,
      y: 0,
      duration: 0.40,
    });

    if (formCards.length) {
      formTl.to(
        formCards,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.42,
          stagger: 0.08,
          ease: "back.out(1.45)",
        },
        "-=0.04"
      );
    }

    formTl.to(
      formTail,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.36,
      },
      "-=0.08"
    );

    formTl.eventCallback("onComplete", () => {
      const toClear = compact([...formIntro, ...formCards, ...formTail]);
      gsap().set(toClear, { clearProps: "opacity,transform,visibility" });
    });

    return;
  }

  const t = {
    heroLeft: qAnim("hero-left"),
    heroRight: qAnim("hero-right"),
    title: qAnim("title"),
    subtitle: qAnim("subtitle"),
    cta: qAnim("cta"),
    metrics: qAnim("metrics"),

    logoCard: qAnim("logo-card"),
    caption: qAnim("caption"),

    featuresTitle: qAnim("features-title"),
    featureCards: qAnimAll("feature-card"),
  };

  if (!t.heroLeft && !t.title) return;

  const introLeft = compact([t.title, t.subtitle, t.cta, t.metrics]);
  const introRight = compact([t.heroRight, t.caption]);

  // états init
  gsap().set(introLeft, { autoAlpha: 0, y: 12 });
  gsap().set(introRight, { autoAlpha: 0, y: 10 });
  if (t.heroLeft) gsap().set(t.heroLeft, { y: 10 });
  if (t.logoCard) gsap().set(t.logoCard, { autoAlpha: 0, y: 10, scale: 0.985 });

  const tl = gsap().timeline({ defaults: { ease: "power2.out" } });

  tl.to(t.heroLeft ? [t.heroLeft] : [], { y: 0, duration: 0.50 }, 0)
    .to(
      introLeft,
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.55,
        stagger: 0.09,
        immediateRender: false,
      },
      0.05
    )
    .to(t.heroRight ? [t.heroRight] : [], { y: 0, autoAlpha: 1, duration: 0.55 }, 0.08)
    .to(t.logoCard ? [t.logoCard] : [], { autoAlpha: 1, y: 0, scale: 1, duration: 0.55 }, 0.15)
    .to(t.caption ? [t.caption] : [], { autoAlpha: 1, y: 0, duration: 0.45 }, 0.22);

  if (t.featuresTitle) {
    tl.fromTo(
      t.featuresTitle,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.45 },
      0.35
    );
  }

  if (t.featureCards.length) {
    tl.fromTo(
      t.featureCards,
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.12 },
      0.40
    );
  }

  // nettoyage des styles inline après animation pour éviter les conflits avec le responsive ou d’autres interactions
  tl.eventCallback("onComplete", () => {
    const toClear = compact([
      t.heroLeft,
      t.heroRight,
      ...introLeft,
      ...introRight,
      t.featuresTitle,
      ...t.featureCards,
    ]).filter((el) => el !== t.logoCard);

    gsap().set(toClear, { clearProps: "opacity,transform,visibility" });
    if (t.logoCard) gsap().set(t.logoCard, { clearProps: "opacity,visibility" });
  });

  // effet de respiration
  if (t.logoCard) {
    gsap().to(t.logoCard, {
      rotate: 1.0,
      y: -3,
      duration: 5.8,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  }
})();
