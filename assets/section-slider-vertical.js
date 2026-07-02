if ( typeof SliderVertical !== 'function' ) {

  class SliderVertical extends HTMLElement {

    constructor() {
      super();
    }

    init(){

      this.items = this.querySelectorAll('[data-js-item]');
      this.prlxItems = this.querySelectorAll('[data-scroll-speed]');
      this.rotateItems = this.querySelectorAll('[data-js-rotate]');
      this.horizItems = this.querySelectorAll('[data-js-horizontal]');
      this.slider = this.querySelector('[data-js-element]');

      // Extra scroll length kept after the last image, so the section stays
      // pinned until every image has finished scrolling off-screen.
      this.endSpaceVh = parseFloat(this.dataset.endSpace) || 0;

      this.bgImage = this.querySelector('[data-js-background-image]');
      if ( this.bgImage ) {
        this.bgImageFigure = this.bgImage.querySelector('figure');
      }

      this.calculateHeight();
      window.addEventListener('resize', debounce(()=>{
        this.scrollParallax();
        this.scrollRotation();
        this.scrollHorizontal();
        if ( this.bgImage ) {
          this.scrollBackground();
        }
        this.calculateHeight();
      }, 300));

      if ( this.prlxItems.length > 0 || this.rotateItems.length > 0 || this.horizItems.length > 0 ) {
        this._raf = true;
        this.scrollParallax();
        this.scrollRotation();
        this.scrollHorizontal();
        this.calculateHeight();
        window.addEventListener('scroll',()=>{
          if ( this._raf ) {
            this._raf = false;
            requestAnimationFrame(()=>{
              this.scrollParallax();
              this.scrollRotation();
              this.scrollHorizontal();
            });
            if ( this.bgImage ) {
              requestAnimationFrame(this.scrollBackground.bind(this));
            }
          }
        }, {passive: true});
      }
    }

    scrollHorizontal() {
      const windowHeight = document.documentElement.clientHeight;
      const windowWidth = document.documentElement.clientWidth;
      // Desktop landscape only — on mobile/portrait the CSS uses the
      // dedicated mobile offset, so the inline position is cleared.
      const isDesktop = windowWidth > 767 && windowWidth > windowHeight;
      const prop = document.documentElement.dir === 'rtl' ? 'right' : 'left';
      this.horizItems.forEach(elm=>{
        if ( !isDesktop ) {
          elm.style.left = '';
          elm.style.right = '';
          return;
        }
        const rect = elm.getBoundingClientRect();
        // progress: 0 when the element's top reaches the bottom of the
        // viewport, 1 when its bottom leaves the top of the viewport.
        let progress = (windowHeight - rect.top) / (windowHeight + rect.height);
        progress = Math.min(1, Math.max(0, progress));
        const start = parseFloat(elm.dataset.offsetXStart) || 0;
        const end = parseFloat(elm.dataset.offsetXEnd) || 0;
        elm.style[prop] = `${start + (end - start) * progress}%`;
      });
      this._raf = true;
    }

    scrollRotation() {
      const windowHeight = document.documentElement.clientHeight;
      this.rotateItems.forEach(elm=>{
        const rect = elm.getBoundingClientRect();
        // progress: 0 when the element's top reaches the bottom of the
        // viewport, 1 when its bottom leaves the top of the viewport.
        let progress = (windowHeight - rect.top) / (windowHeight + rect.height);
        progress = Math.min(1, Math.max(0, progress));
        const start = parseFloat(elm.dataset.rotationStart) || 0;
        const end = parseFloat(elm.dataset.rotationEnd) || 0;
        const angle = start + (end - start) * progress;
        elm.style.transform = `rotate(${angle}deg)`;
      });
      this._raf = true;
    }

    scrollBackground(){
      if ( Math.abs(this.bgImage.getBoundingClientRect().y) < window.innerHeight ) {
        this.bgImageFigure.style.transform = `translateY(${this.bgImage.getBoundingClientRect().y / -2}px)`;
      }
    }

    scrollParallax() {
      const windowHeight = document.documentElement.clientHeight;
      const windowWidth = document.documentElement.clientWidth;
      this.prlxItems.forEach(elm=>{
        let elementY = elm.getBoundingClientRect().y;
        let scrollFactor = Number(elm.dataset.scrollSpeed);
        if ( windowWidth > 768 && windowWidth > windowHeight ) {
          if ( elementY < windowHeight * 2 && elementY > (elm.offsetHeight + windowHeight)*-1 ) {
            const prlx = ( (elm.parentElement.getBoundingClientRect().y - (windowHeight - elm.parentElement.offsetHeight)/2) * scrollFactor ) / 2;
            if ( Math.abs(prlx) < windowHeight ) {
              elm.style.transform = `translateY(${prlx}px)`;
            }
          }
        }
      });
      this._raf = true;
    }

    calculateHeight() {
      let height = 0;
      this.items.forEach(elm=>{
        if ( elm.offsetHeight + elm.offsetTop > height ) {
          height = elm.offsetHeight + elm.offsetTop;
        }
      });
      if ( this.endSpaceVh > 0 ) {
        height += document.documentElement.clientHeight * this.endSpaceVh / 100;
      }
      this.slider.style.height = `${height}px`;
    }

  }

  if ( typeof customElements.get('slider-vertical') == 'undefined' ) {
    customElements.define('slider-vertical', SliderVertical);
  }

}
