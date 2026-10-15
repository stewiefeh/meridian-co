/* =============================================================
   MERIDIAN & CO. - site behaviour
   Theme, nav, reveals, coastline drawing, coordinate readout,
   collection filtering, form validation, toasts.
   Vanilla JS. Honours prefers-reduced-motion throughout.
   ============================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Theme: daylight survey / night passage ---------- */
  var THEME_KEY = "meridian-theme";
  var root = document.documentElement;

  function applyTheme(theme) {
    if (theme === "night") {
      root.setAttribute("data-theme", "night");
    } else {
      root.removeAttribute("data-theme");
    }
    var toggles = document.querySelectorAll(".theme-toggle");
    toggles.forEach(function (btn) {
      var label = btn.querySelector(".toggle-label");
      if (label) {
        label.textContent = theme === "night" ? "Daylight" : "Night";
      }
      btn.setAttribute("aria-pressed", theme === "night" ? "true" : "false");
    });
  }

  var stored = null;
  try { stored = localStorage.getItem(THEME_KEY); } catch (e) { /* private mode */ }
  applyTheme(stored === "night" ? "night" : "daylight");

  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "night" ? "daylight" : "night";
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
      announce(next === "night" ? "Night passage theme on" : "Daylight survey theme on");
    });
  });

  /* ---------- Mobile navigation ---------- */
  var navToggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.focus();
      }
    });
  }

  /* ---------- Entrances: staggered reveals ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  /* Give siblings in the same parent an index for stagger */
  var groups = new Map();
  revealEls.forEach(function (el) {
    var parent = el.parentElement;
    var n = groups.get(parent) || 0;
    if (!el.style.getPropertyValue("--i")) {
      el.style.setProperty("--i", n);
    }
    groups.set(parent, n + 1);
  });

  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Coastline drawing: measure, then draw ---------- */
  document.querySelectorAll(".coast-svg path").forEach(function (path, i) {
    try {
      var len = Math.ceil(path.getTotalLength()) + 4;
      path.style.setProperty("--path-length", len);
      path.style.setProperty("--i", i);
      if (reduceMotion.matches) {
        path.style.strokeDashoffset = "0";
      } else {
        path.classList.add("drawn");
      }
    } catch (e) {
      path.style.strokeDashoffset = "0";
    }
  });

  /* Route paths on map plates draw when scrolled into view */
  if ("IntersectionObserver" in window) {
    var routeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var paths = entry.target.querySelectorAll(".route-draw");
        paths.forEach(function (p, i) {
          try {
            var len = Math.ceil(p.getTotalLength()) + 4;
            p.style.strokeDasharray = len;
            p.style.strokeDashoffset = len;
            p.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.22,0.61,0.21,1) " + (i * 260) + "ms";
            requestAnimationFrame(function () {
              p.style.strokeDashoffset = "0";
            });
          } catch (e) { /* leave static */ }
        });
        routeObserver.unobserve(entry.target);
      });
    }, { threshold: 0.35 });
    document.querySelectorAll("[data-draw-routes]").forEach(function (el) {
      routeObserver.observe(el);
    });
  }

  /* ---------- Live coordinate readout in the hero ---------- */
  var coordOut = document.querySelector(".hero-coords .live");
  var hero = document.querySelector(".hero");
  if (coordOut && hero && !reduceMotion.matches) {
    var frame = 0;
    hero.addEventListener("pointermove", function (e) {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        var r = hero.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width;
        var ny = (e.clientY - r.top) / r.height;
        var lat = 54.0 + (0.5 - ny) * 2.4;
        var lon = -1.2 + (nx - 0.5) * 3.6;
        coordOut.textContent =
          Math.abs(lat).toFixed(3) + "\u00B0" + (lat >= 0 ? "N" : "S") +
          "  " +
          Math.abs(lon).toFixed(3) + "\u00B0" + (lon >= 0 ? "E" : "W");
      });
    });
    hero.addEventListener("pointerleave", function () {
      coordOut.textContent = "54\u00B012'N  001\u00B0W";
    });
  }

  /* ---------- Collection filtering ---------- */
  var filterBar = document.querySelector(".filter-bar");
  var plateGrid = document.querySelector("[data-plate-grid]");
  if (filterBar && plateGrid) {
    var chips = filterBar.querySelectorAll(".chip");
    var plates = Array.prototype.slice.call(plateGrid.querySelectorAll(".plate-wrap"));
    var empty = plateGrid.querySelector(".empty-state");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        var tag = chip.getAttribute("data-filter");
        var shown = 0;
        plates.forEach(function (wrap) {
          var tags = (wrap.getAttribute("data-tags") || "").split(" ");
          var show = tag === "all" || tags.indexOf(tag) !== -1;
          wrap.hidden = !show;
          if (show) shown++;
        });
        if (empty) empty.hidden = shown !== 0;
        announce(shown + " plates shown");
      });
    });
  }

  /* ---------- Demo forms: validation + honest disclosure ---------- */
  document.querySelectorAll("form[data-demo-form]").forEach(function (form) {
    form.setAttribute("novalidate", "");
    var status = form.querySelector(".form-status");
    function setError(field, message) {
      var wrap = field.closest(".field");
      if (!wrap) return;
      var out = wrap.querySelector(".field-error");
      field.setAttribute("aria-invalid", "true");
      if (out) out.textContent = message;
      field.setAttribute("aria-describedby", out ? out.id || "" : "");
      if (out && !out.id) out.id = "err-" + Math.random().toString(36).slice(2, 8);
      if (out) field.setAttribute("aria-describedby", out.id);
    }
    function clearError(field) {
      var wrap = field.closest(".field");
      field.removeAttribute("aria-invalid");
      if (wrap) {
        var out = wrap.querySelector(".field-error");
        if (out) out.textContent = "";
      }
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = 0;
      form.querySelectorAll("[required]").forEach(function (field) {
        var val = (field.value || "").trim();
        if (!val) {
          setError(field, "Required for the survey");
          bad++;
        } else if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          setError(field, "That address will not reach a mailbox");
          bad++;
        } else {
          clearError(field);
        }
      });
      if (bad > 0) {
        var firstBad = form.querySelector("[aria-invalid='true']");
        if (firstBad) firstBad.focus();
        announce("Form has " + bad + " field" + (bad === 1 ? "" : "s") + " to fix", true);
        return;
      }
      var btn = form.querySelector("button[type='submit']");
      if (btn) btn.setAttribute("aria-busy", "true");
      window.setTimeout(function () {
        if (btn) btn.removeAttribute("aria-busy");
        if (status) {
          status.textContent = "";
          status.setAttribute("role", "status");
          status.textContent = "Logged in the daybook. This is a demonstration form: nothing was sent, and no correspondence will follow.";
        }
        announce("Demo form accepted. Nothing was sent.");
        form.reset();
      }, 700);
    });
  });

  /* ---------- Toasts + live region ---------- */
  var toastRegion = document.querySelector(".toast-region");
  if (!toastRegion && document.body) {
    toastRegion = document.createElement("div");
    toastRegion.className = "toast-region";
    toastRegion.setAttribute("aria-live", "polite");
    document.body.appendChild(toastRegion);
  }
  function announce(message, isError) {
    if (!toastRegion) return;
    var toast = document.createElement("div");
    toast.className = "toast" + (isError ? " error" : "");
    toast.textContent = message;
    toastRegion.appendChild(toast);
    window.setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 240ms";
      window.setTimeout(function () { toast.remove(); }, 260);
    }, 3600);
  }

  /* ---------- Copy-to-clipboard contact ---------- */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          announce("Copied: " + text);
        }, function () {
          announce("Copy failed. The address is " + text, true);
        });
      } else {
        announce("Copy unavailable. The address is " + text, true);
      }
    });
  });

  /* ---------- Masthead shadow on scroll ---------- */
  var masthead = document.querySelector(".masthead");
  if (masthead) {
    var onScroll = function () {
      masthead.style.borderBottomColor =
        window.scrollY > 8 ? "var(--rule-strong)" : "var(--rule)";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Footer year (never stale) ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Compass needle: settle north on load ---------- */
  var needle = document.querySelector(".compass .needle");
  if (needle && !reduceMotion.matches) {
    needle.style.transformOrigin = "50% 50%";
    needle.style.transition = "transform 2.2s cubic-bezier(0.22,0.61,0.21,1)";
    requestAnimationFrame(function () {
      needle.style.transform = "rotate(" + (Math.random() * 6 - 3) + "deg)";
    });
  }


  /* ---------- Reserve-an-impression buttons (demo) ---------- */
  document.querySelectorAll("[data-reserve]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var plate = btn.getAttribute("data-reserve");
      announce("Interest in " + plate + " noted on this page only. Nothing was sent; the impression, like the house, is fictional.");
    });
  });

  /* ---------- Page-transition safety for reduced motion ---------- */
  if (reduceMotion.matches && "documentTransition" in document) {
    /* view transitions degrade on their own; nothing to do */
  }
})();
