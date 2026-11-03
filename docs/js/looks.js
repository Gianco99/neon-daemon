export const DEFAULT_LOOK = {
  body: "#26232f",
  visor: "#120a2a",
  eyeColor: "#ffffff",
  outfitColor: "#2b2d42",
  eyes: "dots",
  hat: "cap",
  outfit: "jacket",
  accessory: "none",
  droneBody: "#26232f",
  droneStyle: "rotor",
  drink: "soda",
};

const CHASSIS = [
  ["#26232f", "Midnight", 0], ["#c9d1e3", "Chrome", 150], ["#f6f6ff", "Pearl", 150], ["#6c70e0", "Indigo", 150],
  ["#ff6f61", "Coral", 150], ["#ff4fa3", "Hot Pink", 200], ["#39f3ff", "Cyan", 200], ["#7dffc4", "Mint", 200],
  ["#b892ff", "Lilac", 200], ["#ff9a3c", "Sunset", 250], ["#a8ff60", "Lime", 250], ["#ffd166", "Gold", 500],
];

export const CATALOG = [
  ...CHASSIS.map(([value, name, price]) => ["body", value, name, price]),
  ...[["#120a2a", "Smoke", 0], ["#0d2140", "Deep Sea", 75], ["#2a0f3a", "Plum", 75], ["#082a26", "Lagoon", 75], ["#301018", "Wine", 75], ["#1c1c1c", "Onyx", 75]]
    .map(([value, name, price]) => ["visor", value, name, price]),
  ...[["#ffffff", "White", 0], ["#00f0ff", "Cyan", 100], ["#ff2e97", "Pink", 100], ["#ffe45e", "Yellow", 100], ["#7dffc4", "Mint", 100], ["#ff4d4d", "Red", 150], ["#b892ff", "Violet", 150], ["#ff9a3c", "Amber", 150]]
    .map(([value, name, price]) => ["eyeColor", value, name, price]),
  ...[["#2b2d42", "Charcoal", 0], ["#111111", "Black", 50], ["#f6f6ff", "White", 100], ["#ff8fc7", "Flamingo", 150], ["#7fe7ff", "Ice", 150], ["#ffd1a6", "Peach", 150],
    ["#b8f2c9", "Seafoam", 150], ["#8a2be2", "Purple", 200], ["#ff2e97", "Neon Pink", 200], ["#3a86ff", "Ocean", 200], ["#ffe45e", "Lemon", 200], ["#e85d04", "Ember", 250]]
    .map(([value, name, price]) => ["outfitColor", value, name, price]),
  ...[["dots", "Dots", 0], ["sleepy", "Sleepy", 100], ["visor", "Visor", 150], ["happy", "Happy", 150], ["stars", "Stars", 250], ["hearts", "Hearts", 250], ["x", "Glitched", 300]]
    .map(([value, name, price]) => ["eyes", value, name, price]),
  ...[["cap", "Cap", 0], ["none", "None", 0], ["beanie", "Beanie", 200], ["headphones", "Headphones", 300], ["fedora", "Fedora", 400], ["mohawk", "Mohawk", 400], ["halo", "Halo", 750], ["crown", "Crown", 1000]]
    .map(([value, name, price]) => ["hat", value, name, price]),
  ...[["jacket", "Leather", 0], ["tank", "Tank top", 150], ["hoodie", "Hoodie", 200], ["hawaiian", "Hawaiian", 300], ["blazer", "Pastel blazer", 400], ["suit", "Sharp suit", 500]]
    .map(([value, name, price]) => ["outfit", value, name, price]),
  ...[["none", "None", 0], ["scarf", "Scarf", 150], ["bowtie", "Bow tie", 200], ["shades", "Shades", 300], ["chain", "Gold chain", 500]]
    .map(([value, name, price]) => ["accessory", value, name, price]),
  ...CHASSIS.map(([value, name, price]) => ["droneBody", value, name, Math.round(price * 0.6)]),
  ...[["rotor", "Rotor", 0], ["antenna", "Antennae", 200], ["dish", "Dish", 300], ["cat", "Cat ears", 400], ["crown", "Tiny crown", 800]]
    .map(([value, name, price]) => ["droneStyle", value, name, price]),
].map(([kind, value, name, price]) => ({ kind, value, name, price }));

const BY_KEY = new Map(CATALOG.map((item) => [`${item.kind}:${item.value}`, item]));

export function itemOf(kind, value) {
  return BY_KEY.get(`${kind}:${value}`) || null;
}

export function itemsOf(kind) {
  return CATALOG.filter((item) => item.kind === kind);
}

export function isFree(kind, value) {
  return itemOf(kind, value)?.price === 0;
}

export function owns(unlocks, kind, value) {
  return isFree(kind, value) || !!unlocks?.has(`${kind}:${value}`);
}

export function lockedParts(look, unlocks) {
  return Object.keys(DEFAULT_LOOK)
    .filter((kind) => kind !== "drink")
    .map((kind) => itemOf(kind, look[kind]))
    .filter((item) => item && !owns(unlocks, item.kind, item.value));
}

export const DRINKS = {
  soda: { name: "Synth Soda", color: "#ff2e97", garnish: "#ffffff", price: 15, minutes: 10, effect: "sugar", title: "Sugar Rush", text: "Rainbow aura, and you can't stop dancing.", emoji: "🥤" },
  espresso: { name: "Espresso Tonic", color: "#6b4226", garnish: "#ffe45e", price: 20, minutes: 10, effect: "wired", title: "Wired", text: "Walk 80% faster. A little jittery.", emoji: "☕" },
  pina: { name: "Piña Colada", color: "#fff4c7", garnish: "#ff9a3c", price: 25, minutes: 20, effect: "island", title: "Island Time", text: "Hanging out in a bar pays double chips.", emoji: "🍍" },
  martini: { name: "Neon Martini", color: "#7fffd4", garnish: "#a8ff60", price: 30, minutes: 10, effect: "steady", title: "Steady Hand", text: "Your darts aim wobbles 60% less.", emoji: "🍸" },
  sake: { name: "Hot Sake", color: "#f6f6ff", garnish: "#ff4d4d", price: 30, minutes: 10, effect: "courage", title: "Liquid Courage", text: "Your last dart of every game scores double.", emoji: "🍶" },
  mojito: { name: "Mojito", color: "#c6ff9e", garnish: "#2ecc71", price: 35, minutes: 30, effect: "fresh", title: "Fresh Start", text: "Jobs your agents ship pay double chips.", emoji: "🌿" },
  blue: { name: "Blue Lagoon", color: "#3ad7ff", garnish: "#ffe45e", price: 40, minutes: 15, effect: "lucky", title: "Lucky Streak", text: "Winning bets pay 50% more.", emoji: "🍹" },
};

export function activeBuff(profileLike) {
  const id = profileLike?.buff;
  const until = profileLike?.buff_until ?? profileLike?.buffUntil;
  if (!id || !DRINKS[id] || !until || new Date(until).getTime() <= Date.now()) return null;
  return { id, until, ...DRINKS[id] };
}

export const EARNING = [
  ["🤖", "Your agent ships a job", "+10 per finished job (15 s or longer), up to 20 a day"],
  ["🍸", "Hang out in a bar", "+5 every 10 minutes, up to 12 times a day"],
  ["🔥", "Daily streak", "+50 on your first visit each day, +10 more per day in a row"],
  ["🎯", "Darts", "+1 per 10 points, up to 50 a day"],
  ["🎲", "Bet booth", "3× or 2× on a winning bet"],
];

export function normalizeLook(look) {
  const out = { ...DEFAULT_LOOK };
  if (!look || typeof look !== "object") return out;
  for (const kind of Object.keys(DEFAULT_LOOK)) {
    const v = look[kind];
    if (kind === "drink") {
      if (Object.hasOwn(DRINKS, v)) out.drink = v;
    } else if (itemOf(kind, v)) {
      out[kind] = v;
    }
  }
  return out;
}

export function randomOwnedLook(unlocks) {
  const out = { ...DEFAULT_LOOK };
  for (const kind of Object.keys(DEFAULT_LOOK)) {
    if (kind === "drink") continue;
    const options = itemsOf(kind).filter((item) => owns(unlocks, kind, item.value));
    out[kind] = options[Math.floor(Math.random() * options.length)].value;
  }
  return out;
}
