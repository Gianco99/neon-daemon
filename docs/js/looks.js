import { hashString, rng, pick } from "./lib/util.js";

export const BODY_COLORS = ["#c9d1e3", "#ff4fa3", "#39f3ff", "#7dffc4", "#b892ff", "#ff9a3c", "#ffd166", "#6c70e0", "#ff6f61", "#f6f6ff", "#2e2b4a", "#a8ff60"];
export const VISOR_COLORS = ["#120a2a", "#0d2140", "#2a0f3a", "#082a26", "#301018", "#1c1c1c"];
export const EYE_COLORS = ["#00f0ff", "#ff2e97", "#ffe45e", "#7dffc4", "#ffffff", "#ff4d4d", "#b892ff", "#ff9a3c"];
export const OUTFIT_COLORS = ["#ff8fc7", "#7fe7ff", "#f6f6ff", "#ffd1a6", "#b8f2c9", "#2b2d42", "#8a2be2", "#ff2e97", "#ffe45e", "#3a86ff", "#111111", "#e85d04"];

export const EYES = ["dots", "visor", "happy", "hearts", "sleepy", "x", "stars"];
export const HATS = ["none", "fedora", "cap", "headphones", "crown", "beanie", "halo", "mohawk"];
export const OUTFITS = ["blazer", "hawaiian", "suit", "hoodie", "jacket", "tank"];
export const ACCESSORIES = ["none", "shades", "chain", "bowtie", "scarf"];

export const DRINKS = {
  pina: { name: "Piña Colada", color: "#fff4c7", garnish: "#ff9a3c" },
  martini: { name: "Neon Martini", color: "#7fffd4", garnish: "#a8ff60" },
  mojito: { name: "Mojito", color: "#c6ff9e", garnish: "#2ecc71" },
  blue: { name: "Blue Lagoon", color: "#3ad7ff", garnish: "#ffe45e" },
  soda: { name: "Synth Soda", color: "#ff2e97", garnish: "#ffffff" },
  espresso: { name: "Espresso Tonic", color: "#6b4226", garnish: "#ffe45e" },
  sake: { name: "Hot Sake", color: "#f6f6ff", garnish: "#ff4d4d" },
};

export const NAMES = {
  dots: "Dots", visor: "Visor", happy: "Happy", hearts: "Hearts", sleepy: "Sleepy", x: "Glitched", stars: "Stars",
  none: "None", fedora: "Fedora", cap: "Cap", headphones: "Headphones", crown: "Crown", beanie: "Beanie", halo: "Halo", mohawk: "Mohawk",
  blazer: "Pastel blazer", hawaiian: "Hawaiian", suit: "Sharp suit", hoodie: "Hoodie", jacket: "Leather", tank: "Tank top",
  shades: "Shades", chain: "Gold chain", bowtie: "Bow tie", scarf: "Scarf",
};

const HEX = /^#[0-9a-f]{6}$/i;

const FIELDS = {
  body: (v) => HEX.test(v),
  visor: (v) => HEX.test(v),
  eyeColor: (v) => HEX.test(v),
  outfitColor: (v) => HEX.test(v),
  eyes: (v) => EYES.includes(v),
  hat: (v) => HATS.includes(v),
  outfit: (v) => OUTFITS.includes(v),
  accessory: (v) => ACCESSORIES.includes(v),
  drink: (v) => Object.hasOwn(DRINKS, v),
};

export function defaultLook(seed = "") {
  const r = rng(hashString(String(seed)) || 7);
  return {
    body: pick(BODY_COLORS, r),
    visor: VISOR_COLORS[0],
    eyeColor: pick(EYE_COLORS, r),
    outfitColor: pick(OUTFIT_COLORS, r),
    eyes: pick(["dots", "dots", "visor", "happy", "stars"], r),
    hat: pick(HATS, r),
    outfit: pick(OUTFITS, r),
    accessory: pick(ACCESSORIES, r),
    drink: pick(Object.keys(DRINKS), r),
  };
}

export function normalizeLook(look, seed = "") {
  const base = defaultLook(seed);
  if (!look || typeof look !== "object") return base;
  for (const [key, valid] of Object.entries(FIELDS)) {
    if (valid(look[key])) base[key] = look[key];
  }
  return base;
}

export function randomLook() {
  return defaultLook(Math.random().toString(36));
}
