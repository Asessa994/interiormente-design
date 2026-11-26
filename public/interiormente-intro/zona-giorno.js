/* Sequenza di Claude: gli stessi fotogrammi, comandati soltanto dallo scroll. */
(function () {
  'use strict';
  const section = document.querySelector('[data-claude-room]');
  if (!section) return;
  const stage = section.querySelector('[data-room-stage]');
  const canvas = section.querySelector('[data-room-canvas]'), ctx = canvas.getContext('2d', { alpha: false });
  const video = section.querySelector('video');
  const rawImage = document.querySelector('[data-giorno-image]');
  const finalImage = section.querySelector('[data-room-final]');
  const chapter = section.querySelector('[data-room-chapter]');
  const chapterLabel = section.querySelector('[data-room-chapter-label]');
  const chapterCopy = section.querySelector('[data-room-chapter-copy]');
  const overline = section.querySelector('.room-overline');
  const cue = section.querySelector('[data-room-cue]');
  const loading = section.querySelector('[data-room-loading]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const DURATION = 12, SCREENS = 4.5, FINISH = .9;
  const paper = '#e9e3d8';
  const decodedFrame = document.createElement('canvas'), decodedContext = decodedFrame.getContext('2d', { alpha: false });
  let hasDecodedFrame = false;
  const chapters = [
    { at: .6, label: 'Pareti', copy: 'La carta da parati veste lo spazio, telo dopo telo.' },
    { at: 2.8, label: 'Pavimento', copy: 'La pietra prende posto, dal fondo verso di noi.' },
    { at: 4.6, label: 'Travertino', copy: 'Disegno il punto attorno a cui ritrovarsi.' },
    { at: 6.3, label: 'Arredi', copy: 'Ogni elemento trova il suo posto.' },
    { at: 10, label: 'Atmosfera', copy: 'Il fuoco si accende. La stanza prende vita.' }
  ];
  const clamp = n => Math.max(0, Math.min(1, n));
  const posters = new Map(), urls = new Map();
  // Le stesse sequenze originali sono file locali nella cartella public.
  const videoSources = { desktop: video.dataset.videoDesktop, mobile: video.dataset.videoMobile };
  let w = 1, h = 1, dpr = 1, target = 0, current = 0, scrollProgress = 0;
  let raf = 0, last = 0, seeking = false, ready = false, active = false, loadSerial = 0, sourceKey = '';
  let decodeTime = 0, failed = false;

  // Una sola impaginazione per l'arrivo del tunnel, il filmato e il riquadro in uscita.
  // Su telefono il fotogramma resta intero, come nell'anteprima di Claude.
  function paintFrame(context, width, height, frame, x = 0, y = 0) {
    context.save();
    context.fillStyle = paper; context.fillRect(x, y, width, height);
    const iw = frame?.videoWidth || frame?.naturalWidth || frame?.width;
    const ih = frame?.videoHeight || frame?.naturalHeight || frame?.height;
    if (!iw || !ih || frame?.complete === false) { context.restore(); return; }
    if (width < 700 && height > width) {
      context.drawImage(frame, x, y + height * .27, width, width * ih / iw);
    } else {
      const scale = Math.max(width / iw, height / ih), sw = width / scale, sh = height / scale;
      context.drawImage(frame, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, width, height);
    }
    context.restore();
  }
  function poster(width, height) {
    const key = Math.round(width) + ':' + Math.round(height);
    if (!posters.has(key)) {
      const c = document.createElement('canvas'); c.width = Math.round(width); c.height = Math.round(height);
      paintFrame(c.getContext('2d'), width, height, rawImage); posters.set(key, c);
    }
    return posters.get(key);
  }
  function bounds() { return { start: section.getBoundingClientRect().top + scrollY, range: Math.max(1, section.offsetHeight - h) }; }
  function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(draw); }
  function sync() {
    const b = bounds(), hidden = section.closest('.is-tunnel-route-hidden') || !section.offsetHeight;
    const offset = scrollY - b.start;
    active = !hidden && offset >= -.5 && offset <= b.range + h;
    scrollProgress = clamp(offset / b.range);
    target = reduced.matches ? 1 : clamp(scrollProgress / FINISH);
    const fixed = !reduced.matches && offset >= 0 && offset <= b.range;
    // Il binario entra nel viewport prima dell'arrivo: nessuna sua parte deve coprire la galleria.
    const exposed = reduced.matches || (offset >= -.5 && !hidden);
    section.style.visibility = exposed ? 'visible' : 'hidden';
    stage.style.position = reduced.matches ? 'relative' : fixed ? 'fixed' : 'absolute';
    stage.style.top = reduced.matches ? '' : (offset > b.range ? b.range : 0) + 'px';
    stage.style.left = fixed ? section.getBoundingClientRect().left + 'px' : '0px';
    stage.style.width = w + 'px';
    stage.style.visibility = exposed ? 'visible' : 'hidden';
    stage.inert = !active;
    document.body.classList.toggle('giorno-reading', active && offset <= b.range);
    section.dataset.roomPin = fixed ? 'fixed' : offset < 0 ? 'before' : 'after';
    section.dataset.roomScroll = scrollProgress.toFixed(4);
    section.dataset.roomExposed = String(exposed);
    wake();
  }
  function sourceChoice() { return w < 900 ? 'mobile' : 'desktop'; }
  async function blobFor(key) {
    if (urls.has(key)) return urls.get(key);
    const pending = (async () => {
      const response = await fetch(videoSources[key]);
      if (!response.ok) throw new Error('Video della Zona Giorno non disponibile: ' + response.status);
      return URL.createObjectURL(await response.blob());
    })();
    urls.set(key, pending); return pending;
  }
  async function loadVideo(key) {
    if (key === sourceKey) return;
    sourceKey = key; const serial = ++loadSerial;
    ready = false; seeking = false; failed = false;
    section.dataset.roomReady = 'loading';
    try {
      const url = await blobFor(key); if (serial !== loadSerial) return;
      video.src = url; video.load();
      // I fotogrammi del Blob sono gia locali: nessuna richiesta durante il seek.
    } catch (error) { failed = true; section.dataset.roomReady = 'error'; wake(); }
  }
  function captureDecodedFrame() {
    if (video.readyState < 2 || !video.videoWidth) return;
    if (decodedFrame.width !== video.videoWidth || decodedFrame.height !== video.videoHeight) {
      decodedFrame.width = video.videoWidth; decodedFrame.height = video.videoHeight;
    }
    decodedContext.drawImage(video, 0, 0); hasDecodedFrame = true;
  }
  video.addEventListener('loadeddata', () => {
    ready = true; failed = false; seeking = false;
    section.dataset.roomReady = 'true';
    section.dataset.roomVideoSource = sourceKey;
    if (!hasDecodedFrame) captureDecodedFrame();
    wake();
  });
  video.addEventListener('seeked', () => { seeking = false; decodeTime = video.currentTime; captureDecodedFrame(); wake(); });
  video.addEventListener('error', () => { failed = true; ready = false; section.dataset.roomReady = 'error'; wake(); });
  function requestFrame(time) {
    if (!ready || seeking || video.readyState < 2) return;
    const want = Math.min(Math.max(0, time), (video.duration || DURATION) - .002);
    if (Math.abs(want - video.currentTime) > 1 / 120) { seeking = true; video.currentTime = want; }
  }
  function draw(now) {
    raf = 0; if (document.hidden) return;
    const dt = Math.min(80, now - last || 16); last = now;
    current += (target - current) * (1 - Math.exp(-dt / 90));
    if (Math.abs(target - current) < .00015 || !active || reduced.matches) current = target;
    if (scrollProgress >= .985) current = 1;
    const time = current * DURATION;
    requestFrame(time);
    let frame = rawImage;
    if (current >= .9999) frame = finalImage;
    else if (current > .0001 && hasDecodedFrame) frame = decodedFrame;
    if (active || reduced.matches) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paintFrame(ctx, w, h, frame);
      let ci = -1; chapters.forEach((c, i) => { if (time >= c.at) ci = i; });
      chapter.classList.toggle('on', ci >= 0 && time < DURATION - .7);
      if (ci >= 0) { chapterLabel.textContent = chapters[ci].label; chapterCopy.textContent = chapters[ci].copy; }
      cue.textContent = current >= .999 ? 'La stanza è completa. Continua verso la Zona Notte.' : 'Scorri per dare forma alla stanza';
      cue.classList.toggle('is-end', current >= .999);
      const release = clamp((1 - scrollProgress) / .06);
      const uiOpacity = release * release * (3 - 2 * release);
      overline.style.opacity = String(uiOpacity);
      cue.style.opacity = current < .035 || current > .999 ? String(uiOpacity) : '0';
      loading.hidden = ready || reduced.matches || current >= .9999;
      loading.textContent = failed ? 'Il filmato non è stato caricato. Riapri l’anteprima.' : 'Caricamento della stanza…';
    }
    section.dataset.roomProgress = current.toFixed(4);
    section.dataset.roomTime = time.toFixed(3);
    section.dataset.roomFrameTime = decodeTime.toFixed(3);
    section.dataset.roomSeeking = String(seeking);
    if (active && (Math.abs(current - target) > .00015 || (ready && Math.abs(video.currentTime - Math.min(time, (video.duration || DURATION) - .002)) > .01))) wake();
  }
  function resize() {
    w = section.clientWidth || document.querySelector('#progetti').clientWidth;
    h = stage.clientHeight || innerHeight;
    dpr = Math.min(devicePixelRatio || 1, w < 700 ? 1.6 : 1.8);
    section.classList.toggle('is-room-mobile', w < 700);
    section.style.height = reduced.matches ? 'auto' : h * SCREENS + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    sync(); if (w > 0) loadVideo(sourceChoice());
  }
  function seek(progress) {
    window.dispatchEvent(new CustomEvent('interiormente:room-jump'));
    window.dispatchEvent(new CustomEvent('interiormente:seek', { detail: 1 }));
    const b = bounds();
    scrollTo({ top: b.start + b.range * clamp(progress), behavior: 'instant' });
    current = target = reduced.matches ? 1 : clamp(progress / FINISH); sync();
  }
  window.InteriormenteRoom = {
    poster, paintFrame,
    paintFinal(context, width, height, x = 0, y = 0) { paintFrame(context, width, height, finalImage, x, y); },
    seek, get progress() { return scrollProgress; }, get active() { return active; },
    get element() { return section; }
  };
  Promise.allSettled([rawImage.decode(), finalImage.decode()]).then(() => {
    posters.clear(); wake(); window.dispatchEvent(new CustomEvent('interiormente:room-ready'));
  });
  window.addEventListener('interiormente:room-seek', e => seek(clamp(e.detail?.progress ?? 0)));
  window.addEventListener('interiormente:layout', resize);
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { last = 0; if (!document.hidden) { sync(); wake(); } });
  reduced.addEventListener('change', resize);
  // Lo spostamento della scena nei percorsi del menu cambia il suo inizio, non la sequenza.
  new ResizeObserver(resize).observe(section);
  resize();
})();
