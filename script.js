(function () {
  'use strict';

  // Runs cb once the intro curtain has lifted (html.is-loaded), plus an optional delay.
  function whenIntroDone(cb, delay) {
    const root = document.documentElement;
    const go = () => setTimeout(cb, delay || 0);
    if (root.classList.contains('is-loaded')) return go();
    const mo = new MutationObserver(() => {
      if (root.classList.contains('is-loaded')) { mo.disconnect(); go(); }
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  // 129 frame images in exact sequence
  const frameFiles = [
    "ezgif-frame-001.jpg","ezgif-frame-002.jpg","ezgif-frame-003.jpg","ezgif-frame-004.jpg","ezgif-frame-005.jpg",
    "ezgif-frame-006.jpg","ezgif-frame-007.jpg","ezgif-frame-008.jpg","ezgif-frame-009.jpg","ezgif-frame-010.jpg",
    "ezgif-frame-011.jpg","ezgif-frame-012.jpg","ezgif-frame-013.jpg","ezgif-frame-014.jpg","ezgif-frame-015.jpg",
    "ezgif-frame-016.jpg","ezgif-frame-017.jpg","ezgif-frame-018.jpg","ezgif-frame-019.jpg","ezgif-frame-020.jpg",
    "ezgif-frame-021.jpg","ezgif-frame-022.jpg","ezgif-frame-023.jpg","ezgif-frame-024.jpg","ezgif-frame-025.jpg",
    "ezgif-frame-026.jpg","ezgif-frame-027.jpg","ezgif-frame-051.jpg","ezgif-frame-052.jpg","ezgif-frame-053.jpg",
    "ezgif-frame-054.jpg","ezgif-frame-055.jpg","ezgif-frame-056.jpg","ezgif-frame-057.jpg","ezgif-frame-058.jpg",
    "ezgif-frame-059.jpg","ezgif-frame-060.jpg","ezgif-frame-061.jpg","ezgif-frame-062.jpg","ezgif-frame-063.jpg",
    "ezgif-frame-064.jpg","ezgif-frame-065.jpg","ezgif-frame-066.jpg","ezgif-frame-067.jpg","ezgif-frame-068.jpg",
    "ezgif-frame-069.jpg","ezgif-frame-070.jpg","ezgif-frame-071.jpg","ezgif-frame-072.jpg","ezgif-frame-073.jpg",
    "ezgif-frame-074.jpg","ezgif-frame-075.jpg","ezgif-frame-076.jpg","ezgif-frame-077.jpg","ezgif-frame-078.jpg",
    "ezgif-frame-079.jpg","ezgif-frame-080.jpg","ezgif-frame-081.jpg","ezgif-frame-082.jpg","ezgif-frame-083.jpg",
    "ezgif-frame-084.jpg","ezgif-frame-085.jpg","ezgif-frame-086.jpg","ezgif-frame-087.jpg","ezgif-frame-088.jpg",
    "ezgif-frame-089.jpg","ezgif-frame-090.jpg","ezgif-frame-091.jpg","ezgif-frame-092.jpg","ezgif-frame-093.jpg",
    "ezgif-frame-094.jpg","ezgif-frame-095.jpg","ezgif-frame-096.jpg","ezgif-frame-097.jpg","ezgif-frame-098.jpg",
    "ezgif-frame-099.jpg","ezgif-frame-100.jpg","ezgif-frame-101.jpg","ezgif-frame-102.jpg","ezgif-frame-103.jpg",
    "ezgif-frame-104.jpg","ezgif-frame-105.jpg","ezgif-frame-106.jpg","ezgif-frame-107.jpg","ezgif-frame-108.jpg",
    "ezgif-frame-109.jpg","ezgif-frame-110.jpg","ezgif-frame-111.jpg","ezgif-frame-112.jpg","ezgif-frame-113.jpg",
    "ezgif-frame-114.jpg","ezgif-frame-115.jpg","ezgif-frame-116.jpg","ezgif-frame-117.jpg","ezgif-frame-118.jpg",
    "ezgif-frame-119.jpg","ezgif-frame-120.jpg","ezgif-frame-121.jpg","ezgif-frame-122.jpg","ezgif-frame-123.jpg",
    "ezgif-frame-124.jpg","ezgif-frame-125.jpg","ezgif-frame-126.jpg","ezgif-frame-127.jpg","ezgif-frame-128.jpg",
    "ezgif-frame-129.jpg","ezgif-frame-130.jpg","ezgif-frame-131.jpg","ezgif-frame-132.jpg","ezgif-frame-133.jpg",
    "ezgif-frame-134.jpg","ezgif-frame-135.jpg","ezgif-frame-136.jpg","ezgif-frame-137.jpg","ezgif-frame-138.jpg",
    "ezgif-frame-139.jpg","ezgif-frame-140.jpg","ezgif-frame-141.jpg","ezgif-frame-142.jpg","ezgif-frame-143.jpg",
    "ezgif-frame-144.jpg","ezgif-frame-145.jpg","ezgif-frame-146.jpg","ezgif-frame-147.jpg","ezgif-frame-148.jpg",
    "ezgif-frame-149.jpg","ezgif-frame-150.jpg","ezgif-frame-151.jpg","ezgif-frame-152.jpg"
  ];

  const totalFrames = frameFiles.length;
  const canvas = document.getElementById('scroll-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const frames = new Array(totalFrames);   // decoded, draw-ready frames (ImageBitmap or <img>)
  const requested = new Array(totalFrames);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
  const enableCanvasAnimation = !prefersReducedMotion && !isSmallScreen;

  let targetProgress = 0;
  let currentProgress = 0;
  let lastDrawnIndex = -1;
  let needsRedraw = true;
  let loopRunning = false;

  // -------------------------------------------------------------
  // 1. CANVAS BUFFER — capped at 1280px wide. The frames are soft video
  //    under a dark scrim, so a larger buffer only costs time, not quality.
  // -------------------------------------------------------------
  const MAX_BUFFER_W = 1024;
  function resizeCanvas() {
    const s = Math.min(1, MAX_BUFFER_W / window.innerWidth);
    const w = Math.round(window.innerWidth * s);
    const h = Math.round(window.innerHeight * s);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      needsRedraw = true;
      flushCache();                       // cached frames were sized for the old buffer
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
  }

  // -------------------------------------------------------------
  // 2. FOCAL-POINT COVER GEOMETRY + DRAW
  //    Frames are pre-scaled to exactly this rect when decoded, so each
  //    scroll step is a plain 1:1 copy — no per-frame resampling.
  // -------------------------------------------------------------
  let srcW = 1920, srcH = 1080;
  function coverRect() {
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.max(cw / srcW, ch / srcH);
    const nw = Math.round(srcW * scale);
    const nh = Math.round(srcH * scale);
    let ox;
    if (cw / ch < srcW / srcH) {
      const focusRatio = window.innerWidth <= 768 ? 0.70 : 0.60;
      ox = Math.round(cw * 0.5 - nw * focusRatio);
      ox = Math.min(0, Math.max(cw - nw, ox));
    } else {
      ox = Math.round((cw - nw) * 0.5);
    }
    return { nw, nh, ox, oy: Math.round((ch - nh) * 0.5) };
  }

  function drawFrame(f) {
    const r = coverRect();
    if (f.width === r.nw && f.height === r.nh) ctx.drawImage(f, r.ox, r.oy);
    else ctx.drawImage(f, r.ox, r.oy, r.nw, r.nh);
  }

  function nearestFrame(index) {
    if (frames[index]) return frames[index];
    for (let o = 1; o < totalFrames; o++) {
      if (index - o >= 0 && frames[index - o]) return frames[index - o];
      if (index + o < totalFrames && frames[index + o]) return frames[index + o];
    }
    return null;
  }

  // -------------------------------------------------------------
  // 3. LOADING — every frame is decoded off the main thread and stored
  //    pre-shrunk to the canvas size (~3 MB each instead of ~8 MB), so
  //    scrolling never waits on a decode and memory stays about a third
  //    of a full-size cache.
  // -------------------------------------------------------------
  const MAX_IN_FLIGHT = 4;
  const WINDOW = totalFrames;             // keep the whole (pre-shrunk) sequence: no re-decoding mid-scroll
  let inFlight = 0;
  let cached = 0;
  let generation = 0;
  const BOOT_FRAMES = Math.min(8, totalFrames);
  let settledCount = 0;
  window.__framesProgress = enableCanvasAnimation ? 0 : 1;

  function releaseFrame(i) {
    const f = frames[i];
    if (f && f.close) f.close();
    frames[i] = null;
    requested[i] = false;
    cached--;
  }

  function flushCache() {
    generation++;
    for (let i = 0; i < totalFrames; i++) {
      if (frames[i]) releaseFrame(i);
      requested[i] = false;
    }
    cached = 0;
    if (typeof pump === 'function') setTimeout(pump, 0);
  }

  function evictFar(center) {
    for (let i = 0; i < totalFrames; i++) {
      if (frames[i] && Math.abs(i - center) > WINDOW + 4) releaseFrame(i);
    }
  }

  function decodeFrame(index) {
    requested[index] = true;
    inFlight++;
    const gen = generation;
    const img = new Image();
    img.decoding = 'async';
    // Load the light WebP version first; fall back to the original JPG if it is missing
    const load = src => new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = src;
    }).then(() => (img.decode ? img.decode().catch(() => {}) : null));
    const webp = frameFiles[index].replace(/\.jpg$/, '.webp');
    const ready = load(webp).catch(() => load(frameFiles[index]));
    ready
      .then(() => {
        srcW = img.naturalWidth || srcW;
        srcH = img.naturalHeight || srcH;
        if (!window.createImageBitmap) return img;
        const r = coverRect();
        return createImageBitmap(img, { resizeWidth: r.nw, resizeHeight: r.nh, resizeQuality: 'medium' })
          .catch(() => createImageBitmap(img).catch(() => img));
      })
      .then(bmp => {
        if (gen !== generation) { if (bmp.close) bmp.close(); return; }   // stale (canvas resized); flushCache already reset it
        frames[index] = bmp;
        cached++;
        if (index === currentIndex() || lastDrawnIndex === -1) needsRedraw = true;
        kick();
      })
      .catch(() => { /* missing or broken frame: leave it marked as requested so it is never retried */ })
      .finally(() => {
        inFlight--;
        settledCount++;
        window.__framesProgress = Math.min(1, settledCount / BOOT_FRAMES);
        pump();
      });
  }

  function currentIndex() {
    return Math.min(totalFrames - 1, Math.max(0, Math.round(currentProgress * (totalFrames - 1))));
  }

  function pump() {
    if (!enableCanvasAnimation) return;
    const center = Math.round(targetProgress * (totalFrames - 1));
    evictFar(center);
    for (let o = 0; o <= WINDOW && inFlight < MAX_IN_FLIGHT; o++) {
      const a = center + o, b = center - o;
      if (a < totalFrames && !requested[a]) decodeFrame(a);
      if (inFlight >= MAX_IN_FLIGHT) break;
      if (o && b >= 0 && !requested[b]) decodeFrame(b);
    }
  }

  // -------------------------------------------------------------
  // 4. SCROLL PROGRESS (cached layout values — no reflow per scroll)
  // -------------------------------------------------------------
  let maxScroll = 1;
  function measure() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }
  function updateScrollProgress() {
    targetProgress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
    pump();
    kick();
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', () => { resizeCanvas(); measure(); updateScrollProgress(); }, { passive: true });
  window.addEventListener('load', () => { measure(); updateScrollProgress(); });
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);

  // -------------------------------------------------------------
  // 5. RENDER LOOP — exponential smoothing, draws only when the frame
  //    actually changes, and sleeps completely when scrolling stops.
  // -------------------------------------------------------------
  let lastTime = 0;
  function kick() {
    if (!enableCanvasAnimation || loopRunning) return;
    loopRunning = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // The page scroll itself is eased (inertia scroll), so the frames track it closely
    currentProgress += (targetProgress - currentProgress) * (1 - Math.exp(-16 * dt));
    const settled = Math.abs(targetProgress - currentProgress) < 0.0002;
    if (settled) currentProgress = targetProgress;

    const idx = currentIndex();
    if (idx !== lastDrawnIndex || needsRedraw) {
      const f = nearestFrame(idx);
      if (f) {
        drawFrame(f);
        lastDrawnIndex = idx;
        needsRedraw = false; // if this was a stand-in, the exact frame's arrival re-triggers a draw
      }
    }

    if (settled && !needsRedraw) { loopRunning = false; return; }
    requestAnimationFrame(loop);
  }

  resizeCanvas();
  measure();
  targetProgress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
  currentProgress = targetProgress;

  if (enableCanvasAnimation) {
    decodeFrame(Math.round(targetProgress * (totalFrames - 1)));
    pump();
    kick();
  }

  // -------------------------------------------------------------
  // 5. NAVBAR SCROLL SHRINK & MOBILE DRAWER
  // -------------------------------------------------------------
  const nav = document.querySelector('.site-nav');
  const scrollTopBtn = document.getElementById('scroll-top-btn');

  function updateChrome() {
    const y = window.scrollY || 0;
    nav?.classList.toggle('scrolled', y > 40);
    scrollTopBtn?.classList.toggle('visible', y > 350);
  }

  window.addEventListener('scroll', updateChrome, { passive: true });
  updateChrome();

  const hamburger = document.getElementById('hamburger-btn');
  const drawer = document.getElementById('mobile-drawer');

  if (hamburger && drawer) {
    hamburger.addEventListener('click', () => {
      const isOpen = drawer.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      hamburger.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    drawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        drawer.classList.remove('open');
        hamburger.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // -------------------------------------------------------------
  // 6. SCROLL TO TOP FLOATING BUTTON
  // -------------------------------------------------------------
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      if (window.__glideTo) window.__glideTo(0);
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer?.classList.contains('open')) {
      drawer.classList.remove('open');
      hamburger?.classList.remove('open');
      hamburger?.setAttribute('aria-expanded', 'false');
      hamburger?.setAttribute('aria-label', 'Open navigation menu');
      document.body.style.overflow = '';
    }
  });

  // -------------------------------------------------------------
  // 7. SCROLL REVEAL OBSERVER
  // -------------------------------------------------------------
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -40px 0px',
    threshold: 0.12
  };

  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Stagger index for each grid child (drives the entrance delay in CSS)
  document.querySelectorAll('.stagger-parent').forEach(parent => {
    Array.from(parent.children).forEach((child, i) => child.style.setProperty('--si', Math.min(i, 9)));
  });

  whenIntroDone(() => {
    document.querySelectorAll('.reveal-on-scroll, .stagger-parent').forEach(el => {
      revealObserver.observe(el);
    });
  }, 120);

  // -------------------------------------------------------------
  // 8. ANIMATED STAT COUNTERS
  // -------------------------------------------------------------
  function runCounter(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target)) return;
    const duration = 1800;
    const start = performance.now();

    function update(now) {
      const elapsed = Math.min((now - start) / duration, 1);
      const eased = elapsed === 1 ? 1 : 1 - Math.pow(2, -10 * elapsed);
      el.textContent = Math.round(target * eased);
      if (elapsed < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target;
      }
    }
    requestAnimationFrame(update);
  }

  const counterObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        runCounter(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  whenIntroDone(() => {
    document.querySelectorAll('.stat-count').forEach(el => {
      counterObserver.observe(el);
    });
  }, 350);

})();


/* ==========================================================================
   PREMIUM MOTION LAYER
   Intro release · word-split reveals · scroll progress · smart nav ·
   hero parallax · scrollspy · magnetic buttons · 3D tilt + spotlight ·
   cursor follower. Everything is skipped for reduced-motion users, and
   pointer effects only run on real mouse/trackpad devices.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.documentElement;
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function whenLoaded(cb) {
    if (root.classList.contains('is-loaded')) return cb();
    const mo = new MutationObserver(() => {
      if (root.classList.contains('is-loaded')) { mo.disconnect(); cb(); }
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  }
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // -------------------------------------------------------------
  // A. SCROLLSPY (active nav link) — useful for everyone
  // -------------------------------------------------------------
  const navLinks = $$('.nav-menu .nav-link');
  const linkById = {};
  navLinks.forEach(l => { linkById[(l.getAttribute('href') || '').slice(1)] = l; });
  const sectionAlias = { 'selected-work': 'services', 'research-services': 'services', 'track-record': 'services' };

  const spy = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = sectionAlias[entry.target.id] || entry.target.id;
      navLinks.forEach(l => l.classList.toggle('is-active', l === linkById[id]));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => spy.observe(s));

  // -------------------------------------------------------------
  // B. SCROLL-LINKED: progress bar, smart nav, hero parallax
  // -------------------------------------------------------------
  const nav = document.querySelector('.site-nav');
  const drawer = document.getElementById('mobile-drawer');
  const heroGrid = document.querySelector('.hero-section .hero-grid');
  const progressBar = document.querySelector('.scroll-progress');
  const topBtn = document.getElementById('scroll-top-btn');
  let heroParked = false;
  const contentWrap = document.querySelector('.content-wrapper');
  let scrollIdleTimer = 0;
  let lastY = window.scrollY;
  let ticking = false;

  function onScrollFrame() {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const sp = max > 0 ? Math.min(y / max, 1).toFixed(4) : 0;
    if (progressBar) progressBar.style.transform = 'scaleX(' + sp + ')';
    if (topBtn) topBtn.style.setProperty('--scroll-p', sp);

    if (reduceMotion) return;

    // Hide nav while reading down, bring it back on any upward scroll
    const drawerOpen = drawer && drawer.classList.contains('open');
    if (nav && !drawerOpen) {
      if (y > lastY + 6 && y > 260) nav.classList.add('nav-hidden');
      else if (y < lastY - 6 || y <= 260) nav.classList.remove('nav-hidden');
    }
    lastY = y;

    if (contentWrap) {
      if (!contentWrap.classList.contains('is-scrolling')) contentWrap.classList.add('is-scrolling');
      clearTimeout(scrollIdleTimer);
      scrollIdleTimer = setTimeout(() => contentWrap.classList.remove('is-scrolling'), 140);
    }

    // Hero drifts and fades as it leaves
    if (heroGrid) {
      const vh = window.innerHeight;
      if (y < vh * 1.2) {
        heroParked = false;
        const t = y / vh;
        heroGrid.style.transform = 'translate3d(0,' + (y * 0.22).toFixed(1) + 'px,0)';
        heroGrid.style.opacity = Math.max(0, 1 - t * 1.1).toFixed(3);
      } else if (!heroParked) {
        heroParked = true;             // stop writing styles once the hero is off-screen
        heroGrid.style.opacity = '0';
      }
    }
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
  }, { passive: true });
  onScrollFrame();

  // Keyboard users: never leave the nav hidden while it has focus
  nav && nav.addEventListener('focusin', () => nav.classList.remove('nav-hidden'));

  if (reduceMotion) return; // nothing below should run for reduced-motion users

  // -------------------------------------------------------------
  // C. WORD SPLITTING for masked line reveals
  // -------------------------------------------------------------
  function splitWords(el) {
    if (!el || el.dataset.split) return;
    el.dataset.split = '1';
    let i = 0;
    (function walk(node) {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.className = 'w-i';
            inner.style.setProperty('--i', i++);
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
    el.classList.add('is-split');
  }

  splitWords(document.querySelector('.hero-title'));

  // Section headers: badge → title words → subtitle → description, in sequence
  const headSel = '.section-badge, .section-tag, .section-eyebrow, .section-title, .section-subtitle-accent, .section-description, .section-sub';
  const headObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-in'); obs.unobserve(entry.target); }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -40px 0px' });

  const parents = new Map();
  $$(headSel).forEach(el => {
    if (el.closest('.reveal-on-scroll, .hero-section')) return; // already animated by its container
    const p = el.parentElement;
    const idx = parents.get(p) || 0;
    parents.set(p, idx + 1);
    const delay = idx * 110;
    if (el.matches('.section-title')) {
      el.setAttribute('data-text', el.textContent.replace(/\s+/g, ' ').trim());
      splitWords(el);
      el.classList.add('split-reveal');
      el.style.setProperty('--base', delay + 'ms');
    } else {
      el.classList.add('reveal-up');
      el.style.setProperty('--rd', delay + 'ms');
    }
    headObserver.observe(el);
  });

  // -------------------------------------------------------------
  // D. SYSTEM BOOT LOADER — the % counter follows real progress:
  //    fonts + the first background frames decoding. Never waits
  //    longer than ~4.5s, never shows for less than ~1.6s.
  // -------------------------------------------------------------
  (function bootLoader() {
    const pctEl = document.getElementById('boot-pct');
    const barEl = document.getElementById('boot-bar');
    const statusEl = document.getElementById('boot-status');
    if (root.classList.contains('is-loaded')) return;   // repeat visit this session: no loader
    const t0 = performance.now();
    const MIN_MS = 700, MAX_MS = 1500;
    let fontsDone = !document.fonts;
    if (document.fonts) document.fonts.ready.then(() => { fontsDone = true; });
    let shown = 0;
    const stages = [[0, 'Loading modules…'], [0.35, 'Decoding timeline frames…'], [0.7, 'Calibrating interface…'], [0.97, 'System ready']];

    function tick(now) {
      const elapsed = now - t0;
      const real = Math.min(window.__framesProgress == null ? 1 : window.__framesProgress, fontsDone ? 1 : 0.85);
      const timeCap = Math.min(1, elapsed / MIN_MS);                 // keeps the count readable
      let goal = Math.min(real, timeCap);
      if (elapsed > MAX_MS) goal = 1;
      shown += (goal - shown) * 0.25;
      if (goal === 1 && shown > 0.995) shown = 1;

      const pct = Math.round(shown * 100);
      if (pctEl) pctEl.textContent = pct;
      if (barEl) barEl.style.transform = 'scaleX(' + shown.toFixed(3) + ')';
      if (statusEl) {
        let label = stages[0][1];
        stages.forEach(([at, text]) => { if (shown >= at) label = text; });
        if (statusEl.textContent !== label) statusEl.textContent = label;
      }

      if (shown >= 1) {
        try { sessionStorage.setItem('mh-intro-seen', '1'); } catch (e) {}
        setTimeout(() => root.classList.add('is-loaded'), 80);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  // -------------------------------------------------------------
  // D2. INERTIA SCROLL + EASED ANCHOR GLIDES
  //     Mouse-wheel input is eased toward its target with a frame-rate
  //     independent lerp; anchor links and back-to-top glide with an
  //     ease-in-out curve. Touch, keyboard and scrollbar stay native.
  // -------------------------------------------------------------
  (function inertiaScroll() {
    const NAV_OFFSET = 84;
    const LERP = 7;                        // higher = snappier, lower = floatier
    let target = window.scrollY;
    let current = target;
    let mode = 'idle';                     // 'idle' | 'lerp' | 'tween'
    let tween = null;
    let last = 0;

    root.classList.add('smooth-scroll');   // disables CSS scroll-behavior so we own the easing

    const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const clamp = y => Math.min(Math.max(y, 0), maxY());
    const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (mode === 'tween') {
        const t = Math.min((now - tween.start) / tween.dur, 1);
        current = tween.from + (tween.to - tween.from) * easeInOut(t);
        if (t >= 1) mode = 'idle';
      } else if (mode === 'lerp') {
        current += (target - current) * (1 - Math.exp(-LERP * dt));
        if (Math.abs(target - current) < 0.4) { current = target; mode = 'idle'; }
      }

      window.scrollTo(0, current);
      if (mode !== 'idle') requestAnimationFrame(frame);
    }

    function run(newMode) {
      const wasIdle = mode === 'idle';
      mode = newMode;
      if (wasIdle) { last = performance.now(); requestAnimationFrame(frame); }
    }

    // Wheel scrolling is left native: instant response, browser-smoothed.

    // Keyboard, scrollbar drag, touch: stay in sync and yield immediately
    window.addEventListener('scroll', () => {
      if (mode === 'idle') { current = target = window.scrollY; return; }
      if (Math.abs(window.scrollY - Math.round(current)) > 3) {            // someone else moved the page
        mode = 'idle';
        current = target = window.scrollY;
      }
    }, { passive: true });

    ['keydown', 'touchstart', 'mousedown'].forEach(ev =>
      window.addEventListener(ev, e => {
        if (ev === 'mousedown' && e.target !== document.documentElement) return; // only scrollbar grabs
        if (ev === 'keydown' && !/^(Arrow|Page|Home|End| )/.test(e.key)) return;
        mode = 'idle';
        current = target = window.scrollY;
      }, { passive: true })
    );

    // Eased glide to a Y position (used by anchors and back-to-top)
    function glideTo(y) {
      const to = clamp(y);
      const from = window.scrollY;
      const dist = Math.abs(to - from);
      if (dist < 2) return;
      tween = { from, to, start: performance.now(), dur: Math.min(900, Math.max(450, dist * 0.25)) };
      current = from;
      target = to;
      run('tween');
    }
    window.__glideTo = glideTo;

    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.classList.contains('skip-link') || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const hash = a.getAttribute('href');
      const el = hash === '#' || hash === '#top' ? null : document.querySelector(hash);
      if (hash !== '#' && hash !== '#top' && !el) return;
      e.preventDefault();
      const y = el ? el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET + 1 : 0;
      glideTo(y);
      if (history.replaceState) history.replaceState(null, '', hash === '#' ? location.pathname : hash);
    });
  })();

  // -------------------------------------------------------------
  // D3. TERMINAL CARD — retypes its code when scrolled into view
  // -------------------------------------------------------------
  (function terminalTyper() {
    const code = document.getElementById('terminal-code');
    if (!code) return;
    // Tokenise the pre-rendered, highlighted markup into [text, className] runs
    const runs = [];
    code.childNodes.forEach(n => {
      if (n.nodeType === 3) runs.push([n.textContent, '']);
      else runs.push([n.textContent, n.className]);
    });
    const total = runs.reduce((a, r) => a + r[0].length, 0);
    // Lock the box to the size of the finished text so typing never resizes the card
    const box = code;
    box.style.height = box.offsetHeight + 'px';
    box.style.overflow = 'hidden';
    code.innerHTML = '<span class="terminal-caret"></span>';

    function render(count) {
      let html = '', left = count;
      for (const [text, cls] of runs) {
        if (left <= 0) break;
        const part = text.slice(0, left).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        left -= text.length;
        html += cls ? '<span class="' + cls + '">' + part + '</span>' : part;
      }
      code.innerHTML = html + '<span class="terminal-caret"></span>';
    }

    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      let n = 0;
      const t0 = performance.now();
      const CPS = 110; // characters per second
      (function type(now) {
        n = Math.min(total, Math.floor(((now - t0) / 1000) * CPS));
        render(n);
        if (n < total) requestAnimationFrame(type);
        else setTimeout(() => code.closest('.terminal-card')?.classList.add('is-stamped'), 250);
      })(t0);
    }, { threshold: 0.35 });
    io.observe(code);
  })();

  // -------------------------------------------------------------
  // D4. FOOTER WORDMARK — rises into place as the page bottoms out
  // -------------------------------------------------------------
  (function wordmarkRise() {
    const mark = document.querySelector('.footer-wordmark span');
    if (!mark) return;
    let raf = 0;
    function update() {
      raf = 0;
      const r = mark.parentElement.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.top > vh || r.bottom < 0) return;
      const p = Math.min(Math.max((vh - r.top) / r.height, 0), 1); // 0 → 1 as it enters, fully risen at page end
      mark.style.setProperty('--rise', ((1 - p) * 70).toFixed(1) + '%');
    }
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
  })();

  // -------------------------------------------------------------
  // D5. PAUSE OFF-SCREEN LOOPS — marquees, glows and the CTA border only
  //     animate while visible, so scrolling never pays for hidden work.
  // -------------------------------------------------------------
  (function pauseOffscreen() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.classList.toggle('is-offscreen', !e.isIntersecting));
    }, { rootMargin: '100px 0px' });
    $$('section, .site-footer, .marquee-strip').forEach(el => io.observe(el));
  })();

  if (!finePointer) return; // pointer-driven effects below are desktop-only

  // -------------------------------------------------------------
  // E. MAGNETIC BUTTONS
  // -------------------------------------------------------------
  $$('.btn').forEach(btn => {
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      btn.style.transform = 'translate3d(' + (dx * 0.18).toFixed(1) + 'px,' + (dy * 0.3 - 2).toFixed(1) + 'px,0)';
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });

  // -------------------------------------------------------------
  // F. CARD SPOTLIGHT + 3D TILT
  // -------------------------------------------------------------
  const tiltSel = '.tr-stat, .terminal-card';
  const glowSel = '.contact-channel-card, .xp, .about-card, .ac-edu';

  function bindCard(card, tilt) {
    card.classList.add('fx-card');
    if (tilt) card.classList.add('tilt-card');
    const maxDeg = card.offsetWidth > 600 ? 2.5 : 5;
    let raf = 0;
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        if (tilt) {
          card.style.setProperty('--ry', ((x - 0.5) * 2 * maxDeg).toFixed(2) + 'deg');
          card.style.setProperty('--rx', ((0.5 - y) * 2 * maxDeg).toFixed(2) + 'deg');
        }
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }

  $$(tiltSel).forEach(c => bindCard(c, true));
  $$(glowSel).forEach(c => bindCard(c, false));

  // -------------------------------------------------------------
  // G. CURSOR FOLLOWER RING
  // -------------------------------------------------------------
  const ring = document.querySelector('.cursor-ring');
  if (ring) {
    let mx = 0, my = 0, rx = 0, ry = 0, running = false, seen = false;

    function follow() {
      rx += (mx - rx) * 0.2;
      ry += (my - ry) * 0.2;
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
      if (Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1) requestAnimationFrame(follow);
      else running = false;
    }

    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      if (!seen) { rx = mx; ry = my; seen = true; }
      ring.classList.add('is-active');
      if (!running) { running = true; requestAnimationFrame(follow); }
    }, { passive: true });

    document.addEventListener('pointerover', e => {
      ring.classList.toggle('is-hover', !!(e.target.closest && e.target.closest('a, button, .pill-tag')));
    });
    document.addEventListener('pointerdown', () => ring.classList.add('is-down'));
    document.addEventListener('pointerup', () => ring.classList.remove('is-down'));
    document.documentElement.addEventListener('mouseleave', () => ring.classList.remove('is-active'));
  }
})();

/* Experience at a Glance carousel: infinite loop, autoplay, swipe, dots */
(() => {
  const root = document.querySelector('.tr-carousel');
  if (!root) return;
  const viewport = root.querySelector('.tr-viewport');
  const track = root.querySelector('.tr-row');
  const originals = Array.from(track.children);
  const N = originals.length;
  if (!N) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DELAY = 2800;
  root.style.setProperty('--tr-delay', DELAY + 'ms');

  const mkClone = (el) => {
    const c = el.cloneNode(true);
    c.setAttribute('aria-hidden', 'true'); c.setAttribute('inert', '');
    c.querySelectorAll('.stat-count').forEach(s => { s.textContent = s.dataset.target; s.classList.remove('stat-count'); s.classList.add('stat-static'); });
    return c;
  };
  originals.forEach(el => track.appendChild(mkClone(el)));
  originals.slice().reverse().forEach(el => track.insertBefore(mkClone(el), track.firstChild));
  const slides = Array.from(track.children);
  slides.forEach((s, i) => s.style.setProperty('--si', Math.min(Math.max(i - N, 0), 7)));

  const dotsWrap = root.querySelector('.tr-dots');
  const dots = originals.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tr-dot';
    b.setAttribute('aria-label', 'Highlight ' + (i + 1));
    b.addEventListener('click', () => { go(N + i); restart(); });
    dotsWrap.appendChild(b);
    return b;
  });

  let index = N, step = 0, timer = null, visible = false, hovered = false, dragX = null, dragDx = 0;
  const measure = () => {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    step = slides[N].offsetWidth + gap; // offsetWidth ignores reveal scale
  };
  const place = (extra = 0) => { track.style.transform = `translate3d(${-index * step + extra}px,0,0)`; };
  const mark = () => {
    const real = ((index - N) % N + N) % N;
    slides.forEach((s, i) => s.classList.toggle('is-lead', i === index));
    dots.forEach((d, i) => { d.classList.toggle('is-active', i === real); d.setAttribute('aria-current', i === real ? 'true' : 'false'); });
  };
  const go = (i, animate = true) => { track.classList.toggle('no-anim', !animate); index = i; place(); mark(); };
  track.addEventListener('transitionend', (e) => {
    if (e.target !== track || e.propertyName !== 'transform') return;
    if (index >= 2 * N) go(index - N, false);
    else if (index < N) go(index + N, false);
  });

  const playing = () => !reduce && visible && !hovered && !document.hidden && dragX === null;
  const restart = () => {
    clearInterval(timer); timer = null;
    const on = playing();
    root.classList.toggle('is-playing', on);
    root.classList.toggle('is-paused', !on && !reduce);
    if (on) {
      const real = ((index - N) % N + N) % N, d = dots[real];
      d.classList.remove('is-active'); void d.offsetWidth; d.classList.add('is-active');
      timer = setInterval(() => { go(index + 1); }, DELAY);
    }
  };
  const syncPlay = () => {
    const on = playing();
    if (on && !timer) restart();
    else if (!on && timer) { clearInterval(timer); timer = null; root.classList.add('is-paused'); }
  };

  root.querySelector('.tr-prev').addEventListener('click', () => { go(index - 1); restart(); });
  root.querySelector('.tr-next').addEventListener('click', () => { go(index + 1); restart(); });
  root.addEventListener('mouseenter', () => { hovered = true; syncPlay(); });
  root.addEventListener('mouseleave', () => { hovered = false; syncPlay(); });
  root.addEventListener('focusin', () => { hovered = true; syncPlay(); });
  root.addEventListener('focusout', () => { hovered = false; syncPlay(); });
  document.addEventListener('visibilitychange', syncPlay);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { go(index + 1); restart(); }
    if (e.key === 'ArrowLeft') { go(index - 1); restart(); }
  });

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragX = e.clientX; dragDx = 0;
    track.classList.add('no-anim'); viewport.classList.add('is-dragging');
    viewport.setPointerCapture(e.pointerId); syncPlay();
  });
  viewport.addEventListener('pointermove', (e) => { if (dragX === null) return; dragDx = e.clientX - dragX; place(dragDx); });
  const endDrag = () => {
    if (dragX === null) return;
    const dx = dragDx; dragX = null; viewport.classList.remove('is-dragging');
    const th = Math.min(60, step * 0.2);
    const n = Math.max(1, Math.round(Math.abs(dx) / step));
    go(dx < -th ? index + n : dx > th ? index - n : index);
    restart();
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => {
      visible = en[0].isIntersecting;
      // the wide track never reaches the shared reveal threshold, so reveal it here
      if (visible) track.classList.add('is-visible');
      syncPlay();
    }, { threshold: 0.35 }).observe(root);
  } else { visible = true; track.classList.add('is-visible'); }

  let rz;
  window.addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { measure(); go(index, false); }); });
  measure(); go(index, false); syncPlay();
})();

/* Contribution lifecycle: open on heading hover (tap/keyboard toggles), close on leave */
(() => {
  const flow = document.querySelector('.xp-flow');
  if (!flow) return;
  const btn = flow.querySelector('.xp-flow-toggle');
  const steps = flow.querySelector('.xp-pipe');
  Array.from(steps.children).forEach((li, i) => li.style.setProperty('--si', i));
  const canHover = window.matchMedia('(hover: hover)').matches;
  const set = (open) => {
    flow.classList.toggle('is-open', open);
    steps.classList.toggle('is-visible', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  if (canHover) {
    btn.addEventListener('mouseenter', () => set(true));
    flow.addEventListener('mouseleave', () => set(false));
  }
  btn.addEventListener('click', () => set(canHover ? true : !flow.classList.contains('is-open')));
  flow.addEventListener('focusout', (e) => { if (!flow.contains(e.relatedTarget)) set(false); });
  set(false);
})();
