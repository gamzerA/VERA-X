/* One Motion 13.4.6 clock owns the 12-second illustrative narrative. */
(() => {
  'use strict';
  const section = document.querySelector('#technology');
  const scene = section?.querySelector('.tech-scene');
  const buttons = [...(section?.querySelectorAll('[data-tech-stage]') || [])];
  const captions = [...(section?.querySelectorAll('[data-tech-caption]') || [])];
  const toggle = section?.querySelector('[data-tech-playback-toggle]');
  const status = section?.querySelector('[data-tech-playback-status]');
  const progressBar = section?.querySelector('[data-tech-progress]');
  if (!scene || !toggle || !status || buttons.length !== 3 || captions.length !== 3) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const starts = [0, 3000, 6000];
  const duration = 12000;
  let elapsed = 0, activeIndex = -1, previousIndex = -1, connected = false, running = false;
  let inView = typeof IntersectionObserver === 'undefined';
  let autoIntent = !reduced.matches, manual = false, clock = null;
  let observer = null, driver = null;

  function frameAt(time) {
    if (time < 3000) return {index:0, phase:'input', progress:time/3000, holdFade:1};
    if (time < 6000) return {index:1, phase:'run', progress:(time-3000)/3000, holdFade:1};
    if (time < 10000) return {index:2, phase:'trace', progress:(time-6000)/4000, holdFade:1};
    return {index:2, phase:'hold', progress:1, holdFade:Math.max(0, 1-(time-10000)/2000)};
  }
  function render() {
    const frame = frameAt(elapsed);
    if (frame.index !== activeIndex) {
      previousIndex = activeIndex;
      activeIndex = frame.index;
      section.dataset.techActive = String(activeIndex);
      buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === activeIndex)));
      captions.forEach((caption, index) => {
        caption.setAttribute('aria-hidden', String(index !== activeIndex));
        caption.inert = index !== activeIndex;
      });
    }
    section.dataset.techPhase = frame.phase;
    section.dataset.techElapsed = String(Math.round(elapsed));
    const staticState = manual || reduced.matches || !clock;
    if (staticState) previousIndex = -1;
    const captionProgress = staticState ? 1 : Math.min(1, (elapsed-starts[activeIndex])/220);
    captions.forEach((caption, index) => {
      const selected = index === activeIndex;
      const outgoing = index === previousIndex && captionProgress < 1;
      caption.style.visibility = selected || outgoing ? 'visible' : 'hidden';
      caption.style.opacity = String(selected ? (previousIndex < 0 ? 1 : captionProgress) : outgoing ? 1-captionProgress : 0);
    });
    if (progressBar) progressBar.style.transform = `scaleX(${elapsed/duration})`;
    section.dispatchEvent(new CustomEvent('brand:technology-frame', {detail:{...frame, moving:!staticState, manual:staticState}}));
  }
  function updateControl() {
    const available = !!clock && !reduced.matches;
    toggle.disabled = !available;
    toggle.textContent = autoIntent && available ? 'Pause animation' : 'Play animation';
    section.dataset.techPlayback = !available ? 'static' : running ? 'playing' : autoIntent ? 'suspended' : 'paused';
    status.textContent = !clock ? 'Animation unavailable. Select a step to explore.'
      : reduced.matches ? 'Reduced motion is on. Select a step to explore.'
      : running ? 'Illustrative sequence playing.'
      : autoIntent ? 'Animation pauses while out of view.'
      : 'Animation paused. Play resumes from this point.';
  }
  function syncPlayback() {
    const shouldRun = connected && !!clock && autoIntent && inView && !document.hidden && document.visibilityState !== 'hidden' && !reduced.matches;
    if (shouldRun !== running) {
      running = shouldRun;
      if (running) clock.play();
      else { clock?.pause(); driver?.stop(); }
    }
    updateControl();
  }
  function pauseByUser() {
    autoIntent = false;
    syncPlayback();
  }
  function select(index) {
    if (!Number.isInteger(index) || !buttons[index]) return;
    pauseByUser();
    manual = true;
    elapsed = starts[index];
    if (clock) { clock.time = elapsed/1000; driver?.stop(); }
    render();
  }
  function togglePlayback() {
    if (!clock || reduced.matches) return;
    if (autoIntent) { pauseByUser(); return; }
    manual = false;
    autoIntent = true;
    render();
    syncPlayback();
  }
  function onClick(event) {
    const button = event.target.closest('[data-tech-stage]');
    if (button && section.contains(button)) select(Number(button.dataset.techStage));
  }
  function onFocus(event) {
    const step = event.target.closest('[data-tech-stage]');
    if (step && section.contains(step)) { select(Number(step.dataset.techStage)); return; }
    if (event.target.closest('.tech-details')) pauseByUser();
  }
  function onKey(event) {
    const button = event.target.closest('[data-tech-stage]');
    if (!button || !section.contains(button)) return;
    const index = Number(button.dataset.techStage);
    const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : step ? (index+step+3)%3 : null;
    if (next === null) return;
    event.preventDefault();
    buttons[next].focus({preventScroll:true});
    select(next);
  }
  function preferenceChanged() {
    if (reduced.matches) autoIntent = false;
    syncPlayback();
    render();
  }
  try {
    if (typeof window.Motion?.animate === 'function') {
      // Local bundle confirms numeric values, autoplay:false, repeat, time, play and pause.
      // All visual phases are derived from this clock; there are no element loops/timers.
      clock = window.Motion.animate(0, duration, {
        duration:12, repeat:Infinity, ease:'linear', autoplay:false,
        // Motion's default pause retains a keepAlive frame callback. Supplying its
        // supported driver lets suspension stop frame work without adding a clock.
        driver(update) {
          let request = 0, started = false;
          function tick(timestamp) {
            request = 0;
            if (!started) return;
            update(timestamp);
            if (started && !request) request = requestAnimationFrame(tick);
          }
          driver = {
            start() { started = true; if (!request) request = requestAnimationFrame(tick); },
            stop() { started = false; if (request) cancelAnimationFrame(request); request = 0; },
            now() { return performance.now(); }
          };
          return driver;
        },
        onUpdate(value) {
          if (!connected || !running) return;
          elapsed = Math.max(0, Math.min(duration, Number(value) || 0));
          render();
        }
      });
      if (!clock || typeof clock.pause !== 'function' || typeof clock.play !== 'function') throw new Error('Timeline unavailable');
      clock.pause();
      driver?.stop();
    }
  } catch (_) { clock?.cancel?.(); driver?.stop(); clock = null; }
  if (!clock) autoIntent = false;

  function start() {
    if (connected) return;
    connected = true;
    section.classList.add('tech-interactive');
    section.dataset.techClock = 'true';
    section.querySelector('.tech-captions')?.setAttribute('aria-live', 'off');
    section.addEventListener('click', onClick);
    section.addEventListener('focusin', onFocus);
    section.addEventListener('keydown', onKey);
    toggle.addEventListener('click', togglePlayback);
    document.addEventListener('visibilitychange', syncPlayback);
    reduced.addEventListener('change', preferenceChanged);
    if (typeof IntersectionObserver !== 'undefined') {
      inView = false;
      observer = new IntersectionObserver(entries => {
        const entry = entries.find(item => item.target === scene);
        if (!entry) return;
        inView = entry.isIntersecting && entry.intersectionRatio >= .35;
        syncPlayback();
      }, {threshold:[0, .35]});
      observer.observe(scene);
    }
    render();
    syncPlayback();
  }
  function stop(event) {
    connected = false;
    running = false;
    clock?.pause();
    driver?.stop();
    observer?.disconnect();
    observer = null;
    section.removeEventListener('click', onClick);
    section.removeEventListener('focusin', onFocus);
    section.removeEventListener('keydown', onKey);
    toggle.removeEventListener('click', togglePlayback);
    document.removeEventListener('visibilitychange', syncPlayback);
    reduced.removeEventListener('change', preferenceChanged);
    if (!event.persisted) { clock?.cancel?.(); clock = null; }
  }
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', event => { if (event.persisted) start(); });
  start();
})();
