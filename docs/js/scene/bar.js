import { rng } from "../lib/util.js";
import { drawDaemon } from "./sprites.js";

export const W = 480;
export const H = 270;
export const FLOOR_TOP = 160;
export const FLOOR_BOTTOM = 266;

const WIN = { x: 170, y: 18, w: 140, h: 86, horizon: 76 };

export const DESKS = [
  { x: 46, y: 204 },
  { x: 108, y: 204 },
  { x: 46, y: 252 },
  { x: 108, y: 252 },
];

export const STOOLS = [352, 380, 408, 436, 464].map((x) => ({ x, y: 196 }));

export const LOUNGE = [
  { x: 196, y: 238 }, { x: 240, y: 246 }, { x: 284, y: 238 }, { x: 210, y: 258 }, { x: 270, y: 258 },
  { x: 176, y: 196 }, { x: 304, y: 200 }, { x: 160, y: 226 }, { x: 320, y: 230 }, { x: 240, y: 190 },
];

export const OVERFLOW_DESK = [
  { x: 20, y: 222 }, { x: 140, y: 226 }, { x: 22, y: 264 }, { x: 140, y: 264 }, { x: 77, y: 228 }, { x: 77, y: 264 },
];

export const HOTSPOTS = [
  { name: "darts", label: "Darts", rect: [44, 64, 46, 48], approach: [66, 172] },
  { name: "jukebox", label: "Jukebox", rect: [128, 112, 32, 50], approach: [146, 178] },
  { name: "bets", label: "Bet booth", rect: [312, 112, 28, 54], approach: [326, 180] },
  { name: "bar", label: "Bar", rect: [334, 118, 146, 62], approach: null },
];

export const SIGNS = [
  { kind: "logo", x: 84, y: 34, size: 1 },
  { kind: "small", text: "COCKTAILS", x: 408, y: 20, color: "pink", size: 1 },
  { kind: "small", text: "OPEN", x: 326, y: 90, color: "cyan", size: 0.8 },
  { kind: "small", text: "DESKS", x: 78, y: 140, color: "cyan", size: 0.7 },
];

const FLAMINGO = [
  "....###.....",
  "...#####....",
  "...##.###...",
  "......##.#..",
  ".....##.....",
  "....##......",
  "....##......",
  ".....##.....",
  "......####..",
  "....#######.",
  "...########.",
  "....######..",
  ".......#....",
  ".......#....",
  ".......#....",
  "......###...",
  ".......#....",
  ".......#....",
];

const LETTERS = {
  B: ["##.", "#.#", "##.", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
};

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawBitmap(ctx, rows, x, y, color) {
  ctx.fillStyle = color;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === "#") ctx.fillRect(x + i, y + j, 1, 1);
  });
}

function drawPalm(ctx, bx, by, tx, ty, bend, color) {
  const steps = Math.abs(by - ty);
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const x = bx + (tx - bx) * s + Math.sin(Math.PI * s) * bend;
    const y = by + (ty - by) * s;
    px(ctx, Math.round(x), Math.round(y), s < 0.5 ? 3 : 2, 1, color);
  }
  const fronds = [-2.9, -2.4, -1.9, -1.2, -0.7, -0.2, 0.3];
  for (const a of fronds) {
    const len = 18 + Math.round(Math.abs(Math.sin(a * 3)) * 6);
    for (let j = 0; j < len; j++) {
      const fx = tx + Math.cos(a) * j;
      const fy = ty + Math.sin(a) * j + j * j * 0.028;
      px(ctx, Math.round(fx), Math.round(fy), 2, 1, color);
      if (j % 2 === 0 && j > 3) px(ctx, Math.round(fx), Math.round(fy) + 1, 1, 2, color);
    }
  }
}

function drawStars(ctx, r) {
  for (let i = 0; i < 46; i++) {
    const x = WIN.x + Math.floor(r() * WIN.w);
    const y = WIN.y + Math.floor(r() * 34);
    px(ctx, x, y, 1, 1, `rgba(255,255,255,${(0.25 + r() * 0.6).toFixed(2)})`);
  }
}

function drawSun(ctx) {
  const cx = WIN.x + WIN.w / 2;
  const cy = WIN.horizon;
  const radius = 24;
  const gaps = new Set([63, 66, 67, 70, 71, 73, 74]);
  for (let y = cy - radius; y < cy; y++) {
    if (gaps.has(y)) continue;
    const half = Math.sqrt(radius * radius - (cy - y) * (cy - y));
    const s = (y - (cy - radius)) / radius;
    const r = 255;
    const g = Math.round(228 - s * 182);
    const b = Math.round(94 + s * 57);
    px(ctx, Math.round(cx - half), y, Math.round(half * 2), 1, `rgb(${r},${g},${b})`);
  }
}

function drawSkyline(ctx, r) {
  const ranges = [[WIN.x, WIN.x + 48], [WIN.x + WIN.w - 50, WIN.x + WIN.w]];
  for (const [x0, x1] of ranges) {
    let x = x0;
    while (x < x1) {
      const w = 5 + Math.floor(r() * 8);
      const h = 6 + Math.floor(r() * 22);
      const top = WIN.horizon - h;
      px(ctx, x, top, w, h, "#1a0533");
      if (r() > 0.6) px(ctx, x + Math.floor(w / 2), top - 4, 1, 4, "#1a0533");
      for (let wy = top + 2; wy < WIN.horizon - 1; wy += 3) {
        for (let wx = x + 1; wx < x + w - 1; wx += 2) {
          if (r() > 0.62) {
            const c = r() > 0.66 ? "#ffe45e" : r() > 0.5 ? "#00f0ff" : "#ff7ac8";
            px(ctx, wx, wy, 1, 1, c);
          }
        }
      }
      x += w + (r() > 0.7 ? 1 : 0);
    }
  }
}

function drawDartboard(ctx, cx, cy) {
  for (let y = -20; y <= 20; y++) {
    for (let x = -20; x <= 20; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > 19.5) continue;
      let c;
      if (d > 17.5) c = "#2a0f45";
      else if (d > 16) c = "#ff2e97";
      else {
        const a = (Math.atan2(y, x) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2);
        const seg = Math.floor(a / (Math.PI / 10)) % 2;
        if (d < 1.6) c = "#ff2e97";
        else if (d < 3.4) c = "#00f0ff";
        else if (d > 14.5) c = seg ? "#ff2e97" : "#00f0ff";
        else if (d > 8.5 && d < 10) c = seg ? "#ff2e97" : "#00f0ff";
        else c = seg ? "#1b0b2e" : "#e9dcc9";
      }
      px(ctx, cx + x, cy + y, 1, 1, c);
    }
  }
}

function drawShelves(ctx, r) {
  px(ctx, 340, 28, 136, 90, "#12041f");
  for (let i = 0; i < 6; i++) px(ctx, 344 + i * 24, 30, 1, 86, "rgba(0,240,255,0.06)");
  px(ctx, 340, 28, 136, 1, "#ff2e97");
  px(ctx, 340, 27, 136, 1, "rgba(255,46,151,0.35)");
  const colors = ["#00f0ff", "#ff2e97", "#ffb347", "#7dffc4", "#b892ff", "#ffe45e", "#ff4d6d"];
  for (const sy of [54, 80, 106]) {
    let x = 345;
    while (x < 470) {
      const w = r() > 0.5 ? 4 : 3;
      const h = 7 + Math.floor(r() * 7);
      const c = colors[Math.floor(r() * colors.length)];
      ctx.globalAlpha = 0.9;
      px(ctx, x, sy - h, w, h, c);
      px(ctx, x + 1, sy - h - 3, Math.max(1, w - 2), 3, c);
      ctx.globalAlpha = 1;
      px(ctx, x + Math.floor(w / 2), sy - h - 4, 1, 1, "#e9dcc9");
      px(ctx, x, sy - h + 1, 1, h - 2, "rgba(255,255,255,0.35)");
      px(ctx, x, sy - Math.floor(h / 2), w, 2, "rgba(246,234,255,0.65)");
      x += w + 2 + Math.floor(r() * 3);
    }
    px(ctx, 342, sy, 132, 2, "#6a2bb0");
    px(ctx, 342, sy + 2, 132, 1, "rgba(0,0,0,0.45)");
    px(ctx, 342, sy - 1, 132, 1, "rgba(0,240,255,0.22)");
  }
}

export function drawStatic(ctx) {
  const r = rng(1984);
  let g = ctx.createLinearGradient(0, 0, 0, 150);
  g.addColorStop(0, "#14042a");
  g.addColorStop(1, "#2a0a4a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 150);
  for (let x = 6; x < W; x += 22) px(ctx, x, 0, 1, 118, "rgba(150,80,230,0.09)");
  px(ctx, 0, 118, W, 32, "#1c0636");
  for (let x = 4; x < W; x += 12) px(ctx, x, 121, 1, 27, "rgba(255,46,151,0.08)");
  px(ctx, 0, 117, W, 2, "#4a1780");
  px(ctx, 0, 119, W, 1, "rgba(255,46,151,0.4)");

  g = ctx.createLinearGradient(0, 150, 0, H);
  g.addColorStop(0, "#1d0636");
  g.addColorStop(1, "#0a0216");
  ctx.fillStyle = g;
  ctx.fillRect(0, 150, W, H - 150);
  for (let i = 1; i <= 12; i++) {
    const y = 150 + Math.round(120 * Math.pow(i / 12, 1.7));
    px(ctx, 0, y, W, 1, `rgba(255,46,151,${(0.05 + 0.13 * (i / 12)).toFixed(3)})`);
  }
  for (let k = -14; k <= 14; k++) {
    const xb = 240 + k * 40;
    for (let y = 151; y < H; y++) {
      const x = 240 + (xb - 240) * ((y - 70) / 200);
      if (x >= 0 && x < W) px(ctx, Math.round(x), y, 1, 1, `rgba(0,240,255,${(0.04 + 0.1 * ((y - 150) / 120)).toFixed(3)})`);
    }
  }
  ctx.globalAlpha = 0.22;
  px(ctx, 190, 212, 100, 1, "#ff2e97");
  px(ctx, 184, 213, 112, 30, "#3a0f5c");
  px(ctx, 190, 243, 100, 1, "#ff2e97");
  ctx.globalAlpha = 1;
  for (let x = 188; x < 292; x += 6) px(ctx, x, 227, 3, 1, "rgba(0,240,255,0.25)");

  px(ctx, 0, 150, W, 1, "#00f0ff");
  px(ctx, 0, 149, W, 1, "rgba(0,240,255,0.4)");
  px(ctx, 0, 151, W, 1, "rgba(0,240,255,0.3)");
  px(ctx, 0, 152, W, 3, "rgba(0,240,255,0.07)");

  px(ctx, WIN.x - 6, WIN.y - 6, WIN.w + 12, WIN.h + 12, "#0b0216");
  g = ctx.createLinearGradient(0, WIN.y, 0, WIN.horizon);
  g.addColorStop(0, "#1a0840");
  g.addColorStop(0.42, "#6a1b9a");
  g.addColorStop(0.76, "#ff2e97");
  g.addColorStop(1, "#ff9a3c");
  ctx.fillStyle = g;
  ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.horizon - WIN.y);
  drawStars(ctx, r);
  drawSun(ctx);
  drawSkyline(ctx, r);
  g = ctx.createLinearGradient(0, WIN.horizon, 0, WIN.y + WIN.h);
  g.addColorStop(0, "#5b1a8f");
  g.addColorStop(1, "#110426");
  ctx.fillStyle = g;
  ctx.fillRect(WIN.x, WIN.horizon, WIN.w, WIN.y + WIN.h - WIN.horizon);
  px(ctx, WIN.x, WIN.horizon, WIN.w, 1, "#ffb3d9");
  drawPalm(ctx, 178, WIN.y + WIN.h, 194, 50, 5, "#0d0221");
  drawPalm(ctx, 304, WIN.y + WIN.h, 286, 56, -4, "#0d0221");
  for (let i = 0; i < 4; i++) px(ctx, WIN.x + 18 + i * 34, WIN.y + 4 + i * 6, 14, 1, "rgba(255,255,255,0.06)");
  px(ctx, WIN.x - 1, WIN.y - 1, WIN.w + 2, 1, "rgba(0,240,255,0.7)");
  px(ctx, WIN.x - 1, WIN.y + WIN.h, WIN.w + 2, 1, "rgba(0,240,255,0.7)");
  px(ctx, WIN.x - 1, WIN.y - 1, 1, WIN.h + 2, "rgba(0,240,255,0.7)");
  px(ctx, WIN.x + WIN.w, WIN.y - 1, 1, WIN.h + 2, "rgba(0,240,255,0.7)");
  px(ctx, WIN.x - 8, WIN.y + WIN.h + 6, WIN.w + 16, 4, "#3a1170");
  px(ctx, WIN.x - 8, WIN.y + WIN.h + 6, WIN.w + 16, 1, "#7b3fc4");

  drawShelves(ctx, r);
  px(ctx, 44, 66, 44, 44, "rgba(0,0,0,0)");
  drawDartboard(ctx, 66, 88);
  ctx.globalAlpha = 0.25;
  drawBitmap(ctx, FLAMINGO, 17, 75, "#ff4fa3");
  drawBitmap(ctx, FLAMINGO, 19, 77, "#ff4fa3");
  ctx.globalAlpha = 1;
  drawBitmap(ctx, FLAMINGO, 18, 76, "#ff7ac8");
}

function drawWindowLife(ctx, t, state) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h);
  ctx.clip();
  const cx = WIN.x + WIN.w / 2;
  for (let y = WIN.horizon + 2; y < WIN.y + WIN.h; y += 2) {
    const k = (y - WIN.horizon) / (WIN.y + WIN.h - WIN.horizon);
    const w = Math.max(2, 34 - k * 28 + Math.sin(t * 2 + y) * 3);
    const off = Math.sin(t * 1.4 + y * 0.7) * 3;
    ctx.fillStyle = `rgba(255,${Math.round(200 - k * 120)},${Math.round(140 + k * 40)},${(0.55 - k * 0.4).toFixed(2)})`;
    ctx.fillRect(Math.round(cx - w / 2 + off), y, Math.round(w), 1);
  }
  const lane = (t * 26) % 260;
  const carX = WIN.x - 40 + lane;
  ctx.fillStyle = "#ff2e97";
  ctx.fillRect(Math.round(carX), 31, 3, 1);
  ctx.fillStyle = "rgba(255,46,151,0.35)";
  ctx.fillRect(Math.round(carX) - 8, 31, 8, 1);
  const lane2 = (t * 17 + 120) % 260;
  ctx.fillStyle = "#00f0ff";
  ctx.fillRect(Math.round(WIN.x + WIN.w + 30 - lane2), 41, 2, 1);
  ctx.fillStyle = "rgba(0,240,255,0.3)";
  ctx.fillRect(Math.round(WIN.x + WIN.w + 32 - lane2), 41, 7, 1);
  for (let i = 0; i < 8; i++) {
    const tw = Math.sin(t * (1.3 + i * 0.37) + i * 9) > 0.6;
    if (tw) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(WIN.x + ((i * 53) % WIN.w), WIN.y + ((i * 17) % 30), 1, 1);
    }
  }
  if (state.rain) {
    ctx.fillStyle = "rgba(180,220,255,0.35)";
    for (let i = 0; i < 60; i++) {
      const rx = WIN.x + ((i * 37 + Math.floor(t * 90)) % WIN.w);
      const ry = WIN.y + ((i * 23 + Math.floor(t * 160)) % WIN.h);
      ctx.fillRect(rx, ry, 1, 3);
    }
  }
  ctx.restore();
}

function drawDesk(ctx, d, t, occupied) {
  const { x, y } = d;
  px(ctx, x - 10, y - 34, 20, 17, "#241338");
  px(ctx, x - 10, y - 34, 20, 1, "#3c2160");
  px(ctx, x - 8, y - 32, 16, 12, occupied ? "#02121a" : "#0a0c24");
  if (occupied) {
    const colors = ["#00f0ff", "#7dffc4", "#ff7ac8", "#ffe45e"];
    const scroll = Math.floor(t * 6);
    for (let i = 0; i < 5; i++) {
      const n = (i + scroll) * 7919;
      const len = 3 + (n % 11);
      const indent = (n >> 3) % 4;
      ctx.fillStyle = colors[(n >> 5) % colors.length];
      ctx.fillRect(x - 7 + indent, y - 31 + i * 2, Math.min(len, 14 - indent), 1);
    }
    if (Math.floor(t * 3) % 2) px(ctx, x - 7, y - 21, 2, 1, "#ffffff");
  } else {
    const bx = x - 7 + Math.round(Math.abs(((t * 7) % 28) - 14));
    const byy = y - 31 + Math.round(Math.abs(((t * 5) % 20) - 10));
    px(ctx, bx, byy, 2, 1, "rgba(255,46,151,0.5)");
  }
  px(ctx, x - 2, y - 17, 4, 2, "#241338");
  px(ctx, x - 20, y - 15, 40, 3, "#5b2a86");
  px(ctx, x - 20, y - 15, 40, 1, "#7f45b8");
  px(ctx, x - 6, y - 15, 12, 1, "#c9d1e3");
  px(ctx, x - 20, y - 12, 40, 8, "#2a0f45");
  px(ctx, x - 20, y - 12, 40, 1, "rgba(255,46,151,0.7)");
  px(ctx, x - 19, y - 4, 2, 4, "#1a0830");
  px(ctx, x + 17, y - 4, 2, 4, "#1a0830");
  if (occupied) {
    ctx.fillStyle = "rgba(0,240,255,0.12)";
    ctx.fillRect(x - 14, y - 16, 28, 2);
  }
}

function drawCouch(ctx, x, y) {
  px(ctx, x - 34, y - 24, 68, 11, "#a0104f");
  px(ctx, x - 34, y - 24, 68, 1, "#ff5fa2");
  for (let i = -28; i <= 28; i += 8) px(ctx, x + i, y - 20, 1, 1, "#ff7ac8");
  px(ctx, x - 34, y - 13, 68, 7, "#e0247a");
  px(ctx, x - 34, y - 13, 68, 1, "#ff6fb0");
  px(ctx, x - 39, y - 20, 6, 15, "#a0104f");
  px(ctx, x + 33, y - 20, 6, 15, "#a0104f");
  px(ctx, x - 39, y - 20, 6, 1, "#ff5fa2");
  px(ctx, x + 33, y - 20, 6, 1, "#ff5fa2");
  px(ctx, x - 36, y - 6, 2, 4, "#ffd166");
  px(ctx, x + 34, y - 6, 2, 4, "#ffd166");
  px(ctx, x - 36, y - 2, 74, 2, "rgba(0,0,0,0.35)");
}

function drawArcade(ctx, x, y, t, state) {
  px(ctx, x - 11, y - 48, 22, 48, "#1c0b33");
  px(ctx, x - 11, y - 48, 2, 48, "#ff2e97");
  px(ctx, x + 9, y - 48, 2, 48, "#00f0ff");
  px(ctx, x - 10, y - 48, 20, 7, "#ffe45e");
  let lx = x - 6;
  for (const ch of "BET") {
    drawBitmap(ctx, LETTERS[ch], lx, y - 47, "#2b0b4f");
    lx += 4;
  }
  px(ctx, x - 8, y - 39, 16, 13, "#050010");
  const reels = ["#ff2e97", "#00f0ff", "#ffe45e", "#7dffc4", "#b892ff"];
  const spinning = state.betting;
  for (let i = 0; i < 3; i++) {
    const k = spinning ? Math.floor(t * 12 + i * 3) : Math.floor(t * 0.5 + i);
    px(ctx, x - 7 + i * 5, y - 36, 4, 7, "#160a2b");
    px(ctx, x - 6 + i * 5, y - 34, 2, 3, reels[k % reels.length]);
  }
  px(ctx, x - 7, y - 28, 14, 1, Math.floor(t * 2) % 2 ? "#ff2e97" : "#00f0ff");
  px(ctx, x - 11, y - 25, 22, 5, "#2b1450");
  px(ctx, x - 7, y - 24, 2, 2, "#ff2e97");
  px(ctx, x - 3, y - 24, 2, 2, "#00f0ff");
  px(ctx, x + 1, y - 24, 2, 2, "#ffe45e");
  px(ctx, x + 6, y - 27, 1, 3, "#c9d1e3");
  px(ctx, x + 5, y - 28, 3, 2, "#ff2e97");
  px(ctx, x - 2, y - 13, 4, 2, "#ffe45e");
  px(ctx, x - 10, y - 2, 20, 2, "#0b0216");
}

function drawJukebox(ctx, x, y, t, state) {
  const hues = ["#ff2e97", "#ff9a3c", "#ffe45e", "#7dffc4", "#00f0ff", "#b892ff"];
  const speed = state.music ? 6 : 1.2;
  px(ctx, x - 12, y - 38, 24, 38, "#3a1166");
  px(ctx, x - 10, y - 40, 20, 2, "#3a1166");
  px(ctx, x - 7, y - 42, 14, 2, "#3a1166");
  for (let i = 0; i < 3; i++) {
    const c = hues[(Math.floor(t * speed) + i) % hues.length];
    px(ctx, x - 9 + i * 2, y - 39 + i * 2, 18 - i * 4, 1, c);
    px(ctx, x - 11 + i * 2, y - 37 + i * 2, 1, 30 - i * 2, c);
    px(ctx, x + 10 - i * 2, y - 37 + i * 2, 1, 30 - i * 2, c);
  }
  px(ctx, x - 7, y - 32, 14, 9, "#120420");
  const ang = state.music ? t * 7 : 0;
  px(ctx, x - 3, y - 30, 6, 5, "#05010c");
  px(ctx, x + Math.round(Math.cos(ang) * 2) - 1, y - 28 + Math.round(Math.sin(ang) * 1.5), 1, 1, "#ff2e97");
  px(ctx, x, y - 28, 1, 1, "#ffe45e");
  for (let i = 0; i < 7; i++) px(ctx, x - 7 + i * 2, y - 20, 1, 13, "rgba(0,240,255,0.45)");
  if (state.music) {
    for (let i = 0; i < 3; i++) {
      const by = y - 8 - ((t * 14 + i * 9) % 26);
      px(ctx, x - 11, Math.round(by), 1, 1, "#ffffff");
      px(ctx, x + 10, Math.round(by - 6), 1, 1, "#ffffff");
    }
  }
  px(ctx, x - 12, y - 4, 24, 4, "#24083f");
}

function drawCounter(ctx) {
  px(ctx, 332, 146, 148, 6, "#4a1d75");
  px(ctx, 332, 146, 148, 1, "#9b5de5");
  px(ctx, 332, 152, 148, 1, "#ff2e97");
  px(ctx, 332, 153, 148, 1, "rgba(255,46,151,0.4)");
  px(ctx, 332, 154, 148, 24, "#22073d");
  for (let x = 338; x < 480; x += 12) {
    px(ctx, x, 158, 1, 16, "rgba(0,240,255,0.35)");
    px(ctx, x + 5, 162, 2, 2, "rgba(255,228,94,0.5)");
  }
  px(ctx, 332, 176, 148, 2, "#120420");
  px(ctx, 330, 146, 3, 32, "#4a1d75");
  px(ctx, 360, 142, 3, 4, "rgba(255,255,255,0.5)");
  px(ctx, 360, 143, 3, 2, "#7fffd4");
  px(ctx, 452, 140, 4, 6, "rgba(255,255,255,0.4)");
  px(ctx, 452, 143, 4, 3, "#ffe45e");
  px(ctx, 420, 141, 2, 5, "#c9d1e3");
  px(ctx, 419, 140, 4, 1, "#ff2e97");
}

function drawStool(ctx, x, y) {
  px(ctx, x - 5, y - 14, 10, 2, "#ff2e97");
  px(ctx, x - 5, y - 14, 10, 1, "#ff7ac8");
  px(ctx, x - 1, y - 12, 2, 10, "#c9d1e3");
  px(ctx, x - 4, y - 2, 8, 2, "#8a8fb0");
}

function drawPlant(ctx, x, y) {
  px(ctx, x - 5, y - 8, 10, 8, "#c2410c");
  px(ctx, x - 6, y - 9, 12, 2, "#ea580c");
  px(ctx, x - 1, y - 20, 2, 12, "#7c4a1e");
  const leaves = [[-9, -22], [-6, -26], [0, -28], [6, -26], [9, -22], [-4, -20], [4, -20]];
  for (const [dx, dy] of leaves) {
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const s = i / steps;
      px(ctx, Math.round(x + dx * s), Math.round(y - 20 + (dy + 20) * s + s * s * 4), 2, 1, i % 2 ? "#2ecc71" : "#7dffc4");
    }
  }
}

const BARTENDER = {
  body: "#c9d1e3", visor: "#120a2a", eyeColor: "#ffe45e", eyes: "visor", hat: "none",
  outfit: "suit", outfitColor: "#2b2d42", accessory: "bowtie", drink: "martini",
};

export function makeProps() {
  const props = [];
  DESKS.forEach((d, i) => props.push({ y: d.y, draw: (ctx, t, s) => drawDesk(ctx, d, t, s.desks?.[i]) }));
  props.push({ y: 224, draw: (ctx) => drawCouch(ctx, 240, 224) });
  props.push({ y: 166, draw: (ctx, t, s) => drawArcade(ctx, 326, 166, t, s) });
  props.push({ y: 162, draw: (ctx, t, s) => drawJukebox(ctx, 146, 162, t, s) });
  props.push({ y: 152, draw: (ctx, t) => drawDaemon(ctx, 410, 152, BARTENDER, { t, action: "wipe", facing: -1, seed: 3 }) });
  props.push({ y: 178, draw: (ctx) => drawCounter(ctx) });
  STOOLS.forEach((s) => props.push({ y: s.y - 2, draw: (ctx) => drawStool(ctx, s.x, s.y - 2) }));
  props.push({ y: 172, draw: (ctx) => drawPlant(ctx, 14, 172) });
  props.push({ y: 268, draw: (ctx) => drawPlant(ctx, 468, 268) });
  return props;
}

export function drawAnimated(ctx, t, state) {
  drawWindowLife(ctx, t, state);
}

export function drawLights(ctx, t, state) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = (x, y, r, color, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace("ALPHA", a.toFixed(3)));
    g.addColorStop(1, color.replace("ALPHA", "0"));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  glow(240, 168, 96, "rgba(255,110,120,ALPHA)", 0.1);
  glow(408, 72, 74, "rgba(0,240,255,ALPHA)", 0.06);
  const hues = ["rgba(255,46,151,ALPHA)", "rgba(0,240,255,ALPHA)", "rgba(255,228,94,ALPHA)", "rgba(138,43,226,ALPHA)"];
  glow(146, 140, 44, hues[Math.floor(t * (state.music ? 4 : 0.6)) % hues.length], state.music ? 0.16 : 0.08);
  glow(326, 140, 36, "rgba(255,46,151,ALPHA)", 0.1 + Math.sin(t * 3) * 0.02);
  glow(66, 88, 30, "rgba(255,46,151,ALPHA)", 0.05);
  DESKS.forEach((d, i) => {
    if (state.desks?.[i]) glow(d.x, d.y - 24, 26, "rgba(0,240,255,ALPHA)", 0.13);
  });
  ctx.restore();
}
