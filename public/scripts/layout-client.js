// Client-side layout behaviors (moved out of inline HTML to avoid render-blocking)
(function () {
  // Page loader on navigation
  const loader = document.getElementById("page-loader");
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

  function closeMenu() {
    mobileMenu?.classList.add("hidden");
    mobileMenu?.setAttribute("aria-hidden", "true");
    menuBtn?.setAttribute("aria-expanded", "false");
  }

  menuBtn?.addEventListener("click", () => {
    const isHidden = mobileMenu?.classList.toggle("hidden");
    menuBtn.setAttribute("aria-expanded", String(!isHidden));
    mobileMenu?.setAttribute("aria-hidden", String(!!isHidden));
    if (!isHidden) {
      mobileMenu?.scrollIntoView({ block: "nearest" });
    }
  });

  // Escape key closes menu
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

  // Focus trap when menu is open
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

  // Close menu when clicking a link inside it
  mobileMenu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  // Card glow — mouse-tracking radial highlight
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (!prefersReduced) {
    document.querySelectorAll(".card-glow").forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
        card.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
      });
    });
  }

  // Scroll-triggered reveal with auto-stagger
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          if (e.target.classList.contains("reveal-child")) {
            const children = e.target.querySelectorAll(":scope > *");
            children.forEach((child, i) => {
              child.style.transitionDelay = `${i * 80}ms`;
            });
          }
          revealObserver.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
  );
  document
    .querySelectorAll(".reveal, .reveal-child")
    .forEach((el) => revealObserver.observe(el));
})();
