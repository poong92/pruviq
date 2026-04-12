// Client-side layout behaviors (moved out of inline HTML to avoid render-blocking)
(function () {
  // Page loader on navigation
  const loader = document.getElementById("page-loader");
  // Reset loader on page load (previous navigation may have left it in loading state)
  loader?.classList.remove("loading");

  document.addEventListener("click", (e) => {
    const el = e.target;
    const link = el && (el.closest ? el.closest("a[href]") : null);
    if (!link) return;
    try {
      if (
        link.href &&
        !link.target &&
        !link.href.startsWith("mailto:") &&
        !link.href.startsWith("tel:") &&
        new URL(link.href).origin === window.location.origin
      ) {
        loader?.classList.add("loading");
      }
    } catch (err) {
      // ignore malformed URLs
    }
  });

  // Nav scroll shadow
  const nav = document.querySelector("nav");
  window.addEventListener(
    "scroll",
    () => {
      nav?.classList.toggle("scrolled", window.scrollY > 10);
    },
    { passive: true },
  );

  const menuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  const mobileBackdrop = document.getElementById("mobile-backdrop");
  const iconOpen = document.getElementById("menu-icon-open");
  const iconClose = document.getElementById("menu-icon-close");

  function openMenu() {
    mobileMenu?.classList.remove("hidden");
    mobileBackdrop?.classList.remove("hidden");
    mobileMenu?.setAttribute("aria-hidden", "false");
    mobileBackdrop?.setAttribute("aria-hidden", "false");
    menuBtn?.setAttribute("aria-expanded", "true");
    iconOpen?.classList.add("hidden");
    iconClose?.classList.remove("hidden");
    // 배경 스크롤 잠금
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    mobileMenu?.classList.add("hidden");
    mobileBackdrop?.classList.add("hidden");
    mobileMenu?.setAttribute("aria-hidden", "true");
    mobileBackdrop?.setAttribute("aria-hidden", "true");
    menuBtn?.setAttribute("aria-expanded", "false");
    iconOpen?.classList.remove("hidden");
    iconClose?.classList.add("hidden");
    // 배경 스크롤 복원
    document.body.style.overflow = "";
  }

  menuBtn?.addEventListener("click", () => {
    const isHidden = mobileMenu?.classList.contains("hidden");
    if (isHidden) openMenu();
    else closeMenu();
  });

  // backdrop 클릭 시 닫기
  mobileBackdrop?.addEventListener("click", closeMenu);

  // Escape 키로 닫기
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      mobileMenu &&
      !mobileMenu.classList.contains("hidden")
    ) {
      closeMenu();
      menuBtn?.focus();
    }
  });

  // Focus trap
  mobileMenu?.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusable = mobileMenu.querySelectorAll("a, button");
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // 링크 클릭 시 닫기
  mobileMenu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // Hide sticky banners when hero section is in viewport (M3)
  const heroSection = document.getElementById("hero-section");
  if (heroSection && window.IntersectionObserver) {
    const hideTargets = document.querySelectorAll("[data-hide-in-hero]");
    if (hideTargets.length > 0) {
      new IntersectionObserver(
        (entries) => {
          const heroVisible = entries[0].isIntersecting;
          hideTargets.forEach((el) => {
            if (heroVisible) {
              el.classList.add("hidden");
            } else {
              el.classList.remove("hidden");
            }
          });
        },
        { threshold: 0.3 },
      ).observe(heroSection);
    }
  }
})();
