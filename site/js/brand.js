/* Progressive enhancement for the brand site. No model, API or fixture calls. */
(() => {
  'use strict';
  const motion = window.Motion;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 768px)');
  const ease = [.22, 1, .36, 1];
  const header = document.querySelector('.brand-header');
  const sections = [...document.querySelectorAll('[data-header-theme]')];
  const animations = new Set();
  const entryObservers = [];
  const choiceCleanups = [];
  const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
  let headerObserver, resizeObserver, parallaxCleanup = () => {};

  // Defaults remain visible. An unavailable animation engine never hides content.
  function animate(target, keyframes, options = {}) {
    if (!motion || reduced.matches || !target || (Array.isArray(target) && !target.length)) return null;
    try {
      const control = motion.animate(target, keyframes, {ease, ...options});
      animations.add(control);
      Promise.resolve(control).then(() => animations.delete(control), () => animations.delete(control));
      return control;
    } catch (_) { return null; }
  }
  function readSelection(key) {
    try { const value = Number(sessionStorage.getItem(key)); return Number.isInteger(value) && value >= 0 && value < 3 ? value : 0; }
    catch (_) { return 0; }
  }
  function remember(key, value) { try { sessionStorage.setItem(key, String(value)); } catch (_) {} }
  function setupChoice({sectionId, buttonSelector, panelSelector, graphicSelector, dataKey, className, storageKey, hoverExplore = false}) {
    const section = document.querySelector(sectionId);
    if (!section) return;
    const buttons = [...section.querySelectorAll(buttonSelector)];
    const panels = [...section.querySelectorAll(panelSelector)];
    const graphics = graphicSelector ? [...section.querySelectorAll(graphicSelector)] : [];
    if (buttons.length !== 3 || panels.length !== 3) return;
    let transition = null, activeIndex = -1, hoverTimer = null, suppressHoverUntil = 0;
    function cancelHover() { clearTimeout(hoverTimer); hoverTimer = null; }
    function select(index, shouldAnimate = true) {
      cancelHover();
      if (!Number.isInteger(index) || !panels[index] || index === activeIndex) return;
      activeIndex = index;
      transition?.cancel();
      section.dataset[dataKey] = String(index);
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      [...panels, ...graphics].forEach((panel, i) => {
        const selected = i % 3 === index;
        // visibility + a shared grid cell reserves the largest description height.
        panel.setAttribute('aria-hidden', String(!selected));
        panel.inert = !selected;
      });
      remember(storageKey, index);
      // Product description and graphic fades have one CSS owner; only state changes here.
      if (shouldAnimate && !hoverExplore) transition = animate(panels[index], {opacity:[.65, 1], y:[5, 0]}, {duration:.24});
      if (!hoverExplore) section.dispatchEvent(new CustomEvent('brand:technology-change', {detail:{index, animate:shouldAnimate}}));
    }
    section.classList.add(className);
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => select(index));
      if (hoverExplore) {
        button.addEventListener('pointerenter', event => {
          cancelHover();
          if (event.pointerType !== 'mouse' || !hoverPointer.matches || Date.now() < suppressHoverUntil) return;
          hoverTimer = setTimeout(() => select(index), 85);
        });
        button.addEventListener('pointerleave', cancelHover);
        button.addEventListener('pointerdown', event => {
          cancelHover();
          if (event.pointerType === 'touch') suppressHoverUntil = Date.now() + 800;
        });
        button.addEventListener('focus', () => select(index));
      }
      button.addEventListener('keydown', event => {
        const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : step ? (index + step + 3) % 3 : null;
        if (next === null) return;
        event.preventDefault(); buttons[next].focus({preventScroll:true}); select(next);
      });
    });
    // A new visit starts on the first product question. History restoration keeps the
    // last question; BFCache naturally preserves the existing activeIndex.
    const returning = window.performance?.getEntriesByType?.('navigation')?.[0]?.type === 'back_forward';
    select(hoverExplore && !returning ? 0 : readSelection(storageKey), false);
    choiceCleanups.push(cancelHover);
  }
  // Technology has its own visibility-aware explanatory playback timeline.
  setupChoice({sectionId:'#product', buttonSelector:'[data-product-choice]', panelSelector:'[data-product-copy]', graphicSelector:'[data-product-graphic]', dataKey:'productActive', className:'product-interactive', storageKey:'vera.brand.product', hoverExplore:true});

  function updateHeader() {
    if (!header) return;
    const y = header.getBoundingClientRect().height + 2;
    const section = sections.find(el => { const r = el.getBoundingClientRect(); return r.top <= y && r.bottom > y; });
    if (section) header.dataset.theme = section.dataset.headerTheme;
  }
  function observeHeader() {
    if (!header) return;
    headerObserver?.disconnect();
    const height = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--brand-header-height', height + 'px');
    if (typeof IntersectionObserver !== 'undefined') {
      headerObserver = new IntersectionObserver(updateHeader, {rootMargin:`-${height}px 0px -${Math.max(0, innerHeight-height-3)}px 0px`, threshold:0});
      sections.forEach(section => headerObserver.observe(section));
    }
    updateHeader();
  }
  observeHeader();
  window.addEventListener('resize', observeHeader, {passive:true});
  if (typeof ResizeObserver !== 'undefined' && header) { resizeObserver = new ResizeObserver(observeHeader); resizeObserver.observe(header); }

  // Native links remain native for modified clicks, new tabs and destination navigation.
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const hash = link.getAttribute('href');
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    if (location.hash !== hash) history.pushState(null, '', hash);
    if (event.detail === 0) { if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex','-1'); target.focus({preventScroll:true}); }
    target.scrollIntoView({behavior:reduced.matches ? 'instant' : 'smooth', block:'start'});
  }));

  // Scale and scroll translation have separate layers; neither owns the other's transform.
  const hero = document.querySelector('.hero-image');
  const heroMedia = document.querySelector('.hero-media');
  const heroSection = document.querySelector('.brand-hero');
  function configureParallax() {
    parallaxCleanup(); parallaxCleanup = () => {};
    if (!heroMedia) return;
    heroMedia.style.transform = '';
    if (!motion || reduced.matches || !desktop.matches) return;
    try {
      const shift = motion.animate(heroMedia, {y:[0,28]}, {ease:'linear'});
      const stop = motion.scroll(shift, {target:heroSection, offset:['start start','end start']});
      parallaxCleanup = () => { stop(); shift.cancel(); heroMedia.style.transform = ''; };
    } catch (_) { heroMedia.style.transform = ''; }
  }
  if (hero && !reduced.matches && scrollY < 100) {
    animate(hero, {scale:[1.025,1]}, {duration:.95});
    animate([...document.querySelectorAll('.hero-line > span')], {y:[28,0], opacity:[.3,1]}, {duration:.72, delay:motion?.stagger?.(.09) || 0});
    animate(document.querySelector('.hero-content > p'), {y:[12,0],opacity:[.4,1]}, {duration:.52,delay:.2});
    animate(document.querySelector('.hero-cta'), {y:[8,0],opacity:[.6,1]}, {duration:.45,delay:.3});
  }
  configureParallax();
  desktop.addEventListener('change', configureParallax);

  function enterOnce(section, elements, delays, duration = .5, distance = 16) {
    if (!section || !elements.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect(); section.dataset.entered = 'true';
      elements.forEach((element, i) => animate(element, {y:[distance,0],opacity:[.55,1]}, {duration,delay:delays?.[i] ?? i*.07}));
      section.querySelectorAll('[data-line-reveal]').forEach(path => {
        path.setAttribute('pathLength','1');
        animate(path, {strokeDasharray:['1 1','1 1'],strokeDashoffset:[1,0]}, {duration:.5,delay:.18});
      });
    }, {threshold:0, rootMargin:'0px 0px -24px 0px'});
    observer.observe(section); entryObservers.push(observer);
  }
  const tech = document.querySelector('#technology');
  enterOnce(tech, tech ? [...tech.querySelectorAll('[data-reveal]')] : [], [0,.1,.18,.26,.32]);
  const product = document.querySelector('#product');
  enterOnce(product, product ? [...product.querySelectorAll('[data-reveal]')] : []);
  const final = document.querySelector('.brand-final');
  enterOnce(final, final ? [...final.querySelectorAll('.final-line > span,.final-action > p,.final-primary,.final-secondary')] : [], [0,.08,.14,.2,.24], .6, 20);

  reduced.addEventListener('change', () => {
    if (reduced.matches) { animations.forEach(control => control.complete?.()); animations.clear(); }
    configureParallax();
  });
  window.addEventListener('pagehide', () => {
    choiceCleanups.forEach(cleanup => cleanup());
    parallaxCleanup(); animations.forEach(control => control.complete?.()); animations.clear();
    headerObserver?.disconnect(); resizeObserver?.disconnect(); entryObservers.forEach(observer => observer.disconnect());
  });
  window.addEventListener('pageshow', event => { if (event.persisted) { observeHeader(); resizeObserver?.observe(header); configureParallax(); } });
})();
