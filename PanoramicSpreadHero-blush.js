/*
 * PanoramicSpreadHero — port of daiv09's Panoramic Spread Hero (21st.dev).
 * The original uses motion/react; this environment has no npm, so the hooks are
 * replaced 1:1 by a small spring integrator writing transforms straight to the DOM
 * (no per-frame React state). Card geometry (generatePanoramicCards), the S-curve
 * ease, PROGRESS_SPRING / PARALLAX_SPRING constants, the [0.15,0.85] progress
 * window, the pointer tilt (±5deg, only once spread) and the text motion
 * (y 10vh→-22vh, scale .85→1, opacity over [0.4,0.9]) are unchanged.
 *
 * Added for Studio M: `mode` ("load" = spread plays on page load; "scroll" =
 * original scroll-driven unspool over `scrollDistance` px), `stageOffset` (vh),
 * `textEnd` (vh), mobile tilt damping, children as the text layer.
 */
const PSReact = window.React;

function generatePanoramicCards(images) {
  const total = images.length, centerIndex = (total - 1) / 2;
  return images.map((item, i) => {
    const offset = i - centerIndex, absOffset = Math.abs(offset);
    return {
      item, z: Math.round(10 - absOffset),
      desktop: {
        stacked: { x: offset * 2, y: offset * -2, rotateZ: offset * 2.5, rotateY: 0, scale: 1 },
        panoramic: { x: offset * 18, y: absOffset * 3, rotateZ: offset * 1.5, rotateY: offset * -12, scale: 1 - absOffset * 0.05 },
        size: { w: "22vw", h: "32vh", ml: "-11vw", mt: "-16vh" },
      },
      mobile: {
        stacked: { x: offset * 1.5, y: offset * -1.5, rotateZ: offset * 3, rotateY: 0, scale: 1 },
        panoramic: { x: offset * 16, y: absOffset * 3, rotateZ: offset * 2, rotateY: offset * -15, scale: 1 - absOffset * 0.04 },
        size: { w: "46vw", h: "30vh", ml: "-23vw", mt: "-15vh" },
      },
    };
  });
}

const PROGRESS_SPRING = { stiffness: 80, damping: 25, mass: 0.5, restDelta: 0.001 };
const PARALLAX_SPRING = { stiffness: 50, damping: 25, mass: 0.5 };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mapRange = (v, a, b, c, d) => lerp(c, d, clamp01((v - a) / (b - a)));
const sCurve = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
function springStep(s, target, cfg, dt) {
  const a = (-cfg.stiffness * (s.x - target) - cfg.damping * s.v) / cfg.mass;
  s.v += a * dt; s.x += s.v * dt;
}

const PS_CSS = [
  ".ps-card{position:relative;width:100%;height:100%;overflow:hidden;border-radius:4px;background:#F8F3EC;padding:8px 8px 22px;box-shadow:0 30px 60px -20px rgba(110,80,84,.22),0 0 0 1px rgba(241,235,230,.08);transition:box-shadow .5s}",
  ".ps-card:hover{box-shadow:0 36px 70px -18px rgba(110,80,84,.3),0 0 0 1px rgba(185,130,135,.45)}",
  ".ps-shot{position:relative;width:100%;height:100%;overflow:hidden;border-radius:2px;background:#D8C9C1}",
  ".ps-dim{position:absolute;inset:0;background:rgba(69,65,67,.05);z-index:1;pointer-events:none;transition:background .5s}",
  ".ps-card:hover .ps-dim{background:transparent}",
  ".ps-shot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.86) sepia(.1) contrast(1.04);transition:transform .7s cubic-bezier(.22,.61,.36,1)}",
  ".ps-card:hover img{transform:scale(1.05)}",
  "@media (max-width:767px){.ps-card{padding:4px 4px 12px}}",
].join("\n");

function PanoramicSpreadHero({ images = [], mode = "load", scrollDistance = 0, stageOffset = 6, textEnd = -22, cardSize = null, children, style }) {
  const cards = PSReact.useMemo(() => generatePanoramicCards(images), [images]);
  const [isMobile, setIsMobile] = PSReact.useState(typeof window !== "undefined" && window.innerWidth < 768);
  const rootRef = PSReact.useRef(null), sceneRef = PSReact.useRef(null), textRef = PSReact.useRef(null);
  const cardRefs = PSReact.useRef([]);
  const live = PSReact.useRef({ mode, scrollDistance, textEnd, isMobile });
  live.current = { mode, scrollDistance, textEnd, isMobile };

  PSReact.useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  PSReact.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const prog = { x: 0, v: 0 }, tx = { x: 0, v: 0 }, ty = { x: 0, v: 0 };
    let rawX = 0, rawY = 0, loadTarget = 0, raf = 0, prev = performance.now(), visible = true;
    const t0 = setTimeout(() => { loadTarget = 1; }, 350);
    const onMove = (e) => {
      rawX = (e.clientY / window.innerHeight - 0.5) * -10;
      rawY = (e.clientX / window.innerWidth - 0.5) * 10;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const frame = (now) => {
      raf = 0; if (!visible) return;
      const dt = Math.min(0.033, (now - prev) / 1000); prev = now;
      const L = live.current;
      const raw = L.mode === "scroll" && L.scrollDistance > 0 ? clamp01(window.scrollY / L.scrollDistance) : loadTarget;
      if (reduce) { prog.x = raw; prog.v = 0; } else springStep(prog, raw, PROGRESS_SPRING, dt);
      const p = mapRange(prog.x, 0.15, 0.85, 0, 1), e = sCurve(p);
      const spread = p > 0.95, amp = L.isMobile ? 0.6 : 1;
      springStep(tx, spread && !reduce ? rawX * amp : 0, PARALLAX_SPRING, dt);
      springStep(ty, spread && !reduce ? rawY * amp : 0, PARALLAX_SPRING, dt);
      if (sceneRef.current) sceneRef.current.style.transform = "rotateX(" + tx.x.toFixed(3) + "deg) rotateY(" + ty.x.toFixed(3) + "deg)";
      cards.forEach((c, i) => {
        const el = cardRefs.current[i]; if (!el) return;
        const lay = L.isMobile ? c.mobile : c.desktop, s = lay.stacked, q = lay.panoramic;
        el.style.transform = "translateX(" + lerp(s.x, q.x, e).toFixed(3) + "vw) translateY(" + lerp(s.y, q.y, e).toFixed(3) + "vh) scale(" +
          lerp(0.75, q.scale, e).toFixed(4) + ") rotateY(" + lerp(s.rotateY, q.rotateY, e).toFixed(3) + "deg) rotateZ(" + lerp(s.rotateZ, q.rotateZ, e).toFixed(3) + "deg)";
      });
      if (textRef.current) {
        textRef.current.style.transform = "translateY(" + mapRange(p, 0.2, 1, 10, L.textEnd).toFixed(3) + "vh) scale(" + mapRange(p, 0.2, 1, 0.85, 1).toFixed(4) + ")";
        textRef.current.style.opacity = mapRange(p, 0.4, 0.9, 0, 1).toFixed(3);
      }
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !raf) { prev = performance.now(); raf = requestAnimationFrame(frame); }
    });
    if (rootRef.current) io.observe(rootRef.current);
    raf = requestAnimationFrame(frame);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("pointermove", onMove); };
  }, [cards]);

  const h = PSReact.createElement;
  return h("div", { ref: rootRef, style: Object.assign({ position: "absolute", inset: 0, overflow: "hidden", perspective: "1200px" }, style) },
    h("style", null, PS_CSS),
    h("div", { style: { position: "absolute", inset: 0, transform: "translateY(" + stageOffset + "vh)", transformStyle: "preserve-3d" } },
      h("div", { ref: sceneRef, style: { position: "absolute", inset: 0, zIndex: 10, transformStyle: "preserve-3d" } },
        cards.map((c, i) => {
          const size = cardSize ? { w: cardSize.w + "px", h: cardSize.h + "px", ml: -cardSize.w / 2 + "px", mt: -cardSize.h / 2 + "px" } : (isMobile ? c.mobile : c.desktop).size;
          return h("div", { key: i, style: { position: "absolute", left: "50%", top: "50%", zIndex: c.z, pointerEvents: "none", transformStyle: "preserve-3d" } },
            h("div", { ref: (el) => void (cardRefs.current[i] = el), style: { width: size.w, height: size.h, marginLeft: size.ml, marginTop: size.mt, willChange: "transform", pointerEvents: "auto", transformOrigin: "center center -50px" } },
              h("div", { className: "ps-card" },
                h("div", { className: "ps-shot" },
                  h("div", { className: "ps-dim" }),
                  h("img", { src: c.item.src, alt: c.item.alt || "", draggable: false, loading: Math.abs(i - (cards.length - 1) / 2) < 2 ? "eager" : "lazy", decoding: "async" })))));
        })),
      h("div", { style: { position: "absolute", inset: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" } },
        h("div", { ref: textRef, style: { opacity: 0, willChange: "transform,opacity", padding: "0 24px" } }, children))));
}

module.exports = { PanoramicSpreadHero };
