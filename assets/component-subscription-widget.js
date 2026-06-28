/*
 * Thème « Carte avec interrupteur » pour le widget d'abonnement natif.
 * - Transforme les deux onglets (Achat ponctuel / Abonnement) en une carte
 *   unique avec un toggle on/off (façon carte du tiroir panier).
 * - Option « abonnement par défaut ».
 * - Met à jour dynamiquement les prix affichés (bloc prix + cartes de
 *   variantes) avec la réduction d'abonnement quand le toggle est ON.
 * On ne touche pas à la logique de l'app : on clique le bon onglet natif,
 * l'app gère le prix interne + le selling_plan. Le reste (prix du thème)
 * est synchronisé ici à partir de window.ZGUEG_SUB_PRICES.
 */
(function () {
  var cfg = window.ZGUEG_SUB_WIDGET || {};
  if (cfg.style !== 'toggle') return;

  var PRICES = window.ZGUEG_SUB_PRICES || {};
  var defaultApplied = false;

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

  /* -------- Synchro des prix du thème -------- */

  function isSubscribed() {
    return !!document.querySelector(
      '.shopify_subscriptions_app_block:not(.shopify_subscriptions_app_block--hidden) .tab_radio[id*="tab_subscribe"]:checked'
    );
  }

  function applyCardPrices(on) {
    document.querySelectorAll('.vb-card').forEach(function (card) {
      var input = card.querySelector('input[data-variant-id]');
      if (!input) return;
      var m = PRICES[input.getAttribute('data-variant-id')];
      if (!m) return;
      var nowEl = card.querySelector('.vb-card__price-now');
      var priceWrap = card.querySelector('.vb-card__price');
      if (!nowEl || !priceWrap) return;

      if (on) {
        if (nowEl.getAttribute('data-zg-orig') == null) {
          nowEl.setAttribute('data-zg-orig', nowEl.textContent);
        }
        nowEl.textContent = m.now;
        var was = priceWrap.querySelector('.zg-sub-was');
        if (!was) {
          was = document.createElement('s');
          was.className = 'vb-card__price-was zg-sub-was';
          priceWrap.appendChild(was);
        }
        was.textContent = m.was;
      } else {
        if (nowEl.getAttribute('data-zg-orig') != null) {
          nowEl.textContent = nowEl.getAttribute('data-zg-orig');
          nowEl.removeAttribute('data-zg-orig');
        }
        var injected = priceWrap.querySelector('.zg-sub-was');
        if (injected) injected.remove();
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
    document.querySelectorAll('.main-product-price .product-price--original').forEach(function (orig) {
      if (on && m) {
        if (orig.getAttribute('data-zg-html') == null) {
          orig.setAttribute('data-zg-html', orig.innerHTML);
        }
        orig.innerHTML =
          '<span class="zg-sub-price">' + esc(m.now) + '</span>' +
          ' <del class="zg-sub-price-was">' + esc(m.was) + '</del>';
      } else {
        if (orig.getAttribute('data-zg-html') != null) {
          orig.innerHTML = orig.getAttribute('data-zg-html');
          orig.removeAttribute('data-zg-html');
        }
      }
    });
  }

  function refreshPrices() {
    try {
      var on = isSubscribed();
      applyCardPrices(on);
      applyMainPrice(on);
    } catch (e) {}
  }

  /* -------- Carte toggle -------- */

  function syncState(el, sub) {
    var on = !!sub.checked;
    el.classList.toggle('is-on', on);
    el.setAttribute('aria-checked', on ? 'true' : 'false');
    refreshPrices();
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

    var existing = card.querySelector('.zg-sub-toggle');
    if (existing) {
      syncState(existing, sub);
      maybeDefault(visible, sub, subLabel);
      return;
    }

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
      if (!radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    function toggle() {
      if (sub.checked) select(otp, otpLabel);
      else select(sub, subLabel);
    }
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    });
    otp.addEventListener('change', function () { syncState(el, sub); });
    sub.addEventListener('change', function () { syncState(el, sub); });

    card.insertBefore(el, card.firstChild);
    syncState(el, sub);
    maybeDefault(visible, sub, subLabel);
  }

  function maybeDefault(visible, sub, subLabel) {
    if (cfg.defaultSubscription && !defaultApplied && visible && !sub.checked) {
      defaultApplied = true;
      subLabel.click();
      if (!sub.checked) {
        sub.checked = true;
        sub.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  function enhanceContainer(container) {
    container.querySelectorAll('.toggle_card').forEach(enhanceCard);
  }

  function observe(container) {
    if (!container.__zgEnhanced) {
      container.__zgEnhanced = true;
      var mo = new MutationObserver(function () { enhanceContainer(container); });
      mo.observe(container, { childList: true, subtree: true });
    }
    enhanceContainer(container);
  }

  function scan() {
    document.querySelectorAll('.shopify_subscriptions_app_container').forEach(observe);
    refreshPrices();
  }

  var debounce;
  if (document.body) {
    new MutationObserver(function () {
      scan();
      clearTimeout(debounce);
      debounce = setTimeout(refreshPrices, 60);
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState !== 'loading') scan();
  else document.addEventListener('DOMContentLoaded', scan);
})();
