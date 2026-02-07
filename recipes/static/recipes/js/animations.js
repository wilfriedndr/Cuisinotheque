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
    if (hasGSAP()) gsap().set(themeIcon, { rotate: 0, transformOrigin: "50% 50%" });
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
  // GSAP: entrance animations + breathe
  // ----------------------------
  if (reduceMotion() || !hasGSAP()) return;

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
      { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.09, immediateRender: false },
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
