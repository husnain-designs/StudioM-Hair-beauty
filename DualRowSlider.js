/*
 * DualRowSlider — Dual-row infinite horizontal image slider for Studio M.
 * Upper row scrolls continuously Left-to-Right.
 * Lower row scrolls continuously Right-to-Left.
 * Both rows loop seamlessly and pause independently when hovering over any image in that row.
 */
const DReact = typeof window !== 'undefined' && window.React ? window.React : (typeof React !== 'undefined' ? React : null);

const CSS = `
.sm-drs-wrapper {
  position: relative;
  width: 100%;
  max-width: 100vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2.2vw, 26px);
  padding: 10px 0;
}

.sm-drs-row {
  position: relative;
  width: 100%;
  overflow: hidden;
  user-select: none;
}

.sm-drs-track {
  display: flex;
  width: max-content;
  will-change: transform;
}

/* Row 1: Left-to-Right (translating from -50% to 0%) */
.sm-drs-ltr {
  animation: smScrollLtr var(--sm-speed, 36s) linear infinite;
}

/* Row 2: Right-to-Left (translating from 0% to -50%) */
.sm-drs-rtl {
  animation: smScrollRtl var(--sm-speed, 38s) linear infinite;
}

@keyframes smScrollLtr {
  0% { transform: translate3d(-50%, 0, 0); }
  100% { transform: translate3d(0%, 0, 0); }
}

@keyframes smScrollRtl {
  0% { transform: translate3d(0%, 0, 0); }
  100% { transform: translate3d(-50%, 0, 0); }
}

/* Pause only the hovered row (desktop) */
@media (hover: hover) and (pointer: fine) {
  .sm-drs-row:hover .sm-drs-track {
    animation-play-state: paused !important;
  }
}

.sm-drs-photo {
  flex: 0 0 auto;
  position: relative;
  width: clamp(240px, 22vw, 340px);
  aspect-ratio: 4 / 5;
  margin-right: clamp(14px, 1.8vw, 24px);
  overflow: hidden;
  border-radius: 6px;
  background: #E8DCD4;
}

.sm-drs-photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
}

@media (hover: hover) and (pointer: fine) {
  .sm-drs-photo:hover img {
    transform: scale(1.05);
  }
}

@media (max-width: 767px) {
  .sm-drs-photo {
    width: clamp(165px, 46vw, 230px);
    margin-right: 12px;
    border-radius: 5px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sm-drs-ltr,
  .sm-drs-rtl {
    animation-play-state: paused !important;
  }
}
`;

function ensureDrsStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sm-drs-styles')) return;
  const styleEl = document.createElement('style');
  styleEl.id = 'sm-drs-styles';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
}

function renderPhoto(item, key, onClick) {
  const h = DReact.createElement;
  return h('div', {
    key,
    className: 'sm-drs-photo',
    style: onClick ? { cursor: 'pointer' } : undefined,
    onClick: onClick ? () => onClick(item) : undefined
  },
    h('img', {
      src: item.src || item.image,
      alt: item.alt || item.title || 'Studio M',
      loading: 'lazy',
      decoding: 'async',
      draggable: false
    })
  );
}

function DualRowSlider({
  row1 = [],
  row2 = [],
  speed = 38,
  onCardClick,
  className,
  style
}) {
  ensureDrsStyles();
  const h = DReact.createElement;
  const { useState, useRef, useEffect } = DReact;

  // Tap-to-pause state, one flag per row, independent of the other row and
  // of desktop :hover (which stays CSS-only so it keeps working unchanged).
  const [paused1, setPaused1] = useState(false);
  const [paused2, setPaused2] = useState(false);
  // Off-screen rows still run via CSS keyframes (compositor-only, cheap) but
  // there is no reason to keep them going at all while scrolled far away —
  // pause both via a single shared observer instead of per-image listeners.
  const [inView, setInView] = useState(true);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '200px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Seamless looping requires duplicate items to form track 1 and track 2
  // We duplicate each row at least twice so the translation from 0 to -50% (or -50% to 0) is perfectly seamless.
  const r1 = row1 && row1.length ? row1 : [];
  const r2 = row2 && row2.length ? row2 : (r1.length ? [...r1].reverse() : []);

  const fullRow1 = [...r1, ...r1];
  const fullRow2 = [...r2, ...r2];

  const speed1 = `${speed}s`;
  const speed2 = `${(speed * 1.05).toFixed(1)}s`; // subtle speed offset gives a natural, organic parallax feel

  return h('div', {
    ref: wrapperRef,
    className: `sm-drs-wrapper ${className || ''}`.trim(),
    style: style || {},
    'aria-label': 'Studio M Instagram showcase gallery'
  },
    // Row 1: Left to Right
    h('div', {
      className: 'sm-drs-row sm-drs-row-1',
      'aria-label': 'Gallery row scrolling left to right. Tap a photo to pause or resume it.',
      onClick: () => setPaused1(p => !p)
    },
      h('div', {
        className: 'sm-drs-track sm-drs-ltr',
        style: { '--sm-speed': speed1, animationPlayState: (!inView || paused1) ? 'paused' : 'running' }
      },
        fullRow1.map((item, idx) => renderPhoto(item, `r1-${idx}`, onCardClick))
      )
    ),

    // Row 2: Right to Left
    h('div', {
      className: 'sm-drs-row sm-drs-row-2',
      'aria-label': 'Gallery row scrolling right to left. Tap a photo to pause or resume it.',
      onClick: () => setPaused2(p => !p)
    },
      h('div', {
        className: 'sm-drs-track sm-drs-rtl',
        style: { '--sm-speed': speed2, animationPlayState: (!inView || paused2) ? 'paused' : 'running' }
      },
        fullRow2.map((item, idx) => renderPhoto(item, `r2-${idx}`, onCardClick))
      )
    )
  );
}

module.exports = { DualRowSlider };
