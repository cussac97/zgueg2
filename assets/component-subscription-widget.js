/*
 * Thème « Carte avec interrupteur » pour le widget d'abonnement natif.
 * Transforme les deux onglets (Achat ponctuel / Abonnement) en une carte
 * unique avec un toggle on/off, façon carte du tiroir panier.
 * Ne s'active que si window.ZGUEG_SUB_WIDGET.style === 'toggle'.
 * On ne touche pas à la logique de l'app : on clique simplement le bon
 * onglet natif, l'app met à jour le prix + le selling_plan.
 */
(function () {
  var cfg = window.ZGUEG_SUB_WIDGET || {};
  if (cfg.style !== 'toggle') return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function parseMoney(s) {
    if (!s) return null;
    var m = String(s).replace(/\s/g, '').replace(/[^0-9.,]/g, '');
    // gère "28,00" et "1.234,56" → point décimal
    if (m.indexOf(',') > -1) m = m.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(m);
    return isNaN(n) ? null : n;
  }

  function titleHTML(pct) {
    var t = cfg.title || '';
    if (t.indexOf('[reduction]') > -1) {
      var parts = t.split('[reduction]');
      var red = pct != null ? '<strong>-' + pct + '%</strong>' : '';
      return esc(parts[0]) + red + esc(parts[1] || '');
    }
    return esc(t);
  }

  function discountPct(block) {
    var pr = block.querySelector('input[data-radio-type="selling_plan"]');
    if (!pr) return null;
    var p = parseMoney(pr.getAttribute('data-variant-price'));
    var c = parseMoney(pr.getAttribute('data-variant-compare-at-price'));
    if (p != null && c != null && c > p) return Math.round(((c - p) / c) * 100);
    return null;
  }

  function syncState(el, sub) {
    var on = !!sub.checked;
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-checked', on ? 'true' : 'false');
  }

  function enhanceCard(card) {
    var otp = card.querySelector('.tab_radio[id*="tab_otp"]');
    var sub = card.querySelector('.tab_radio[id*="tab_subscribe"]');
    if (!otp || !sub) return;
    var otpLabel = card.querySelector('label[for="' + otp.id + '"]');
    var subLabel = card.querySelector('label[for="' + sub.id + '"]');
    if (!otpLabel || !subLabel) return;

    if (card.querySelector('.zg-sub-toggle')) {
      syncState(card.querySelector('.zg-sub-toggle'), sub);
      return;
    }

    var block = card.closest('.shopify_subscriptions_app_block') || card;
    var pct = discountPct(block);

    var el = document.createElement('div');
    el.className = 'zg-sub-toggle';
    el.setAttribute('role', 'switch');
    el.setAttribute('tabindex', '0');
    el.innerHTML =
      '<div class="zg-sub-toggle__text">' +
      (cfg.title ? '<span class="zg-sub-toggle__title">' + titleHTML(pct) + '</span>' : '') +
      (cfg.subtitle ? '<span class="zg-sub-toggle__sub">' + esc(cfg.subtitle) + '</span>' : '') +
      '</div>' +
      '<span class="zg-sub-toggle__switch" aria-hidden="true"><span class="zg-sub-toggle__slider"></span></span>';

    function select(radio, label) {
      if (label) label.click();
      // garde-fou : si le clic sur le label n'a pas coché le radio (label masqué),
      // on force l'état et on notifie l'app.
      if (!radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    function toggle() {
      if (sub.checked) {
        select(otp, otpLabel);
      } else {
        select(sub, subLabel);
      }
    }
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    });
    otp.addEventListener('change', function () { syncState(el, sub); });
    sub.addEventListener('change', function () { syncState(el, sub); });

    card.insertBefore(el, card.firstChild);
    syncState(el, sub);
  }

  function enhanceContainer(container) {
    container.querySelectorAll('.toggle_card').forEach(enhanceCard);
  }

  function observe(container) {
    if (container.__zgEnhanced) {
      enhanceContainer(container);
      return;
    }
    container.__zgEnhanced = true;
    enhanceContainer(container);
    // l'app peut re-render le widget (changement de variante, etc.)
    var mo = new MutationObserver(function () { enhanceContainer(container); });
    mo.observe(container, { childList: true, subtree: true });
  }

  function scan() {
    document.querySelectorAll('.shopify_subscriptions_app_container').forEach(observe);
  }

  // Le widget est injecté par l'app de façon différée : on guette son arrivée.
  if (document.body) {
    var bodyMo = new MutationObserver(scan);
    bodyMo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState !== 'loading') scan();
  else document.addEventListener('DOMContentLoaded', scan);
})();
