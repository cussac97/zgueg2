if ( typeof ModalBox !== 'function' ) {

  class ModalBox extends HTMLElement {

    constructor() {

      window.inertElems = document.querySelectorAll('[data-js-inert]');

      super();
      
			this._prefix = window.KT_PREFIX || '';
      this.o = {
        ...{
          show: 10,
          showOnPageOffset: -1,
          frequency: "day",
          enabled: true,
          showOnce: true,
          closeByKey: true,
          disableScroll: true,
          enableClose: false,
          type: false,
          blockTabNavigation: false,
          openedModalBodyClass: `${this._prefix}modal-opened`,
        },
        ...JSON.parse(this.dataset.options),
      };

			if ( this.o.type == 'cookies' ) {

        this.o.enabled = false;
        this.o.showOnce = false;

        var modal = this;
        var STORAGE_KEY = 'zgueg-cookie-consent';
        var CATS = ['shopify', 'meta', 'tiktok', 'ga'];

        var readConsent = function () {
          try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
        };

        // Vendor toggles -> standard Shopify consent categories
        var applyConsent = function (c) {
          var marketing = !!(c.meta || c.tiktok);
          var consent = {
            analytics: !!c.ga,
            marketing: marketing,
            preferences: !!c.shopify,
            sale_of_data: marketing
          };
          if (window.Shopify && Shopify.customerPrivacy && Shopify.customerPrivacy.setTrackingConsent) {
            Shopify.customerPrivacy.setTrackingConsent(consent, function () {});
          }
          window.zguegConsent = c;
          document.dispatchEvent(new CustomEvent('zgueg:consent', { detail: c }));
        };

        var saveConsent = function (c) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
          applyConsent(c);
        };

        var setToggles = function (c) {
          CATS.forEach(function (k) {
            var el = modal.querySelector('[data-cookie-toggle="' + k + '"]');
            if (el) { el.checked = c ? !!c[k] : true; }
          });
        };

        var readToggles = function () {
          var c = {};
          CATS.forEach(function (k) {
            var el = modal.querySelector('[data-cookie-toggle="' + k + '"]');
            c[k] = el ? !!el.checked : true;
          });
          return c;
        };

        var showPrefs = function (on) {
          modal.classList.toggle('cookies-prefs-open', on !== false);
        };

        var acceptAll = function () {
          var c = { shopify: true, meta: true, tiktok: true, ga: true };
          setToggles(c);
          saveConsent(c);
        };

        var saveChoices = function () { saveConsent(readToggles()); };

        var showBanner = function () {
          modal.o.enabled = true;
          showPrefs(false);
          modal.show();
        };

        var initCookieBanner = function () {
          var saved = readConsent();
          if (saved) { applyConsent(saved); }
          else { showBanner(); }
        };

        // Re-open the preferences panel later (footer link)
        window.zguegOpenCookiePrefs = function () {
          modal.o.enabled = true;
          setToggles(readConsent());
          modal.show();
          showPrefs(true);
        };

        var acceptBtn = modal.querySelector('[data-js-cookies-accept]');
        var customizeBtn = modal.querySelector('[data-js-cookies-customize]');
        var saveBtn = modal.querySelector('[data-js-cookies-save]');
        var backBtn = modal.querySelector('[data-js-cookies-back]');
        if (acceptBtn) { acceptBtn.addEventListener('click', acceptAll); }
        if (customizeBtn) { customizeBtn.addEventListener('click', function (e) { e.preventDefault(); setToggles(readConsent()); showPrefs(true); }); }
        if (saveBtn) { saveBtn.addEventListener('click', saveChoices); }
        if (backBtn) { backBtn.addEventListener('click', function (e) { e.preventDefault(); showPrefs(false); }); }

        // Footer "Préférences de cookies" link + any [data-zgueg-cookie-prefs] / #cookie-preferences link
        var wirePrefsLinks = function () {
          document.querySelectorAll('a[href*="#cookie-preferences"], [data-zgueg-cookie-prefs]').forEach(function (el) {
            if (el.dataset.zgCookieWired) { return; }
            el.dataset.zgCookieWired = '1';
            el.addEventListener('click', function (e) { e.preventDefault(); window.zguegOpenCookiePrefs(); });
          });
        };
        var injectFooterLink = function () {
          if (!document.querySelector('[data-zgueg-cookie-prefs]')) {
            var groups = document.querySelectorAll('.shopify-section-group-footer-group');
            var footer = groups.length ? groups[0] : null;
            if (footer) {
              var card = modal.querySelector('[data-cookie-card]');
              var label = (card && card.dataset.prefsLinkLabel) ? card.dataset.prefsLinkLabel : 'Préférences de cookies';
              var wrap = document.createElement('div');
              wrap.className = 'zgueg-cookie-prefs-link';
              var btn = document.createElement('button');
              btn.type = 'button';
              btn.setAttribute('data-zgueg-cookie-prefs', '');
              btn.textContent = label;
              wrap.appendChild(btn);
              footer.appendChild(wrap);
            }
          }
          wirePrefsLinks();
        };
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', injectFooterLink);
        } else {
          injectFooterLink();
        }

        window.Shopify.loadFeatures(
          [
            {
              name: 'consent-tracking-api',
              version: '0.1',
            },
          ],
          function (error) {
            if (error) { throw error; }
            initCookieBanner();
          }
        );
      }

      this._scrollTriggered = false; 

      if ( this.o.enabled ) {
        this._modalKey = `modal-${document.location.hostname}-${this.id}`;
        this._modalStorage = !localStorage.getItem(this._modalKey)
          ? "empty"
          : JSON.parse(localStorage.getItem(this._modalKey));
        if (this.querySelector("[data-content]")) {
          this._modalText = this.querySelector("[data-content]").textContent;
        }

        const timeNow = new Date().getTime();
        const inBetween = Math.round(
          (timeNow - this._modalStorage['shown']) / 1000
        );

        let showModal = false;

        if (
          this._modalStorage == 'empty' ||
          (this.o.frequency == 'day' && inBetween > 86400) ||
          (this.o.frequency == 'week' && inBetween > 604800) ||
          (this.o.frequency == 'month' && inBetween > 2419200) ||
          this._modalStorage['content'] != this._modalText
        ) {
          showModal = true;
        }

        if ( showModal ) {

          if ( this.o.type == 'exit_intent_popup' ) {

            let lastMouseY = 0;
            let topOffset = 20;
            let exitIntentTriggered = false;

            this._exitIntentHandler = e => {
              const currentMouseY = e.clientY;
              if (currentMouseY < lastMouseY && currentMouseY < topOffset && ! Shopify.designMode && !exitIntentTriggered) {
                exitIntentTriggered = true;
                this.show();
                document.removeEventListener('mousemove', this._exitIntentHandler);
              }
              lastMouseY = currentMouseY;
            };
            document.addEventListener('mousemove', this._exitIntentHandler);

          } else if ( this.o.showOnPageOffset > 0 ) {
            this._onScroll = () => {
              const scrollPercent =
                (window.scrollY /
                  (document.documentElement.scrollHeight -
                    window.innerHeight)) *
                100;
              if (
                scrollPercent >= this.o.showOnPageOffset &&
                !this._scrollTriggered
              ) {
                this._scrollTriggered = true;
                setTimeout(() => {
                  this.show();
                }, parseInt(this.o.show * 1000));
                window.removeEventListener('scroll', this._onScroll);
              }
            };
            window.addEventListener('scroll', this._onScroll, {
              passive: true,
            });

          } else {
            setTimeout(() => {
              this.show();
            }, parseInt(this.o.show * 1000));
          }

        }
        this.querySelectorAll('[data-js-close]').forEach(elm =>
          elm.addEventListener('click', () => {
            this.hide(this.o.showOnce);
          })
        );
      } else {
        this.querySelectorAll('[data-js-close]').forEach(elm =>
          elm.addEventListener('click', () => {
            this.hide(this.o.showOnce);
          })
        );
      }

      if ( this.o.enableClose == true ) {
        this.querySelectorAll('[data-js-close]').forEach(elm =>
          elm.addEventListener('click', () => {
            this.hide(this.o.showOnce);
          })
        );
      }

      if ( this.o.closeByKey ) {
        document.addEventListener('keydown', e => {
          if (e.keyCode == 27) {
            if (this.classList.contains(`${this._prefix}active`)) {
              this.hide(this.o.showOnce);
            }
          }
        });
      }
    }

    show(customContent = false) {

      if (customContent && document.querySelector(customContent)) {
        const content = document.querySelector(customContent).innerHTML;
        const modalCommon = document.getElementById('modal-common');
        if ( modalCommon ) {
          modalCommon.innerHTML = content;
          if (this.o.enableClose == true) {
            modalCommon.querySelectorAll('[data-js-close]').forEach(elm =>
              elm.addEventListener('click', () => {
                this.hide(this.o.showOnce);
              })
            );
          }
        }
      }

      this.setAttribute('style', '');
      setTimeout(() => {
        this.classList.add(`${this._prefix}active`);
        if (this.o.disableScroll) {
          document.body.classList.add(this.o.openedModalBodyClass);
        }
        if (this.o.blockTabNavigation) {
          window.inertElems.forEach(elm =>
            elm.setAttribute('inert', '')
          );
        }
      }, 10);

      setTimeout(() => {
        if (this.querySelector('[data-js-first-focus]')) {
          this.querySelector('[data-js-first-focus]').focus();
        }
      }, 250);
      
    }

    hide(remember = false) {

      this.classList.remove(`${this._prefix}active`);
      document.body.classList.remove(this.o.openedModalBodyClass);
      setTimeout(() => {
        this.style.display = 'none';
      }, 500);
      if (remember && !Shopify.designMode) {
        localStorage.setItem(
          this._modalKey,
          JSON.stringify({
            shown: new Date().getTime(),
            content: this._modalText,
          })
        );
      }

      window.inertElems.forEach(elm =>
        elm.removeAttribute('inert')
      );
      if (window.lastFocusedElm) {
        setTimeout(() => {
          window.lastFocusedElm.focus();
          window.lastFocusedElm = null;
        }, 100);
      }

    }
  }

  if ( typeof customElements.get('modal-box') == 'undefined' ) {

    // Clone modal elements and move to end of body IF append-top-body
    const originalElements = document.querySelectorAll('modal-box');
    originalElements.forEach((originalElement) => {
      const dataOptions = JSON.parse(originalElement.dataset.options);
      if (dataOptions.appendToBody === true) {
        document.body.appendChild(originalElement);
      }
    });

    customElements.define('modal-box', ModalBox);

  }

  // Shopify events

  document.addEventListener('shopify:section:select', e => {
    if (e.target.classList.contains('mount-popup')) {
      e.target.querySelector('modal-box').style.display = 'block';
      e.target.querySelector('modal-box').show();
    }
  });
  document.addEventListener('shopify:block:select', e => {
    if (e.target.hasAttribute('data-modal-box')) {
      e.target.style.display = 'block';
      e.target.show();
    }
  });
  document.addEventListener('shopify:block:deselect', e => {
    if (e.target.hasAttribute('data-modal-box')) {
      e.target.hide();
    }
  });
  document.addEventListener('shopify:section:deselect', e => {
    if (e.target.classList.contains('mount-popup')) {
      e.target.querySelector('modal-box').hide();
    }
  });
	
}