/* Menu spaziale: pausa di regia, nove facce reali, ingresso nella galleria. */
(function (global) {
  'use strict';
  const settings = Object.freeze({ pauseAt: .5, quietMs: 180, settleMs: 320, entryMs: 2400 });
  const items = Object.freeze([
    { id: 'giorno', label: 'Zona giorno', destination: 'progetti', background: '#e9e3d8' },
    { id: 'notte', label: 'Zona notte', destination: 'zona-notte', background: '#1b1720' },
    { id: 'bagno', label: 'Zona bagno', background: '#192527', title: 'Il tempo per sé.', copy: 'Disegno un luogo in cui rallentare. La luce incontra la materia e ogni gesto quotidiano trova il proprio spazio.' },
    { id: 'focus', label: 'Zona focus', background: '#24271f', title: 'Spazio alle idee.', copy: 'Parto da come lavori, leggi e crei. Organizzo luce, appoggi e proporzioni perché lo spazio accompagni la tua concentrazione.' },
    { id: 'continua', label: 'Continua lo scroll', action: 'continue' },
    { id: 'progetti', label: 'Progetti', background: '#29221c', title: 'Le idee prendono casa.', copy: 'Ogni progetto nasce da un incontro: il tuo modo di vivere e il mio modo di leggere lo spazio.' },
    { id: 'social', label: 'Social', background: '#24202b', title: 'Il progetto continua qui.', copy: 'Dettagli, ispirazioni e prospettive. Un altro modo per entrare nel mondo di Interiormente.' },
    { id: 'posizione', label: 'Dove trovarmi', background: '#202622', title: 'Incontriamoci.', copy: 'Uno spazio per conoscerci, ascoltare le tue idee e immaginare insieme la tua casa.' },
    { id: 'contatti', label: 'Contatti', background: '#27221e', title: 'Iniziamo dalla tua idea.', copy: 'Raccontami come vivi i tuoi spazi e cosa vorresti cambiare. Progettiamo il prossimo passo, insieme.' }
  ]);
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // Il gesto che raggiunge il menu non può oltrepassarlo con la propria inerzia.
  function createPauseGate(options = settings) {
    let mode = 'before', heldAt = -Infinity, lastInput = -Infinity, previous = null;
    return {
      get mode() { return mode; },
      get holding() { return mode === 'holding'; },
      progress(value, now) {
        const forward = mode === 'before' && value >= options.pauseAt;
        const backward = mode === 'after' && previous !== null && previous > options.pauseAt + .001 && value <= options.pauseAt;
        if (forward || backward) { mode = 'holding'; heldAt = now; }
        previous = value;
        return mode === 'holding' ? options.pauseAt : value;
      },
      input(now) {
        const fresh = mode === 'holding' && now - heldAt >= options.settleMs && now - lastInput >= options.quietMs;
        lastInput = now;
        return fresh;
      },
      hold(now) { mode = 'holding'; heldAt = now; lastInput = now; },
      release(direction = 1) { mode = direction > 0 ? 'after' : 'before'; },
      bypass(value) { mode = value >= options.pauseAt ? 'after' : 'before'; previous = value; lastInput = -Infinity; }
    };
  }

  function routeProgress(raw, pause = settings.pauseAt) { return clamp((raw - pause) / (1 - pause)); }
  // La camera entra nel volume centrale; il viaggio si raccorda all'ultima parte dell'avvicinamento.
  function passageMotion(progress) {
    const q = clamp(progress), zoom = smooth(0, .42, q), travel = smooth(.36, 1, q);
    return { zoom, travel, arrival: smooth(.9, .995, travel) };
  }


  function menuFaces(M, state, w, h, camera) {
    const layout = M.fieldLayout(w), boxes = M.fieldBoxes(w), c = camera || M.centeredFieldCamera(state.fold, w, h, boxes);
    return boxes.filter(b => b.menuIndex >= 0).map(b => {
      const world = b.menuVertices.map(v => M.transformField(v, state.fold, layout.centerZ));
      const quad = world.map(v => M.project(...v, c));
      if (quad.some(v => !v)) return null;
      return { ...b, world, quad, left: Math.min(...quad.map(q => q.x)), top: Math.min(...quad.map(q => q.y)), width: Math.max(...quad.map(q => q.x)) - Math.min(...quad.map(q => q.x)), height: Math.max(...quad.map(q => q.y)) - Math.min(...quad.map(q => q.y)) };
    }).filter(Boolean);
  }

  function create(options) {
    const { section, stage, ctx, M, G, artImages, createSpace, space, getBounds, jump, wake, setProgress } = options;
    const gate = createPauseGate(), pause = settings.pauseAt, reduced = matchMedia('(prefers-reduced-motion:reduce)');
    const nav = document.createElement('nav');
    nav.className = 'tunnel-menu'; nav.setAttribute('aria-label', 'Esplora Interiormente'); nav.inert = true;
    const tiles = items.map((item, index) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tunnel-menu-cell';
      b.dataset.menuDestination = item.id; b.setAttribute('aria-label', item.label);
      const label = document.createElement('span'); label.className = 'tunnel-menu-name'; label.textContent = item.label; b.append(label);
      if (item.action) { b.classList.add('is-continue'); const arrow = document.createElement('span'); arrow.className = 'tunnel-menu-arrow'; arrow.textContent = '↓'; arrow.setAttribute('aria-hidden', 'true'); b.append(arrow); }
      b.addEventListener('click', () => item.action ? resume(1, innerHeight * .15) : select(index));
      b.addEventListener('mouseenter', () => { hoveredMenu = index; wake(); });
      b.addEventListener('mouseleave', () => { hoveredMenu = -1; wake(); });
      b.addEventListener('focus', () => { hoveredMenu = index; wake(); });
      b.addEventListener('blur', () => { hoveredMenu = -1; wake(); });
      nav.append(b); return b;
    });
    const cue = document.createElement('p'); cue.className = 'tunnel-menu-cue'; cue.textContent = 'Scegli dove entrare. Oppure continua a scorrere.'; nav.append(cue); stage.append(nav);
    const back = document.createElement('button'); back.type = 'button'; back.className = 'tunnel-menu-return'; back.textContent = 'Menu'; back.hidden = true;
    back.setAttribute('aria-label', 'Torna al menu dei nove ambienti'); document.body.append(back); back.addEventListener('click', returnToMenu);
    const originalNodes = [document.querySelector('[data-giorno-editorial]'), document.querySelector('[data-zone-transition]'), document.getElementById('zona-notte')].filter(Boolean).map(node => {
      const marker = document.createComment('posizione originale ' + (node.id || 'sezione')); node.before(marker);
      return { node, marker, inert: node.inert };
    });
    const corridorCanvas = document.createElement('canvas'), corridorCtx = corridorCanvas.getContext('2d', { alpha: false });
    const galleryDynamics = G.createDynamics(artImages.length);
    let branch = null, passage = null, route = null, destinationPhoto = null, lastFrame = 0, dimensions = { w: 1, h: 1, dpr: 1 }, autoRAF = 0, autoSerial = 0, restoreRouteLinks = [];
    const menuTextTextures = new Map(); let hoveredMenu = -1;
    document.fonts.ready.then(() => { menuTextTextures.clear(); wake(); });
    const corridorSpace = createSpace(corridorCtx, M, () => destinationPhoto, wake, artImages, G, galleryDynamics);
    const faces = (state, w, h, camera) => menuFaces(M, state, w, h, camera);

    function cancelAuto() { autoSerial++; if (autoRAF) cancelAnimationFrame(autoRAF); autoRAF = 0; }
    function animateScroll(to, duration) {
      cancelAuto();
      const token = autoSerial, from = scrollY, start = performance.now();
      const step = now => {
        if (token !== autoSerial) return;
        const t = clamp((now - start) / duration), ease = t * t * (3 - 2 * t);
        window.scrollTo({ top: from + (to - from) * ease, behavior: 'instant' }); wake();
        if (t < 1 && token === autoSerial) autoRAF = requestAnimationFrame(step); else autoRAF = 0;
      };
      autoRAF = requestAnimationFrame(step); wake();
    }
    function clearRoute() {
      cancelAuto();
      restoreRouteLinks.forEach(restore => restore()); restoreRouteLinks = [];
      for (const saved of originalNodes) {
        saved.marker.after(saved.node); saved.node.classList.remove('is-tunnel-route-hidden'); saved.node.inert = saved.inert;
      }
      route?.remove(); route = null; branch = null; passage = null; destinationPhoto = null;
      window.dispatchEvent(new CustomEvent('interiormente:layout'));
      document.body.classList.remove('has-tunnel-route'); section.removeAttribute('data-menu-selection');
    }
    function latchMenu() {
      clearRoute(); gate.hold(performance.now()); setProgress?.(pause);
      section.dataset.menuGate = 'holding'; section.dataset.menuEntryProgress = '0.0000';
      wake();
    }
    function prepareRoute(item) {
      route = document.createElement('section'); route.className = 'tunnel-selected-route'; route.dataset.menuRoute = item.id; route.style.background = item.background;
      section.after(route);
      const chosen = item.id === 'giorno' ? originalNodes.find(s => s.node.matches('[data-giorno-editorial]'))?.node : item.id === 'notte' ? document.getElementById('zona-notte') : null;
      for (const { node, inert } of originalNodes) {
        const hidden = node !== chosen && item.id !== 'giorno';
        node.classList.toggle('is-tunnel-route-hidden', hidden); node.inert = hidden ? true : inert;
      }
      if (chosen) {
        chosen.inert = false; route.append(chosen);
        if (item.id === 'notte') {
          const link = chosen.querySelector('.notte-end a');
          if (link) {
            const href = link.getAttribute('href'), label = link.textContent, handler = event => { event.preventDefault(); returnToMenu(); };
            link.setAttribute('href', '#progetti'); link.textContent = 'Torna al menu'; link.addEventListener('click', handler);
            restoreRouteLinks.push(() => { link.setAttribute('href', href); link.textContent = label; link.removeEventListener('click', handler); });
          }
        }
      }
      else {
        route.innerHTML = '<div class="tunnel-route-shell"><header><span>Interiormente <small>Design Studio</small></span><button type="button" data-route-menu>Torna al menu</button></header><div class="tunnel-destination-copy"><p data-menu-category></p><h2 tabindex="-1"></h2><p data-menu-description></p></div></div>';
        route.querySelector('[data-menu-category]').textContent = item.label; route.querySelector('h2').textContent = item.title; route.querySelector('[data-menu-description]').textContent = item.copy;
        route.querySelector('[data-route-menu]').addEventListener('click', returnToMenu);
      }
      if (item.id !== 'giorno') { const hint = document.createElement('p'); hint.className = 'tunnel-route-backhint'; hint.textContent = 'Scorri verso l’alto per tornare al menu.'; route.append(hint); }
      window.dispatchEvent(new CustomEvent('interiormente:layout'));
      document.body.classList.add('has-tunnel-route');
    }
    function enforceScroll(y, bounds) {
      const anchor = bounds.start + bounds.range * pause;
      if (branch) {
        if (y > anchor + 3) branch.leftMenu = true;
        if (y < anchor - 1 || (branch.leftMenu && y <= anchor + .75)) {
          latchMenu(); window.scrollTo({ top: anchor, behavior: 'instant' }); return anchor;
        }
        section.dataset.menuGate = 'route'; return y;
      }
      const raw = (y - bounds.start) / bounds.range, held = gate.progress(raw, performance.now());
      if (gate.holding && Math.abs(y - (bounds.start + bounds.range * held)) > .75) {
        y = bounds.start + bounds.range * held; window.scrollTo({ top: y, behavior: 'instant' });
      }
      section.dataset.menuGate = gate.mode; return y;
    }
    function resume(direction = 1, pixels = 70) {
      if (branch) return;
      if (reduced.matches) { document.querySelector('[data-giorno-editorial]').scrollIntoView({ behavior: 'instant' }); return; }
      gate.release(direction); const b = getBounds();
      window.scrollTo({ top: b.start + b.range * pause + direction * Math.max(40, Math.min(innerHeight * .75, Math.abs(pixels))), behavior: 'instant' });
      window.dispatchEvent(new Event('scroll')); wake();
    }
    function beforeJump(value) {
      if (branch) clearRoute();
      if (Math.abs(value - pause) < .00001) gate.hold(performance.now()); else gate.bypass(value);
    }
    function returnToMenu() {
      const b = getBounds(), anchor = b.start + b.range * pause;
      if (branch && !reduced.matches && Math.abs(scrollY - anchor) > 4) { animateScroll(anchor, Math.min(1600, 650 + Math.abs(scrollY - anchor) * .2)); return; }
      latchMenu();
      if (reduced.matches) nav.scrollIntoView({ behavior: 'instant', block: 'center' }); else jump(pause);
      requestAnimationFrame(() => tiles[4].focus({ preventScroll: true }));
    }
    function photoFor(item) {
      if (item.id === 'giorno') return window.InteriormenteRoom?.poster(dimensions.w, dimensions.h) || section.querySelector('[data-giorno-image]');
      const c = document.createElement('canvas'); c.width = Math.ceil(dimensions.w); c.height = Math.ceil(dimensions.h);
      const t = c.getContext('2d'); t.fillStyle = item.background; t.fillRect(0, 0, c.width, c.height); return c;
    }
    function select(index) {
      if (branch) return;
      jump(pause); const item = items[index]; destinationPhoto = photoFor(item); galleryDynamics.reset(0);
      prepareRoute(item); branch = { index, item, progress: 0, leftMenu: false }; gate.release(1);
      section.dataset.menuSelection = item.id; nav.inert = true;
      if (reduced.matches) { route.scrollIntoView({ behavior: 'instant' }); back.hidden = false; return; }
      animateScroll(route.getBoundingClientRect().top + scrollY, settings.entryMs);
    }
    function fieldCamera(state, w, h, boxes) {
      const entry = branch || passage;
      if (!entry) return null;
      const base = M.centeredFieldCamera(1, w, h, boxes), tile = faces(M.state(pause), w, h, base).find(b => b.menuIndex === entry.index);
      const center = tile.world[0].map((v, i) => (v + tile.world[2][i]) / 2);
      const zoom = entry.central ? passageMotion(entry.progress).zoom : smooth(0, .4, entry.progress);
      const from = center[2] - base.z, to = 2 * tile.s * base.focal / (Math.max(w, h) * 1.08), distance = from + (to - from) * zoom;
      return { ...base, z: center[2] - distance, cx: w / 2 - center[0] * zoom * base.focal / distance, cy: h / 2 + center[1] * zoom * base.focal / distance, roll: 0 };
    }

    function reveal(state) { return smooth(pause - .028, pause - .002, state.raw ?? 0) * smooth(.94, 1, state.fold) * (1 - smooth(pause + .003, pause + .026, state.raw ?? 0)); }
    function labelTexture(item, mobile) {
      const key = item.id + (mobile ? ':mobile' : ':desktop');
      if (menuTextTextures.has(key)) return menuTextTextures.get(key);
      const c = document.createElement('canvas'); c.width = c.height = 640;
      const t = c.getContext('2d'); t.textAlign = 'center'; t.textBaseline = 'middle';
      const isContinue = !!item.action;
      let lines = isContinue ? ['Continua lo', 'scroll'] : mobile && /^Zona /.test(item.label) ? ['Zona', item.label.slice(5)] : [item.label];
      if (mobile && item.id === 'posizione') lines = ['Dove', 'trovarmi'];
      let fontSize = mobile ? 82 : 62;
      t.font = `400 ${fontSize}px ${isContinue ? 'Arial,sans-serif' : 'Aboreto,serif'}`;
      const width = Math.max(...lines.map(line => t.measureText(line).width));
      if (width > 548) { fontSize *= 548 / width; t.font = `400 ${fontSize}px ${isContinue ? 'Arial,sans-serif' : 'Aboreto,serif'}`; }
      t.fillStyle = isContinue ? '#d0b77e' : '#ded8cb';
      const step = fontSize * 1.3, centerY = isContinue ? 285 : 320;
      t.strokeStyle = t.fillStyle; t.lineWidth = isContinue ? .55 : 1.25; t.lineJoin = 'round';
      lines.forEach((line, i) => { const y = centerY + (i - (lines.length - 1) / 2) * step; t.strokeText(line, 320, y); t.fillText(line, 320, y); });
      if (isContinue) { t.font = `300 ${mobile ? 100 : 86}px Arial,sans-serif`; t.fillText('↓', 320, 442); }
      menuTextTextures.set(key, c); return c;
    }
    function paintFaces(state, w, h, camera, paintPlane) {
      const alpha = ((branch || passage) ? (1 - smooth(0, .13, (branch || passage).progress)) : reveal(state)) * state.field;
      if (alpha < .001 || !paintPlane) return;
      for (const q of faces(state, w, h, camera)) {
        const texture = labelTexture(items[q.menuIndex], w < 700);
        const u = q.world[1].map((v, i) => v - q.world[0][i]);
        const v = q.world[3].map((v, i) => v - q.world[0][i]);
        paintPlane(texture, q.world[0], u, v, camera, alpha, w, h, point => point, false, 8, 8);
        // Si illumina soltanto il bordo gia esistente, al passaggio o al focus.
        if (!branch && !passage && hoveredMenu === q.menuIndex) {
          ctx.save(); ctx.globalAlpha = alpha; ctx.beginPath();
          q.quad.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
          ctx.strokeStyle = '#d3b77e'; ctx.lineWidth = 1.1; ctx.stroke(); ctx.restore();
        }
      }
    }

    function pose(state, w, h) {
      const raw = state.raw ?? 0, alpha = reveal(state), entry = branch || passage;
      nav.style.opacity = entry ? String(1 - smooth(0, .12, entry.progress)) : String(alpha);
      nav.inert = !!entry || alpha < .995 || state.fold < .999;
      nav.setAttribute('aria-hidden', String(alpha < .02 && !entry));
      for (const q of faces(state, w, h, entry ? fieldCamera(state, w, h, M.fieldBoxes(w)) : null)) {
        const b = tiles[q.menuIndex]; b.style.left = q.left + 'px'; b.style.top = q.top + 'px'; b.style.width = q.width + 'px'; b.style.height = q.height + 'px';
        b.style.clipPath = 'polygon(' + q.quad.map(p => ((p.x - q.left) / q.width * 100) + '% ' + ((p.y - q.top) / q.height * 100) + '%').join(',') + ')';
      }
      stage.classList.toggle('is-menu-pose', alpha > .1 || !!entry); back.hidden = !branch && raw < pause + .07;
      section.dataset.menuVisible = String(alpha > .995 && !entry && state.fold > .999);
      section.dataset.menuStable = String(gate.holding && Math.abs(raw - pause) < .001 && state.fold > .999 && !entry);
    }
    function render(time, state, w, h, dpr) {
      dimensions = { w, h, dpr };
      if (branch) passage = null;
      else if ((state.raw ?? 0) > pause + .001) { // tolleranza per l’arrotondamento dello scroll al menu
        if (!passage) galleryDynamics.reset(0);
        passage = { index: 4, central: true, progress: routeProgress(state.raw, pause) };
        destinationPhoto = photoFor(items[0]);
      } else {
        if (passage) galleryDynamics.reset(0);
        passage = null; pose(state, w, h); section.dataset.centralPassage = 'false'; return false;
      }
      const entry = branch || passage;
      entry.progress = routeProgress(state.raw, pause);
      const progress = entry.progress, rest = M.state(pause);
      space.render(rest, w, h, dpr); pose(rest, w, h);
      const camera = fieldCamera(rest, w, h, M.fieldBoxes(w)), tile = faces(rest, w, h, camera).find(b => b.menuIndex === entry.index);
      const travel = entry.central ? passageMotion(progress).travel : smooth(.4, 1, progress);
      const cp = .53 + travel * .37, cw = Math.round(w * dpr), ch = Math.round(h * dpr);
      if (corridorCanvas.width !== cw || corridorCanvas.height !== ch) { corridorCanvas.width = cw; corridorCanvas.height = ch; }
      galleryDynamics.step(travel, Math.min(50, time - lastFrame || 16)); lastFrame = time;
      corridorSpace.render({ p: cp, raw: pause, fold: 1, travel, tunnel: 1, field: 0, arrival: 0 }, w, h, dpr);
      if (tile) {
        ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.beginPath(); tile.quad.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.clip();
        ctx.drawImage(corridorCanvas, 0, 0, cw, ch, tile.left + tile.width / 2 - w / 2, tile.top + tile.height / 2 - h / 2, w, h); ctx.restore();
      }
      section.dataset.menuEntryProgress = progress.toFixed(4); section.dataset.menuGalleryVisible = String(corridorSpace.visibleArt);
      section.dataset.centralPassage = String(!!entry.central);
      section.dataset.centralZoom = String(entry.central ? passageMotion(progress).zoom.toFixed(4) : '');
      section.dataset.centralTravel = String(entry.central ? travel.toFixed(4) : '');
      section.dataset.centralFaceWidth = tile ? tile.width.toFixed(1) : '';
      section.dataset.menuGate = branch ? 'route' : 'after'; return true;
    }

    let lastTouch = null, freshTouch = false;
    window.addEventListener('wheel', e => {
      if (branch) { cancelAuto(); return; }
      const fresh = gate.input(performance.now()); if (!gate.holding) return;
      e.preventDefault(); if (fresh && Math.abs(e.deltaY) > 1) resume(Math.sign(e.deltaY), e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1));
    }, { passive: false });
    window.addEventListener('touchstart', e => { if (branch) { cancelAuto(); return; } lastTouch = e.touches[0]?.clientY ?? null; freshTouch = gate.input(performance.now()); }, { passive: true });
    window.addEventListener('touchmove', e => {
      if (branch || !gate.holding || lastTouch === null) return;
      const dy = lastTouch - (e.touches[0]?.clientY ?? lastTouch); e.preventDefault();
      if (freshTouch && Math.abs(dy) > 12) { freshTouch = false; resume(Math.sign(dy), dy); }
    }, { passive: false });
    window.addEventListener('touchend', () => { lastTouch = null; freshTouch = false; }, { passive: true });
    window.addEventListener('keydown', e => {
      if (branch && e.key === 'Escape') { e.preventDefault(); returnToMenu(); return; }
      const direction = ['ArrowDown', 'PageDown', ' '].includes(e.key) ? 1 : ['ArrowUp', 'PageUp'].includes(e.key) ? -1 : 0;
      if (branch && (direction || ['Home', 'End'].includes(e.key))) { cancelAuto(); return; }
      if (!direction || e.target.closest?.('button,a,input,textarea,select')) return;
      const fresh = gate.input(performance.now()); if (gate.holding) { e.preventDefault(); if (fresh && !e.repeat) resume(direction, e.key.includes('Page') ? innerHeight * .6 : 80); }
    });
    window.addEventListener('interiormente:room-jump', () => { if (branch && branch.item.id !== 'giorno') clearRoute(); gate.bypass(1); });
    window.addEventListener('interiormente:room-ready', wake);
    window.addEventListener('interiormente:menu', returnToMenu);
    window.addEventListener('interiormente:seek', e => { if (branch && Number(e.detail) < 1) { clearRoute(); gate.bypass(0); } });
    return {
      enforceScroll, beforeJump, fieldCamera, render, returnToMenu, paintFaces,
      showReduced() { nav.inert = false; nav.removeAttribute('aria-hidden'); back.hidden = !branch; },
      get animating() { return autoRAF !== 0 || galleryDynamics.active(); },
      get hasSelectedRoute() { return !!branch; },
      get visibleArt() { return corridorSpace.visibleArt; },
      get galleryTilt() { return Math.max(0, ...galleryDynamics.nodes.map(n => Math.abs(n.angle))); },
      triadOpacity() { return 1; },
      hideFieldWord(box, state) { return box.menuIndex >= 0 && state.fold > .9; },
      get pauseAt() { return pause; }
    };
  }

  global.InteriormenteTunnelMenu = { create, createPauseGate, routeProgress, passageMotion, menuFaces, settings, items };
})(window);
