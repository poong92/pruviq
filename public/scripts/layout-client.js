// Client-side layout behaviors
// Supports Astro View Transitions — re-initializes on every page-load event.

// Global listeners (registered once, never duplicated)
function initGlobalListeners() {
  // Page loader on navigation
  document.addEventListener("click", (e) => {
    const loader = document.getElementById("page-loader");
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
  window.addEventListener(
    "scroll",
    () => {
      const nav = document.querySelector("nav");
      nav?.classList.toggle("scrolled", window.scrollY > 10);
    },
    { passive: true },
  );

  // Escape to close mobile menu
  document.addEventListener("keydown", (e) => {
    const mobileMenu = document.getElementById("mobile-menu");
    const menuBtn = document.getElementById("mobile-menu-btn");
    if (
      e.key === "Escape" &&
      mobileMenu &&
      !mobileMenu.classList.contains("hidden")
    ) {
      mobileMenu.classList.add("hidden");
      mobileMenu.setAttribute("aria-hidden", "true");
      menuBtn?.setAttribute("aria-expanded", "false");
      menuBtn?.focus();
    }
  });
}

// Element-specific listeners (re-registered on every page-load)
function initPageElements() {
  const loader = document.getElementById("page-loader");
  loader?.classList.remove("loading");

  const menuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (menuBtn && mobileMenu) {
    function closeMenu() {
      mobileMenu.classList.add("hidden");
      mobileMenu.setAttribute("aria-hidden", "true");
      menuBtn.setAttribute("aria-expanded", "false");
    }

    menuBtn.addEventListener("click", () => {
      const isHidden = mobileMenu.classList.toggle("hidden");
      menuBtn.setAttribute("aria-expanded", String(!isHidden));
      mobileMenu.setAttribute("aria-hidden", String(!!isHidden));
      if (!isHidden) {
        mobileMenu.scrollIntoView({ block: "nearest" });
      }
    });

    mobileMenu.addEventListener("keydown", (e) => {
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

    mobileMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        closeMenu();
      });
    });
  }
}

function initInteractions() {
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // Card glow — mouse-tracking radial highlight
  if (!prefersReduced) {
    document.querySelectorAll(".card-glow").forEach((card) => {
      if (card.dataset.glowInit) return;
      card.dataset.glowInit = "1";
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
  document.querySelectorAll(".reveal, .reveal-child").forEach((el) => {
    if (!el.classList.contains("visible")) {
      revealObserver.observe(el);
    }
  });

  // Card 3D tilt on hover (desktop only)
  if (!prefersReduced && window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".card-tilt").forEach((card) => {
      if (card.dataset.tiltInit) return;
      card.dataset.tiltInit = "1";
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) translateY(-2px)`;
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
      });
    });
  }
}

// First load — global listeners once
initGlobalListeners();
initPageElements();
initInteractions();

// Re-init on Astro View Transition page swap
document.addEventListener("astro:page-load", () => {
  initPageElements();
  initInteractions();
});
