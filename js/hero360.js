/* =============================================================================
 *  360° Hero viewer  (js/hero360.js)  →  window.JVHero
 *  ===========================================================================
 *  TWO MODES (set HERO_MODE in js/config.js):
 *
 *  1) 'svg'  (default) — an on-brand vector ring that the visitor can grab and
 *     spin a full 360°. Zero image files needed. Works instantly.
 *
 *  2) 'photo' — a REAL product spin from a sequence of photos. This is how you
 *     show an actual new ring:
 *        a. Photograph the ring on a turntable, ~36 shots, one every 10°.
 *        b. Name them frame-01.jpg … frame-36.jpg
 *        c. Put them in   assets/hero-360/
 *        d. In js/config.js set  HERO_MODE:'photo'  (and HERO_PHOTO_FRAME_COUNT
 *           if not 36). Done — dragging now scrubs your photos.
 *     To launch a NEW ring later, just replace those images (same names) — no
 *     code changes. The drag/scrub behaviour stays identical.
 *
 *  Interaction: click-drag (mouse), swipe (touch), or ←/→ arrow keys.
 * ===========================================================================*/
(function () {
  const cfg = window.JIVANI_CONFIG || {};

  // A detailed faceted ring, used in 'svg' mode.
  const RING_SVG = `
  <svg viewBox="-100 -100 200 200" width="100%" height="100%" aria-hidden="true">
    <ellipse cx="0" cy="52" rx="46" ry="4" fill="#0F1B3D" opacity="0.12"/>
    <path d="M -54 26 a 54 16 0 0 0 108 0" fill="none" stroke="#9da7bd" stroke-width="3"/>
    <path d="M -54 26 a 54 16 0 0 1 108 0" fill="none" stroke="#c4ccda" stroke-width="3.5"/>
    <path d="M -42 28 a 42 12 0 0 1 84 0" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.7"/>
    <line x1="-16" y1="14" x2="-13" y2="3" stroke="#8a94aa" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="16" y1="14" x2="13" y2="3" stroke="#8a94aa" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="-2" y1="10" x2="-2" y2="0" stroke="#8a94aa" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="2" y1="10" x2="2" y2="0" stroke="#8a94aa" stroke-width="1.5" stroke-linecap="round"/>
    <polygon points="-26,-12 0,-50 26,-12 0,10" fill="#e8edf5" stroke="#0F1B3D" stroke-width="0.7"/>
    <polygon points="-26,-12 -12,-22 0,-50" fill="#cdd5e3"/>
    <polygon points="26,-12 12,-22 0,-50" fill="#aab4c8"/>
    <polygon points="-26,-12 -12,-22 -3,-12 -12,-2" fill="#dde3ed"/>
    <polygon points="26,-12 12,-22 3,-12 12,-2" fill="#9da7bd"/>
    <polygon points="-26,-12 -12,-2 0,10" fill="#7d889f"/>
    <polygon points="26,-12 12,-2 0,10" fill="#6a7691"/>
    <polygon points="-12,-22 0,-50 12,-22 0,-30" fill="#f5f7fb" opacity="0.85"/>
    <polygon points="-6,-32 6,-32 0,-50" fill="#ffffff" opacity="0.6"/>
  </svg>`;

  function init(root) {
    root = root || document.querySelector('.jv-hero-viewer');
    if (!root) return;
    const spin = root.querySelector('.jv-hero-spin');
    if (!spin) return;

    const frameLabel = root.querySelector('[data-hero-frame]');
    const fill = root.querySelector('.jv-hero-fill');
    const knob = root.querySelector('.jv-hero-knob');
    const mode = cfg.HERO_MODE === 'photo' ? 'photo' : 'svg';
    const FRAMES = mode === 'photo' ? (cfg.HERO_PHOTO_FRAME_COUNT || 36) : 36;

    let angle = 0;           // 0..360
    let frames = [];         // preloaded <img>.src strings (photo mode)
    let imgEl = null;

    /* ---- build the stage per mode ---- */
    if (mode === 'photo') {
      imgEl = document.createElement('img');
      imgEl.alt = 'Featured ring — drag to rotate';
      spin.appendChild(imgEl);
      preload();
    } else {
      spin.innerHTML = RING_SVG;
    }

    function preload() {
      root.classList.add('is-loading');
      let loaded = 0;
      for (let i = 1; i <= FRAMES; i++) {
        const n = String(i).padStart(2, '0');
        const src = `${cfg.HERO_PHOTO_PATH || 'assets/hero-360/frame-'}${n}${cfg.HERO_PHOTO_EXT || '.jpg'}`;
        const im = new Image();
        im.onload = () => { if (++loaded === FRAMES) { root.classList.remove('is-loading'); render(); } };
        im.onerror = () => { if (++loaded === FRAMES) { root.classList.remove('is-loading'); render(); } };
        im.src = src; frames.push(src);
      }
    }

    function frameIndex() { return ((Math.round(angle / 360 * FRAMES) % FRAMES) + FRAMES) % FRAMES; }

    function render() {
      const a = ((angle % 360) + 360) % 360;
      if (mode === 'svg') spin.style.transform = `rotate(${a}deg)`;
      else if (frames.length) imgEl.src = frames[frameIndex()];
      if (fill) fill.style.width = (a / 360 * 100) + '%';
      if (knob) knob.style.left = (a / 360 * 100) + '%';
      if (frameLabel) frameLabel.textContent = `Frame ${frameIndex() + 1} / ${FRAMES}`;
    }

    /* ---- drag / swipe / keyboard ---- */
    let dragging = false, lastX = 0;
    const SENS = 360 / Math.max(320, root.clientWidth);   // full width ≈ one turn

    const down = (x) => { dragging = true; lastX = x; root.classList.add('dragging'); stopAuto(); };
    const move = (x) => { if (!dragging) return; angle += (x - lastX) * SENS; lastX = x; render(); };
    const up   = () => { dragging = false; root.classList.remove('dragging'); scheduleAuto(); };

    root.addEventListener('mousedown', (e) => { e.preventDefault(); down(e.clientX); });
    window.addEventListener('mousemove', (e) => move(e.clientX));
    window.addEventListener('mouseup', up);
    root.addEventListener('touchstart', (e) => down(e.touches[0].clientX), { passive: true });
    root.addEventListener('touchmove', (e) => { move(e.touches[0].clientX); }, { passive: true });
    root.addEventListener('touchend', up);

    root.tabIndex = 0;
    root.setAttribute('role', 'slider');
    root.setAttribute('aria-label', 'Drag to rotate the ring 360 degrees');
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  { angle -= 10; render(); stopAuto(); scheduleAuto(); }
      if (e.key === 'ArrowRight') { angle += 10; render(); stopAuto(); scheduleAuto(); }
    });

    /* ---- gentle auto-rotate until the user interacts ---- */
    let raf = null, autoTimer = null, auto = true;
    function loop() { if (!auto) return; angle += 0.18; render(); raf = requestAnimationFrame(loop); }
    function stopAuto() { auto = false; cancelAnimationFrame(raf); clearTimeout(autoTimer); }
    function scheduleAuto() { clearTimeout(autoTimer); autoTimer = setTimeout(() => { auto = true; loop(); }, 4000); }

    render();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) loop();
    else render();
  }

  window.JVHero = { init };
  document.addEventListener('DOMContentLoaded', () => init());
})();
