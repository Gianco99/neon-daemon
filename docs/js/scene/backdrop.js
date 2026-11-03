import { rng } from "../lib/util.js";

export function mountBackdrop(parent, { dim = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "backdrop";
  parent.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const r = rng(77);
  const stars = Array.from({ length: 140 }, () => ({ x: r(), y: r() * 0.55, s: r() * 1.6 + 0.4, p: r() * 6 }));
  const palms = [
    { x: 0.06, h: 0.42, lean: 0.05, flip: 1 },
    { x: 0.13, h: 0.3, lean: 0.03, flip: 1 },
    { x: 0.92, h: 0.46, lean: -0.05, flip: -1 },
    { x: 0.85, h: 0.28, lean: -0.03, flip: -1 },
  ];
  let w = 0;
  let hh = 0;
  let dpr = 1;
  let raf = 0;
  let t0 = performance.now();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth;
    hh = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function palm(p, horizon) {
    const baseX = p.x * w;
    const baseY = hh;
    const topX = baseX + p.lean * w;
    const topY = horizon - p.h * hh * 0.5;
    ctx.strokeStyle = "#07010f";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(6, w * 0.009);
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(baseX + p.lean * w * 1.4, (baseY + topY) / 2, topX, topY);
    ctx.stroke();
    ctx.lineWidth = Math.max(3, w * 0.004);
    const len = Math.max(60, w * 0.08);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI + (i / 8) * Math.PI + (p.flip > 0 ? 0.1 : -0.1);
      const ex = topX + Math.cos(a) * len;
      const ey = topY + Math.sin(a) * len * 0.45 + len * 0.35;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.6 - len * 0.1, ex, ey);
      ctx.stroke();
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = reduce ? 0 : (now - t0) / 1000;
    const horizon = hh * 0.6;
    let g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, "#090118");
    g.addColorStop(0.45, "#2a0752");
    g.addColorStop(0.78, "#9b1a7a");
    g.addColorStop(1, "#ff6a4d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizon);

    for (const s of stars) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + s.p));
      ctx.fillStyle = `rgba(255,255,255,${(a * (1 - s.y)).toFixed(3)})`;
      ctx.fillRect(s.x * w, s.y * hh, s.s, s.s);
    }

    const sunR = Math.min(w, hh) * 0.2;
    const sunX = w / 2;
    const sunY = horizon - sunR * 0.15;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, horizon);
    ctx.clip();
    const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sg.addColorStop(0, "#ffe45e");
    sg.addColorStop(0.55, "#ff7a59");
    sg.addColorStop(1, "#ff2e97");
    ctx.shadowColor = "rgba(255,90,120,0.8)";
    ctx.shadowBlur = 60;
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 9; i++) {
      const k = i / 9;
      const y = sunY - sunR * 0.05 + k * sunR * 1.05 + ((t * 8) % (sunR * 0.12));
      ctx.fillRect(sunX - sunR, y, sunR * 2, 2 + k * sunR * 0.07);
    }
    ctx.restore();

    ctx.fillStyle = "#14012b";
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    const peaks = 14;
    for (let i = 0; i <= peaks; i++) {
      const x = (i / peaks) * w;
      const ph = (Math.sin(i * 2.1) * 0.5 + 0.6) * hh * 0.07 * (Math.abs(i - peaks / 2) / (peaks / 2) + 0.25);
      ctx.lineTo(x, horizon - ph);
    }
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,46,151,0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();

    g = ctx.createLinearGradient(0, horizon, 0, hh);
    g.addColorStop(0, "#1b0336");
    g.addColorStop(1, "#05000c");
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon, w, hh - horizon);

    ctx.strokeStyle = "rgba(255,46,151,0.65)";
    ctx.lineWidth = 1.2;
    ctx.shadowColor = "#ff2e97";
    ctx.shadowBlur = 8;
    const vx = w / 2;
    for (let i = -24; i <= 24; i++) {
      ctx.beginPath();
      ctx.moveTo(vx + i * 8, horizon);
      ctx.lineTo(vx + i * w * 0.12, hh);
      ctx.stroke();
    }
    const speed = (t * 0.35) % 1;
    for (let i = 0; i < 18; i++) {
      const k = (i + speed) / 18;
      const y = horizon + Math.pow(k, 2.2) * (hh - horizon);
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    for (const p of palms) palm(p, horizon);

    const glow = ctx.createLinearGradient(0, horizon - 4, 0, horizon + 30);
    glow.addColorStop(0, "rgba(255,120,160,0.35)");
    glow.addColorStop(1, "rgba(255,120,160,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizon - 4, w, 34);

    if (dim) {
      ctx.fillStyle = "rgba(9,1,24,0.55)";
      ctx.fillRect(0, 0, w, hh);
    }
    if (reduce) cancelAnimationFrame(raf);
  }

  resize();
  window.addEventListener("resize", resize);
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.remove();
    },
  };
}
