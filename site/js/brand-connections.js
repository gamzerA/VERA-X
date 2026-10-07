/* Measured concept links. This module never starts an inspection or moves a node. */
(() => {
  'use strict';
  const section = document.querySelector('#technology');
  const scene = section?.querySelector('.tech-scene');
  const svg = scene?.querySelector('.tech-connections');
  if (!svg) return;
  const ns = 'http://www.w3.org/2000/svg';
  const mobile = matchMedia('(max-width: 767px)');
  const anchors = Object.fromEntries([...scene.querySelectorAll('[data-tech-anchor]')].map(node => [node.dataset.techAnchor, node]));
  const nodes = ['source', 'run', 'record', 'provenance'].map(name => scene.querySelector(`.tech-${name}`));
  if (nodes.some(node => !node) || ['source', 'run', 'record', 'source-reference', 'model-reference'].some(key => !anchors[key])) return;
  const defs = svg.querySelector('defs');
  let frame = 0, observing = false;
  let narrative = {index:Number(section.dataset.techActive) || 0, phase:'input', progress:0, moving:false, holdFade:1, manual:true};

  function element(name, attributes, parent = svg) {
    const node = document.createElementNS(ns, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    parent.appendChild(node);
    return node;
  }
  const links = [
    {id:'input', states:[0]},
    {id:'run', states:[1]},
    {id:'source-reference', states:[2], reference:true},
    {id:'model-reference', states:[2], reference:true}
  ].map(link => {
    const mask = element('mask', {id:`tech-mask-${link.id}`, maskUnits:'userSpaceOnUse', x:0, y:0}, defs);
    const reveal = element('path', {fill:'none', stroke:'white', 'stroke-width':18, 'stroke-linecap':'square', pathLength:1, 'stroke-dasharray':'.18 1', 'stroke-dashoffset':.18}, mask);
    const classes = link.reference ? ' tech-link-reference' : '';
    const base = element('path', {class:`tech-link-base${classes}`, 'marker-end':'url(#tech-arrow-base)', 'data-tech-connection':link.id});
    const emphasis = element('path', {class:`tech-link-active${classes}`, 'marker-end':'url(#tech-arrow-active)'});
    const traveler = element('path', {class:`tech-link-traveler${classes}`, mask:`url(#tech-mask-${link.id})`});
    const points = [element('circle', {class:'tech-link-point', r:2.5}), element('circle', {class:'tech-link-point', r:2.5})];
    return {...link, mask, reveal, base, emphasis, traveler, points};
  });

  // Every rectangle is read relative to the same SVG viewport, in CSS pixels.
  function box(node, origin) {
    const rect = node.getBoundingClientRect();
    return {left:rect.left-origin.left, right:rect.right-origin.left, top:rect.top-origin.top, bottom:rect.bottom-origin.top, cx:(rect.left+rect.right)/2-origin.left, cy:(rect.top+rect.bottom)/2-origin.top};
  }
  function route(points) { return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' '); }
  function updateGeometry() {
    frame = 0;
    if (!observing) return;
    const origin = scene.getBoundingClientRect();
    if (!origin.width || !origin.height) return;
    const a = Object.fromEntries(Object.entries(anchors).map(([key, node]) => [key, box(node, origin)]));
    const [source, run, record, provenance] = nodes.map(node => box(node, origin));
    const gap = 16;
    let routes;
    if (mobile.matches) {
      // Real vertical flow in the row gaps; references use separate outer lanes.
      const flowX = run.cx;
      routes = [
        [[flowX, source.bottom+gap], [flowX, run.top-gap]],
        [[flowX, run.bottom+gap], [flowX, record.top-gap]],
        [[provenance.left-gap, a['source-reference'].cy], [8, a['source-reference'].cy], [8, a.source.cy], [source.left-gap, a.source.cy]],
        [[a['model-reference'].right+gap, a['model-reference'].cy], [origin.width-8, a['model-reference'].cy], [origin.width-8, a.run.cy], [run.right+gap, a.run.cy]]
      ];
    } else {
      const inputStart = [a.source.right+gap, a.source.cy];
      const inputEnd = [a.run.left-gap, a.run.cy];
      const runStart = [a.run.right+gap, a.run.cy];
      const runEnd = [a.record.left-gap, a.record.cy];
      const inputLane = (inputStart[0]+inputEnd[0])/2;
      const runLane = (runStart[0]+runEnd[0])/2;
      const floor = Math.max(source.bottom, run.bottom, record.bottom, provenance.bottom);
      const referenceX = provenance.right+gap;
      routes = [
        [inputStart, [inputLane, inputStart[1]], [inputLane, inputEnd[1]], inputEnd],
        [runStart, [runLane, runStart[1]], [runLane, runEnd[1]], runEnd],
        [[a['source-reference'].right+gap, a['source-reference'].cy], [referenceX+16, a['source-reference'].cy], [referenceX+16, floor+60], [source.cx, floor+60], [source.cx, source.bottom+gap]],
        [[a['model-reference'].right+gap, a['model-reference'].cy], [referenceX, a['model-reference'].cy], [referenceX, floor+32], [run.cx, floor+32], [run.cx, run.bottom+gap]]
      ];
    }
    // Write only after all layout reads; ResizeObserver work is batched in one frame.
    svg.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`);
    links.forEach((link, index) => {
      const points = routes[index];
      const d = route(points);
      [link.base, link.emphasis, link.traveler, link.reveal].forEach(path => path.setAttribute('d', d));
      link.mask.setAttribute('width', String(origin.width));
      link.mask.setAttribute('height', String(origin.height));
      [points[0], points[points.length-1]].forEach(([x, y], i) => {
        link.points[i].setAttribute('cx', String(x));
        link.points[i].setAttribute('cy', String(y));
      });
    });
    renderNarrative();
  }
  function schedule() { if (observing && !frame) frame = requestAnimationFrame(updateGeometry); }
  // Playback owns time. This renderer changes only path masks and fixed-point emphasis.
  // A paused frame keeps its moving segment in place; manual/reduced frames are static.
  function renderNarrative() {
    const progress = Math.max(0, Math.min(1, Number(narrative.progress) || 0));
    links.forEach(link => {
      const selected = link.states.includes(narrative.index);
      link.emphasis.classList.toggle('is-active', selected);
      link.emphasis.style.opacity = selected ? (narrative.manual ? '1' : '.5') : '0';
      link.reveal.style.strokeDashoffset = String(.18-progress);
      link.traveler.style.opacity = selected && narrative.moving ? String(narrative.phase === 'hold' ? narrative.holdFade : 1) : '0';
      link.points.forEach((point, index) => {
        point.classList.toggle('is-active', selected);
        point.style.opacity = selected ? String(narrative.manual ? 1 : index ? .65+.35*progress : 1-.25*progress) : '1';
      });
    });
  }
  function receiveFrame(event) {
    const next = event.detail;
    if (!next || !Number.isInteger(next.index) || next.index < 0 || next.index > 2) return;
    narrative = next;
    renderNarrative();
  }
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
  const images = [...scene.querySelectorAll('img')];
  function start() {
    if (observing) return;
    observing = true;
    [scene, ...nodes, ...Object.values(anchors)].forEach(node => observer?.observe(node));
    window.addEventListener('resize', schedule, {passive:true});
    section.addEventListener('brand:technology-frame', receiveFrame);
    mobile.addEventListener('change', schedule);
    images.forEach(img => { img.addEventListener('load', schedule); img.addEventListener('error', schedule); });
    document.fonts?.addEventListener?.('loadingdone', schedule);
    document.fonts?.ready.then(schedule);
    images.forEach(img => { if (img.complete && img.decode) img.decode().then(schedule, schedule); });
    schedule();
  }
  function stop() {
    observing = false;
    observer?.disconnect();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener('resize', schedule);
    section.removeEventListener('brand:technology-frame', receiveFrame);
    mobile.removeEventListener('change', schedule);
    images.forEach(img => { img.removeEventListener('load', schedule); img.removeEventListener('error', schedule); });
    document.fonts?.removeEventListener?.('loadingdone', schedule);
  }
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', event => { if (event.persisted) { start(); renderNarrative(); } });
  start();
})();
