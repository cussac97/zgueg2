/*
 * Thème « Carte avec interrupteur » pour le widget d'abonnement natif.
 * - Onglets natifs (Achat ponctuel / Abonnement) -> carte unique + toggle on/off.
 * - Option « abonnement par défaut ».
 * - Synchro dynamique des prix du thème (bloc prix + cartes de variantes) avec
 *   la réduction d'abonnement quand le toggle est ON.
 *
 * IMPORTANT anti-crash : tout le travail passe par un tick() débouncé qui
 * DÉCONNECTE le MutationObserver pendant qu'il modifie le DOM, puis le
 * reconnecte. Sans ça, nos propres écritures re-déclenchent l'observer en
 * boucle infinie (l'onglet plante, surtout dans l'éditeur). Toutes les
 * écritures sont en plus idempotentes (on n'écrit que si la valeur change).
 */
(function () {
  var cfg = window.ZGUEG_SUB_WIDGET || {};
  var IS_TOGGLE = cfg.style === 'toggle';

  var PRICES = window.ZGUEG_SUB_PRICES || {};
  // Choix abonnement on/off, GLOBAL (indépendant de la variante sélectionnée).
  var wantSub = !!cfg.defaultSubscription;
  var orig = new WeakMap(); // élément -> valeur d'origine (sans muter le DOM)

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function parseMoney(s) {
    if (!s) return null;
    var m = String(s).replace(/\s/g, '').replace(/[^0-9.,]/g, '');
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
  function setText(el, val) {
    if (el && el.textContent !== val) el.textContent = val;
  }

  /* -------- État abonnement -------- */
  function isSubscribed() {
    return !!document.querySelector(
      '.shopify_subscriptions_app_block:not(.shopify_subscriptions_app_block--hidden) .tab_radio[id*="tab_subscribe"]:checked'
    );
  }

  /* -------- Synchro des prix -------- */
  function applyCardPrices(on) {
    document.querySelectorAll('.vb-card').forEach(function (card) {
      var input = card.querySelector('input[data-variant-id]');
      if (!input) return;
      var m = PRICES[input.getAttribute('data-variant-id')];
      if (!m) return;
      var nowEl = card.querySelector('.vb-card__price-now');
      var wrap = card.querySelector('.vb-card__price');
      if (!nowEl || !wrap) return;

      var so = on && m.now; // pas de prix abonné pour cette variante -> on n'override pas
      if (so) {
        if (!orig.has(nowEl)) orig.set(nowEl, nowEl.textContent);
        setText(nowEl, m.now);
        var was = wrap.querySelector('.zg-sub-was');
        if (!was) {
          was = document.createElement('s');
          was.className = 'vb-card__price-was zg-sub-was';
          wrap.appendChild(was);
        }
        setText(was, m.was);
      } else {
        if (orig.has(nowEl)) {
          setText(nowEl, orig.get(nowEl));
          orig['delete'](nowEl);
        }
        var inj = wrap.querySelector('.zg-sub-was');
        if (inj) inj.remove();
      }
    });
  }

  function currentVariantId() {
    var sel = document.querySelector('.vb-card__input:checked[data-variant-id], .product-variant-value:checked[data-variant-id]');
    if (sel) return sel.getAttribute('data-variant-id');
    var idInput = document.querySelector('form[id^="product-form-"] input[name="id"]');
    return idInput ? idInput.value : null;
  }

  function applyMainPrice(on) {
    var vid = currentVariantId();
    var m = vid ? PRICES[vid] : null;
    document.querySelectorAll('.main-product-price .product-price--original').forEach(function (el) {
      if (on && m && m.now) {
        if (!orig.has(el)) orig.set(el, el.innerHTML);
        var html =
          '<span class="zg-sub-price">' + esc(m.now) + '</span>' +
          ' <del class="zg-sub-price-was">' + esc(m.was) + '</del>';
        if (el.__zgSet !== html) {
          el.innerHTML = html;
          el.__zgSet = html;
        }
      } else if (orig.has(el)) {
        var o = orig.get(el);
        if (el.innerHTML !== o) el.innerHTML = o;
        el.__zgSet = null;
        orig['delete'](el);
      }
    });
  }

  // Prix affiché dans le bouton « Ajouter au panier – 27,30 € ».
  // Reflète la variante sélectionnée + l'état abonnement on/off.
  function updateButtonPrice(on) {
    var vid = currentVariantId();
    var m = vid ? PRICES[vid] : null;
    document.querySelectorAll('[data-js-atc-price]').forEach(function (span) {
      var btn = span.closest('button');
      if (!m || (btn && btn.classList.contains('disabled'))) {
        setText(span, '');
        return;
      }
      var price = (on && m.now) ? m.now : m.was;
      setText(span, price ? '– ' + price : '');
    });
  }

  function refreshPrices() {
    var on = isSubscribed();
    applyCardPrices(on);
    applyMainPrice(on);
    updateButtonPrice(on);
  }

  /* -------- Carte toggle -------- */
  function syncState(el, sub) {
    var on = !!sub.checked;
    if (el.classList.contains('is-on') !== on) el.classList.toggle('is-on', on);
    var a = on ? 'true' : 'false';
    if (el.getAttribute('aria-checked') !== a) el.setAttribute('aria-checked', a);
  }

  function selectRadio(radio, label) {
    if (label) label.click();
    if (!radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Le choix abonnement on/off est GLOBAL (window wantSub), pas lié à une
  // variante : on l'applique au bloc visible pour qu'il soit conservé quand on
  // change de variante (chaque variante a son propre bloc natif côté app).
  function enforce(visible, otp, otpLabel, sub, subLabel) {
    if (!visible) return;
    if (wantSub && !sub.checked) selectRadio(sub, subLabel);
    else if (!wantSub && sub.checked) selectRadio(otp, otpLabel);
  }

  function enhanceCard(card) {
    var otp = card.querySelector('.tab_radio[id*="tab_otp"]');
    var sub = card.querySelector('.tab_radio[id*="tab_subscribe"]');
    if (!otp || !sub) return;
    var otpLabel = card.querySelector('label[for="' + otp.id + '"]');
    var subLabel = card.querySelector('label[for="' + sub.id + '"]');
    if (!otpLabel || !subLabel) return;

    var block = card.closest('.shopify_subscriptions_app_block') || card;
    var visible = !block.classList.contains('shopify_subscriptions_app_block--hidden');

    var el = card.querySelector('.zg-sub-toggle');
    if (el) {
      enforce(visible, otp, otpLabel, sub, subLabel);
      syncState(el, sub);
      return;
    }

    var pct = discountPct(block);
    el = document.createElement('div');
    el.className = 'zg-sub-toggle';
    el.setAttribute('role', 'switch');
    el.setAttribute('tabindex', '0');
    el.innerHTML =
      '<div class="zg-sub-toggle__text">' +
      ((cfg.title || cfg.badge) ?
        '<span class="zg-sub-toggle__titlerow">' +
          (cfg.title ? '<span class="zg-sub-toggle__title">' + titleHTML(pct) + '</span>' : '') +
          (cfg.badge ? '<span class="zg-sub-toggle__badge">' + esc(cfg.badge) + '</span>' : '') +
        '</span>'
      : '') +
      (cfg.subtitle ? '<span class="zg-sub-toggle__sub">' + esc(cfg.subtitle) + '</span>' : '') +
      '</div>' +
      '<span class="zg-sub-toggle__switch" aria-hidden="true"><span class="zg-sub-toggle__slider"></span></span>';

    function toggle() {
      wantSub = !sub.checked; // l'utilisateur fixe le choix global
      if (wantSub) selectRadio(sub, subLabel);
      else selectRadio(otp, otpLabel);
    }
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    });
    // Un changement d'onglet (par l'utilisateur ou l'app) reprogramme un tick.
    otp.addEventListener('change', function () { syncState(el, sub); schedule(); });
    sub.addEventListener('change', function () { syncState(el, sub); schedule(); });

    card.insertBefore(el, card.firstChild);
    enforce(visible, otp, otpLabel, sub, subLabel);
    syncState(el, sub);
  }

  /* -------- Boucle de travail (anti-crash) -------- */
  var observer = null;
  var timer = null;

  function work() {
    if (IS_TOGGLE) {
      document.querySelectorAll('.shopify_subscriptions_app_container .toggle_card').forEach(enhanceCard);
    }
    refreshPrices();
  }

  function tick() {
    if (observer) observer.disconnect();
    try { work(); } catch (e) { /* no-op */ }
    finally {
      if (observer && document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(tick, 80);
  }

  if (document.body && 'MutationObserver' in window) {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState !== 'loading') tick();
  else document.addEventListener('DOMContentLoaded', tick);
})();
