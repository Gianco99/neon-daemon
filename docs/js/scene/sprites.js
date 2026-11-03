import { DRINKS } from "../looks.js";

const shadeCache = new Map();

export function shade(hex, amount) {
  const key = hex + amount;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amount < 0) {
    r *= 1 + amount;
    g *= 1 + amount;
    b *= 1 + amount;
  } else {
    r += (255 - r) * amount;
    g += (255 - g) * amount;
    b += (255 - b) * amount;
  }
  const out = `rgb(${r | 0},${g | 0},${b | 0})`;
  shadeCache.set(key, out);
  return out;
}

export const STATE_COLORS = {
  working: "#00f0ff",
  waiting: "#ff2e97",
  idle: "#7dffc4",
  offline: "#6b5b8a",
};

function painter(ctx, cx, by, facing) {
  const flip = facing < 0;
  return (dx, dy, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(flip ? cx - dx - w : cx + dx, by + dy, w, h);
  };
}

const PANTS = { blazer: "#e9e4f5", hawaiian: "#2b2d42", hoodie: "#2b2d42", jacket: "#1b1b2f", tank: "#3a3f78" };
const SHOES = { blazer: "#f6f6ff", suit: "#111111", hawaiian: "#f6f6ff", hoodie: "#ff2e97", jacket: "#111111", tank: "#00f0ff" };

function drawGlass(P, dx, dy, drinkKey) {
  const drink = DRINKS[drinkKey] || DRINKS.pina;
  P(dx, dy, 3, 1, "rgba(255,255,255,0.75)");
  P(dx, dy + 1, 3, 2, drink.color);
  P(dx + 1, dy + 3, 1, 1, "rgba(255,255,255,0.75)");
  P(dx + 2, dy - 1, 1, 1, drink.garnish);
}

function drawEyes(P, look, t) {
  const E = look.eyeColor;
  const blink = (t % 3.7) < 0.12;
  switch (look.eyes) {
    case "visor": {
      P(-4, -17, 9, 1, E);
      P(-4 + (Math.floor(t * 6) % 9), -17, 1, 1, "#ffffff");
      break;
    }
    case "happy":
      P(-3, -17, 1, 1, E); P(-2, -18, 1, 1, E); P(-1, -17, 1, 1, E);
      P(1, -17, 1, 1, E); P(2, -18, 1, 1, E); P(3, -17, 1, 1, E);
      break;
    case "hearts":
      if (blink) { P(-3, -17, 3, 1, E); P(1, -17, 3, 1, E); break; }
      P(-3, -18, 1, 1, E); P(-1, -18, 1, 1, E); P(-3, -17, 3, 1, E); P(-2, -16, 1, 1, E);
      P(1, -18, 1, 1, E); P(3, -18, 1, 1, E); P(1, -17, 3, 1, E); P(2, -16, 1, 1, E);
      break;
    case "sleepy":
      P(-3, -17, 2, 1, E); P(2, -17, 2, 1, E);
      break;
    case "x":
      P(-3, -18, 1, 1, E); P(-1, -18, 1, 1, E); P(-2, -17, 1, 1, E); P(-3, -16, 1, 1, E); P(-1, -16, 1, 1, E);
      P(1, -18, 1, 1, E); P(3, -18, 1, 1, E); P(2, -17, 1, 1, E); P(1, -16, 1, 1, E); P(3, -16, 1, 1, E);
      break;
    case "stars":
      if (blink) { P(-3, -17, 3, 1, E); P(1, -17, 3, 1, E); break; }
      P(-2, -18, 1, 3, E); P(-3, -17, 3, 1, E);
      P(2, -18, 1, 3, E); P(1, -17, 3, 1, E);
      break;
    default:
      if (blink) { P(-2, -17, 2, 1, E); P(2, -17, 2, 1, E); }
      else { P(-2, -18, 2, 2, E); P(2, -18, 2, 2, E); }
  }
}

function drawHat(P, look, t, music) {
  const O = look.outfitColor;
  switch (look.hat) {
    case "fedora":
      P(-8, -21, 16, 1, "#e8e4f2");
      P(-5, -24, 10, 3, "#f6f6ff");
      P(-4, -25, 8, 1, "#f6f6ff");
      P(-1, -25, 2, 1, "#d9d4e8");
      P(-5, -22, 10, 1, "#ff2e97");
      break;
    case "cap": {
      const c = O === "#f6f6ff" ? "#ff2e97" : O;
      P(-5, -24, 10, 3, c);
      P(-6, -22, 12, 1, c);
      P(4, -22, 5, 1, shade(c, -0.3));
      P(-1, -25, 2, 1, c);
      P(-4, -24, 3, 1, shade(c, 0.3));
      break;
    }
    case "headphones": {
      const lit = music && Math.floor(t * 4) % 2 === 0;
      P(-5, -23, 10, 1, "#2b2d42");
      P(-6, -22, 1, 2, "#2b2d42");
      P(5, -22, 1, 2, "#2b2d42");
      P(-8, -19, 2, 5, lit ? "#00f0ff" : "#ff2e97");
      P(6, -19, 2, 5, lit ? "#00f0ff" : "#ff2e97");
      break;
    }
    case "crown":
      P(-5, -23, 10, 2, "#ffd166");
      P(-5, -25, 2, 2, "#ffd166");
      P(-1, -26, 2, 3, "#ffd166");
      P(3, -25, 2, 2, "#ffd166");
      P(-1, -23, 2, 1, "#ff2e97");
      P(-4, -23, 1, 1, "#00f0ff");
      P(3, -23, 1, 1, "#00f0ff");
      break;
    case "beanie": {
      const c = O === "#111111" ? "#ff2e97" : O;
      P(-6, -23, 12, 3, c);
      P(-5, -25, 10, 2, c);
      P(-6, -21, 12, 1, shade(c, -0.35));
      P(-1, -27, 2, 2, "#f6f6ff");
      break;
    }
    case "halo": {
      const b = Math.round(Math.sin(t * 3));
      const y = -28 + b;
      P(-3, y, 6, 1, "#ffe45e");
      P(-5, y + 1, 2, 1, "#ffe45e");
      P(3, y + 1, 2, 1, "#ffe45e");
      P(-3, y + 2, 6, 1, "#ffe45e");
      break;
    }
    case "mohawk":
      P(-4, -23, 2, 2, "#ff2e97");
      P(-2, -25, 2, 4, "#ff2e97");
      P(0, -26, 2, 5, "#ff4fa3");
      P(2, -24, 2, 3, "#ff2e97");
      break;
    default:
      break;
  }
}

export function drawDaemon(ctx, x, y, look, o = {}) {
  const t = o.t ?? 0;
  const action = o.action ?? "idle";
  const cx = Math.round(x);
  const by = Math.round(y);
  const walking = action === "walk" || action === "dance";
  const frame = walking ? Math.floor(t * (action === "dance" ? 6 : 9)) % 4 : 0;
  let bob = 0;
  if (action === "dance") bob = frame % 2 === 0 ? -1 : 0;
  else if (action === "walk") bob = frame === 1 || frame === 3 ? -1 : 0;
  else bob = Math.sin(t * 2.1 + (o.seed || 0)) > 0.7 ? -1 : 0;

  const P = painter(ctx, cx, by, o.facing ?? 1);
  const Pb = painter(ctx, cx, by + bob, o.facing ?? 1);
  const B = look.body;
  const Bd = shade(B, -0.28);
  const Bl = shade(B, 0.4);
  const O = look.outfit === "jacket" ? "#1d1b2e" : look.outfitColor;
  const Od = shade(O, -0.32);
  const Ol = shade(O, 0.22);
  const pants = look.outfit === "suit" ? Od : PANTS[look.outfit] || "#241c3a";
  const shoes = SHOES[look.outfit] || "#f6f6ff";

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(cx - 6, by - 1, 12, 2);

  const lUp = frame === 1 ? 1 : 0;
  const rUp = frame === 3 ? 1 : 0;
  P(-4, -5 - lUp, 3, 4, pants);
  P(-4, -1 - lUp, 4, 1, shoes);
  P(1, -5 - rUp, 3, 4, pants);
  P(1, -1 - rUp, 4, 1, shoes);

  if (look.outfit === "hoodie") Pb(-6, -14, 12, 3, Od);

  if (look.outfit === "tank") {
    Pb(-5, -12, 10, 7, B);
    Pb(-4, -11, 8, 6, O);
    Pb(-3, -12, 1, 1, O);
    Pb(2, -12, 1, 1, O);
    Pb(3, -11, 1, 6, Od);
  } else {
    Pb(-5, -12, 10, 7, O);
    Pb(-5, -12, 10, 1, Ol);
    Pb(4, -11, 1, 6, Od);
  }

  switch (look.outfit) {
    case "blazer":
      Pb(-1, -12, 2, 7, "#f6f6ff");
      Pb(-2, -12, 1, 3, Od);
      Pb(1, -12, 1, 3, Od);
      Pb(2, -10, 1, 1, "#00f0ff");
      break;
    case "hawaiian":
      Pb(-4, -11, 1, 1, "#ffe45e");
      Pb(2, -11, 1, 1, "#00f0ff");
      Pb(-1, -9, 1, 1, "#ff2e97");
      Pb(3, -8, 1, 1, "#ffe45e");
      Pb(-3, -7, 1, 1, "#00f0ff");
      Pb(1, -6, 1, 1, "#ff2e97");
      Pb(-2, -12, 1, 1, "#f6f6ff");
      Pb(1, -12, 1, 1, "#f6f6ff");
      break;
    case "suit":
      Pb(-2, -12, 4, 3, "#f6f6ff");
      Pb(-1, -11, 2, 4, "#ff2e97");
      Pb(-3, -12, 1, 4, Od);
      Pb(2, -12, 1, 4, Od);
      break;
    case "hoodie":
      Pb(-3, -8, 6, 2, Od);
      Pb(-2, -11, 1, 2, "#f6f6ff");
      Pb(1, -11, 1, 2, "#f6f6ff");
      break;
    case "jacket":
      Pb(-5, -12, 3, 2, look.outfitColor);
      Pb(2, -12, 3, 2, look.outfitColor);
      Pb(0, -11, 1, 6, "#c9d1e3");
      break;
    default:
      break;
  }

  if (look.accessory === "chain") {
    Pb(-3, -11, 1, 1, "#ffd166"); Pb(-2, -10, 1, 1, "#ffd166"); Pb(-1, -9, 2, 1, "#ffd166");
    Pb(1, -10, 1, 1, "#ffd166"); Pb(2, -11, 1, 1, "#ffd166"); Pb(-1, -8, 2, 1, "#ffe45e");
  } else if (look.accessory === "bowtie") {
    Pb(-3, -12, 2, 2, "#ff2e97"); Pb(1, -12, 2, 2, "#ff2e97"); Pb(-1, -12, 2, 1, "#c2185b");
  } else if (look.accessory === "scarf") {
    Pb(-5, -12, 10, 2, "#00f0ff"); Pb(-5, -12, 10, 1, "#7ff8ff"); Pb(2, -10, 2, 3, "#00c3d0");
  }

  const sleeve = look.outfit === "tank" ? B : O;
  const swing = action === "walk" ? (frame === 1 ? -1 : frame === 3 ? 1 : 0) : 0;
  const sipping = action === "sip" && Math.sin(t * 1.3) > 0.55;

  if (action === "wave") {
    const w = Math.floor(t * 6) % 2;
    Pb(-7, -12, 2, 5, sleeve); Pb(-7, -7, 2, 1, B);
    Pb(5 + w, -18, 2, 6, sleeve); Pb(5 + w, -19, 2, 1, B);
  } else if (action === "dance" || action === "cheer") {
    const a = action === "dance" ? frame % 2 : 0;
    Pb(-8, -17 + a, 2, 5, sleeve); Pb(-8, -18 + a, 2, 1, B);
    Pb(6, -17 - a + 1, 2, 5, sleeve); Pb(6, -18 - a + 1, 2, 1, B);
    if (action === "cheer") drawGlass(Pb, 6, -22, look.drink);
  } else if (action === "type") {
    const k = Math.floor(t * 10) % 2;
    Pb(-6, -11, 2, 3, sleeve); Pb(-5, -8 - k, 2, 1, B);
    Pb(4, -11, 2, 3, sleeve); Pb(3, -9 + k, 2, 1, B);
  } else if (action === "wipe") {
    const k = Math.round(Math.sin(t * 5) * 2);
    Pb(-7, -12, 2, 5, sleeve); Pb(-7, -7, 2, 1, B);
    Pb(4 + k, -9, 3, 2, sleeve); Pb(6 + k, -9, 3, 2, "#f6f6ff");
  } else if (action === "sip" || action === "hold") {
    Pb(-7, -12 + swing, 2, 5, sleeve); Pb(-7, -7 + swing, 2, 1, B);
    if (sipping) {
      Pb(5, -15, 2, 4, sleeve); Pb(4, -16, 2, 1, B);
      drawGlass(Pb, 1, -20, look.drink);
    } else {
      Pb(5, -12, 2, 5, sleeve); Pb(5, -7, 2, 1, B);
      drawGlass(Pb, 6, -11, look.drink);
    }
  } else {
    Pb(-7, -12 + swing, 2, 5, sleeve); Pb(-7, -7 + swing, 2, 1, B);
    Pb(5, -12 - swing, 2, 5, sleeve); Pb(5, -7 - swing, 2, 1, B);
  }

  Pb(-5, -21, 10, 9, B);
  Pb(-6, -20, 12, 7, B);
  Pb(-4, -20, 3, 1, Bl);
  Pb(-5, -13, 10, 1, Bd);
  Pb(-7, -17, 1, 2, Bd);
  Pb(6, -17, 1, 2, Bd);
  Pb(-5, -19, 10, 5, look.visor);
  Pb(-5, -19, 10, 1, shade(look.visor, 0.18));
  drawEyes(Pb, look, t + (o.seed || 0));
  if (look.accessory === "shades") {
    Pb(-5, -18, 10, 2, "#07070c");
    Pb(-4, -18, 1, 1, "#2c2c44");
    Pb(2, -18, 1, 1, "#ffffff");
  }

  const covered = ["fedora", "cap", "beanie", "crown"].includes(look.hat);
  if (!covered) {
    Pb(0, -23, 1, 2, "#8a8fb0");
    Pb(0, -24, 1, 1, Math.floor(t * 2 + (o.seed || 0)) % 2 ? look.eyeColor : shade(look.eyeColor, -0.4));
  }
  drawHat(Pb, look, t, o.music);
}

export function drawDrone(ctx, x, y, look, o = {}) {
  const t = o.t ?? 0;
  const seed = o.seed || 0;
  const state = o.state || "idle";
  const S = STATE_COLORS[state] || STATE_COLORS.idle;
  const cx = Math.round(x);
  const by = Math.round(y);
  const hover = Math.round(Math.sin(t * 3 + seed) * 1.4);
  const cy = by - 12 + hover;
  const P = painter(ctx, cx, cy, o.facing ?? 1);
  const B = look.body;
  const Bd = shade(B, -0.32);
  const Bl = shade(B, 0.4);

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(cx - 3, by - 1, 6, 1);

  const flick = Math.floor(t * 18 + seed) % 2;
  P(-1, 4, 2, 1, flick ? "#ffe45e" : "#ff9a3c");
  if (flick) P(-1, 5, 2, 1, "rgba(255,154,60,0.55)");

  P(-6, 0, 1, 2, Bd);
  P(5, 0, 1, 2, Bd);
  P(-4, -4, 8, 8, B);
  P(-5, -3, 10, 6, B);
  P(-3, -4, 3, 1, Bl);
  P(-4, 3, 8, 1, Bd);

  if (o.back) {
    P(-3, -2, 6, 3, Bd);
    P(-2, -1, 4, 1, S);
  } else {
    P(-4, -2, 8, 4, look.visor);
    if (state === "working") {
      P(-3, -1, 6, 1, shade(S, -0.6));
      P(-3 + (Math.floor(t * 8 + seed) % 5), -1, 2, 1, S);
    } else if (state === "waiting") {
      const on = Math.floor(t * 4) % 2 === 0;
      P(-3, -1, 2, 2, on ? S : shade(S, -0.45));
      P(1, -1, 2, 2, on ? S : shade(S, -0.45));
    } else if (state === "offline") {
      P(-3, 0, 6, 1, "#555566");
    } else {
      P(-3, 0, 1, 1, S); P(-2, -1, 1, 1, S); P(-1, 0, 1, 1, S);
      P(1, 0, 1, 1, S); P(2, -1, 1, 1, S); P(3, 0, 1, 1, S);
    }
  }

  P(0, -6, 1, 2, "#8a8fb0");
  const spin = Math.floor(t * 24 + seed) % 3;
  const w = [7, 3, 5][spin];
  P(-Math.floor(w / 2), -7, w, 1, "#d7e3ff");
  P(0, -7, 1, 1, S);

  if (o.drink && !o.back) drawGlass(P, 5, -1, look.drink);
}

export function renderPortrait(canvas, look, { size = 24, full = false, t = 0 } = {}) {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  if (full) drawDaemon(ctx, size / 2, size - 3, look, { t, action: "idle" });
  else drawDaemon(ctx, size / 2, size + 6, look, { t, action: "idle" });
  return canvas;
}
