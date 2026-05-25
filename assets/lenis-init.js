/*
 * Smooth scroll initialization (Lenis).
 * Loaded only when the "Smooth scroll" setting is enabled in
 * Theme settings > Décorations. Mirrors the smooth scrolling used on
 * coterie.com, which relies on the Lenis library.
 *
 * Behaviour is driven by `window.lenisSettings`, populated from the
 * theme settings in layout/theme.liquid.
 */
(function () {
  // Respect users who asked the OS to reduce motion.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof Lenis === 'undefined') return;

  var opts = window.lenisSettings || {};

  function number(value, fallback) {
    return typeof value === 'number' && !isNaN(value) ? value : fallback;
  }

  var lenis = new Lenis({
    lerp: number(opts.lerp, 0.1),
    smoothWheel: true,
    syncTouch: !!opts.syncTouch,
    wheelMultiplier: number(opts.wheelMultiplier, 1),
    touchMultiplier: number(opts.touchMultiplier, 1.5),
  });

  // Expose the instance so other scripts can pause/resume it if needed
  // (e.g. when a drawer or modal opens).
  window.lenis = lenis;

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Smooth-scroll same-page anchor links (opt-out via the theme setting).
  if (opts.smoothAnchors !== false) {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;
      var hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      var target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target);
    });
  }
})();
