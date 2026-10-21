// Browser build of components/ui/masonry-grid.tsx (same props). framer-motion is
// loaded once from CDN (UMD → window.Motion); falls back to a static grid if it fails.
const FM_SRC = 'https://unpkg.com/framer-motion@10.18.0/dist/framer-motion.js';
const cn = (...a) => a.filter(Boolean).join(' ');

const CSS = `
.mg-w-full{width:100%}.mg-relative{position:relative}.mg-h-full{height:100%}
.mg-item{break-inside:avoid;-webkit-column-break-inside:avoid;page-break-inside:avoid;display:block}
.columns-2{columns:2}
@media (min-width:768px){.md\\:columns-2{columns:2}.md\\:columns-3{columns:3}}
@media (min-width:1024px){.lg\\:columns-3{columns:3}.lg\\:columns-4{columns:4}}
@media (min-width:1440px){.xl\\:columns-3{columns:3}.xl\\:columns-4{columns:4}}
`;
function ensureCss() {
  if (document.getElementById('mg-css')) return;
  const s = document.createElement('style'); s.id = 'mg-css'; s.textContent = CSS; document.head.appendChild(s);
}
let fmPromise;
function loadMotion() {
  if (window.Motion && window.Motion.motion) return Promise.resolve(window.Motion);
  if (!fmPromise) fmPromise = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = FM_SRC; s.async = true;
    s.onload = () => (window.Motion && window.Motion.motion ? res(window.Motion) : rej(new Error('Motion global missing')));
    s.onerror = rej; document.head.appendChild(s);
  });
  return fmPromise;
}
const mq = q => typeof matchMedia === 'function' && matchMedia(q).matches;

function makeAnimated(M) {
  const { motion, useMotionValue, useTransform, useSpring } = M;
  const GridItem = ({ children, tilt }) => {
    const ref = React.useRef(null);
    const x = useMotionValue(0), y = useMotionValue(0);
    const mouseXSpring = useSpring(x, { stiffness: 300, damping: 20 });
    const mouseYSpring = useSpring(y, { stiffness: 300, damping: 20 });
    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['10deg', '-10deg']);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-10deg', '10deg']);
    const move = e => {
      if (!ref.current || !tilt) return;
      const { left, top, width, height } = ref.current.getBoundingClientRect();
      x.set((e.clientX - left) / width - 0.5); y.set((e.clientY - top) / height - 0.5);
    };
    const leave = () => { x.set(0); y.set(0); };
    return React.createElement(motion.div, { ref, onMouseMove: move, onMouseLeave: leave, className: 'mg-relative', style: { transformStyle: 'preserve-3d', perspective: '1000px' } },
      React.createElement(motion.div, { className: 'mg-w-full mg-h-full', style: { rotateX, rotateY, transformStyle: 'preserve-3d' }, whileTap: { scale: tilt ? 0.95 : 0.98 } }, children));
  };
  return function AnimatedGrid({ items, renderItem, className, gap, staggerDelay }) {
    const reduced = mq('(prefers-reduced-motion: reduce)');
    const tilt = !reduced && mq('(hover: hover) and (pointer: fine)');
    const itemVariants = {
      hidden: { opacity: 0, y: reduced ? 0 : 30, scale: reduced ? 1 : 0.95 },
      visible: i => ({ opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: 'easeOut', delay: (i % 4) * staggerDelay } })
    };
    return React.createElement('div', { className: cn('mg-w-full', className), style: { columnGap: gap }, role: 'list' },
      items.map((item, index) => React.createElement(motion.div, { key: index, className: 'mg-item', style: { marginBottom: gap }, variants: itemVariants, custom: index, initial: 'hidden', whileInView: 'visible', viewport: { once: true, amount: 0, margin: '0px 0px -10% 0px' }, role: 'listitem' },
        React.createElement(GridItem, { tilt }, renderItem(item, index)))));
  };
}

function StaticGrid({ items, renderItem, className, gap }) {
  return React.createElement('div', { className: cn('mg-w-full', className), style: { columnGap: gap }, role: 'list' },
    items.map((item, index) => React.createElement('div', { key: index, className: 'mg-item', style: { marginBottom: gap }, role: 'listitem' }, renderItem(item, index))));
}

let Animated = null;
function MasonryGrid({ items = [], renderItem, className, gap = '1rem', staggerDelay = 0.05 }) {
  ensureCss();
  const [state, setState] = React.useState(Animated ? 'ready' : 'loading');
  React.useEffect(() => {
    if (Animated) return;
    loadMotion().then(M => { Animated = Animated || makeAnimated(M); setState('ready'); }).catch(() => setState('failed'));
  }, []);
  const props = { items, renderItem: renderItem || (() => null), className, gap, staggerDelay };
  if (state === 'ready') return React.createElement(Animated, props);
  if (state === 'failed') return React.createElement(StaticGrid, props);
  return React.createElement('div', { style: { visibility: 'hidden' } }, React.createElement(StaticGrid, props));
}

module.exports = { MasonryGrid };
