/** Canvas petal field shared by the website hero and the link-in-bio page. */
export type PetalField = {
  resize: () => void;
  setCount: (n: number) => void;
  burst: (x: number, y: number, n: number) => void;
  step: (t: number) => void;
  pointer: (x: number, y: number, on: boolean) => void;
  radius: number;
};

type P = { x: number; y: number; vx: number; vy: number; life: number; g: boolean; r: number; a: number; va: number; f: number; vf: number; ph: number; fs: number; c: string; o: number };

export function makeField(cv: HTMLCanvasElement, size: () => { w: number; h: number }, radius = 140): PetalField {
  const ctx = cv.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const C = ['#F4C9C0', '#EFB4A9', '#F8DCD5', '#E8A398', '#FBE7E1', '#F1BFB3'];
  const G = ['#E2B57F', '#C8955E', '#F0CFA0'];
  let P: P[] = [];
  let W = 1, H = 1, px = 0, py = 0, on = false;
  const mk = (x: number, y: number, vx: number, vy: number, life: number): P => {
    const g = Math.random() < 0.2;
    return { x, y, vx, vy, life, g, r: g ? 2 + Math.random() * 2.4 : 5 + Math.random() * 7.5, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.04, f: Math.random() * 6.28, vf: 0.015 + Math.random() * 0.035, ph: Math.random() * 6.28, fs: 0.35 + Math.random() * 0.6, c: g ? G[(Math.random() * 3) | 0] : C[(Math.random() * 6) | 0], o: 0.55 + Math.random() * 0.4 };
  };
  const F: PetalField = {
    radius,
    resize() {
      const z = size();
      W = Math.max(1, z.w);
      H = Math.max(1, z.h);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    setCount(n) {
      const amb = P.filter((p) => p.life < 0);
      while (amb.length < n) {
        const p = mk(Math.random() * W, Math.random() * H, 0, 0, -1);
        amb.push(p);
        P.push(p);
      }
      if (amb.length > n) {
        const kill = new Set(amb.slice(n));
        P = P.filter((p) => !kill.has(p));
      }
    },
    burst(x, y, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, sp = 1.5 + Math.random() * 4.5;
        P.push(mk(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 1.8, 1));
      }
    },
    pointer(x, y, o) {
      px = x;
      py = y;
      on = o;
    },
    step(t) {
      ctx.clearRect(0, 0, W, H);
      const R = F.radius;
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        const wind = Math.sin(t / 2400 + p.ph) * 0.55 + Math.sin(t / 900 + p.ph * 2) * 0.15;
        p.vx += (wind - p.vx) * 0.018;
        p.vy += (p.fs - p.vy) * 0.018;
        if (on) {
          const dx = p.x - px, dy = p.y - py, d = Math.hypot(dx, dy);
          if (d < R && d > 0.5) {
            const q = (1 - d / R) * 0.9;
            p.vx += (dx / d) * q;
            p.vy += (dy / d) * q;
            p.va += (Math.random() - 0.5) * 0.02;
          }
        }
        p.x += p.vx; p.y += p.vy; p.a += p.va; p.f += p.vf; p.va *= 0.996;
        if (p.life > 0) {
          p.life -= 0.005;
          if (p.life <= 0) { P.splice(i, 1); continue; }
        }
        if (p.y > H + 24) {
          if (p.life > 0) { P.splice(i, 1); continue; }
          p.y = -20; p.x = Math.random() * W; p.vx = 0; p.vy = p.fs;
        }
        if (p.x < -30) p.x = W + 30;
        else if (p.x > W + 30) p.x = -30;
        const al = p.o * (p.life > 0 ? Math.min(1, p.life * 2.5) : 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(p.f))));
        ctx.fillStyle = p.c;
        if (p.g) {
          ctx.globalAlpha = al * (0.5 + 0.5 * Math.abs(Math.sin(p.f * 2)));
          ctx.fillRect(-p.r, -p.r * 0.7, p.r * 2, p.r * 1.4);
        } else {
          const r = p.r;
          ctx.globalAlpha = al;
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.bezierCurveTo(r * 0.95, -r * 0.55, r * 0.7, r * 0.75, 0, r);
          ctx.bezierCurveTo(-r * 0.7, r * 0.75, -r * 0.95, -r * 0.55, 0, -r);
          ctx.fill();
          ctx.globalAlpha = al * 0.4;
          ctx.fillStyle = '#FFF6F2';
          ctx.beginPath();
          ctx.ellipse(-r * 0.18, -r * 0.18, r * 0.16, r * 0.48, 0.25, 0, 6.283);
          ctx.fill();
        }
        ctx.restore();
      }
    },
  };
  return F;
}

/** Runs `frame` on rAF only while `el` is on screen. */
export function loopWhileVisible(el: Element, frame: (t: number) => void) {
  let raf = 0, vis = false, dead = false;
  const tick = (t: number) => {
    raf = 0;
    if (!vis || dead) return;
    frame(t);
    raf = requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((ents) => {
    vis = ents.some((e) => e.isIntersecting);
    if (vis && !raf) raf = requestAnimationFrame(tick);
  });
  io.observe(el);
  return () => {
    dead = true;
    io.disconnect();
    cancelAnimationFrame(raf);
  };
}

export function prefersReduced() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** One-shot scroll reveal for every [data-reveal] below the fold inside root. */
export function setupReveal(root: Element) {
  if (prefersReduced()) return () => {};
  const io = new IntersectionObserver(
    (ents) => {
      let k = 0;
      ents.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        (en.target as HTMLElement).animate([{ opacity: 0, translate: '0 36px' }, { opacity: 1, translate: '0 0' }], { duration: 1000, delay: k++ * 90, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'backwards' });
      });
    },
    { rootMargin: '0px 0px 12% 0px' },
  );
  root.querySelectorAll('[data-reveal]').forEach((el) => {
    if (el.getBoundingClientRect().top > innerHeight) io.observe(el);
  });
  return () => io.disconnect();
}

/** Shine / sheen loops via WAAPI. */
export function startLoops(root: Element) {
  if (prefersReduced()) return;
  root.querySelectorAll<HTMLElement & { _a?: Animation }>('[data-sheen]').forEach((el) => {
    if (el._a) return;
    el._a = el.animate([{ translate: '-120% 0' }, { translate: '320% 0', offset: 0.45 }, { translate: '320% 0' }], { duration: Number(el.dataset.sheen) || 4200, iterations: Infinity, easing: 'ease-in-out' });
  });
  root.querySelectorAll<HTMLElement & { _a?: Animation }>('[data-shine]').forEach((el) => {
    if (el._a) return;
    el._a = el.animate([{ backgroundPosition: '130% 0' }, { backgroundPosition: '-30% 0', offset: 0.45 }, { backgroundPosition: '-30% 0' }], { duration: 6000, iterations: Infinity, easing: 'ease-in-out' });
  });
}
