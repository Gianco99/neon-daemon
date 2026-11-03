const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const BULL = 6.35 / 170;
const OUTER_BULL = 15.9 / 170;
const TREBLE_IN = 99 / 170;
const TREBLE_OUT = 107 / 170;
const DOUBLE_IN = 162 / 170;
const DARTS = 5;
const TAU = Math.PI * 2;
const SEGMENT = TAU / 20;

export function scoreAt(x, y, radius) {
  const r = Math.hypot(x, y) / radius;
  if (!Number.isFinite(r)) return { points: 0, label: 'MISS' };
  if (r <= BULL) return { points: 50, label: 'BULLSEYE' };
  if (r <= OUTER_BULL) return { points: 25, label: 'BULL' };
  if (r > 1) return { points: 0, label: 'MISS' };
  const degrees = ((Math.atan2(x, -y) * 180) / Math.PI + 369) % 360;
  const number = ORDER[Math.floor(degrees / 18) % 20];
  if (r >= TREBLE_IN && r <= TREBLE_OUT) return { points: number * 3, label: `TREBLE ${number}` };
  if (r >= DOUBLE_IN) return { points: number * 2, label: `DOUBLE ${number}` };
  return { points: number, label: `SINGLE ${number}` };
}

const STYLE = `
.dz-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: radial-gradient(120% 90% at 50% 15%, rgba(138, 43, 226, 0.4), rgba(6, 1, 18, 0.94) 70%);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  color: var(--nd-text, #f6eaff);
  font-family: var(--nd-font-ui, 'Orbitron', system-ui, sans-serif);
  animation: dz-in 0.22s ease-out;
}
.dz-overlay *, .dz-overlay *::before, .dz-overlay *::after { box-sizing: border-box; }
.dz-panel {
  position: relative;
  width: min(560px, 100%);
  max-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 16px;
  border-radius: 20px;
  background: linear-gradient(160deg, rgba(255, 46, 151, 0.1), transparent 42%), var(--nd-panel, rgba(20, 6, 46, 0.86));
  border: 1px solid rgba(0, 240, 255, 0.38);
  box-shadow: inset 0 0 0 1px rgba(255, 46, 151, 0.22), 0 0 28px rgba(255, 46, 151, 0.35), 0 0 90px rgba(0, 240, 255, 0.14);
  animation: dz-rise-in 0.3s cubic-bezier(0.2, 1.3, 0.4, 1);
}
.dz-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: inherit;
  pointer-events: none;
  background: repeating-linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 3px);
}
.dz-head { display: flex; align-items: center; gap: 12px; }
.dz-titles { flex: 1; min-width: 0; overflow: hidden; }
.dz-title {
  font-family: var(--nd-font-display, 'Monoton', sans-serif);
  font-size: clamp(24px, 7vw, 36px);
  line-height: 1.05;
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: #fff;
  text-shadow: 0 0 2px #fff, 0 0 8px var(--nd-pink, #ff2e97), 0 0 22px var(--nd-pink, #ff2e97), 0 0 44px rgba(255, 46, 151, 0.6);
  animation: dz-flicker 7s infinite;
}
.dz-sub {
  margin-top: 4px;
  font-family: var(--nd-font-mono, 'VT323', monospace);
  font-size: 19px;
  color: var(--nd-cyan, #00f0ff);
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dz-close {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(0, 240, 255, 0.55);
  background: rgba(0, 240, 255, 0.08);
  color: var(--nd-cyan, #00f0ff);
  font: 400 26px/1 var(--nd-font-ui, 'Orbitron', sans-serif);
  cursor: pointer;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.3);
  transition: transform 0.15s, box-shadow 0.15s;
}
.dz-close:hover, .dz-close:focus-visible { transform: rotate(90deg); box-shadow: 0 0 20px rgba(0, 240, 255, 0.65); outline: none; }
.dz-hud { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: end; gap: 8px 16px; margin: 14px 0 12px; }
.dz-label { font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: rgba(246, 234, 255, 0.7); }
.dz-total {
  font-family: var(--nd-font-mono, 'VT323', monospace);
  font-size: 46px;
  line-height: 0.8;
  font-variant-numeric: tabular-nums;
  color: var(--nd-yellow, #ffe45e);
  text-shadow: 0 0 10px rgba(255, 154, 60, 0.8), 0 0 24px rgba(255, 154, 60, 0.45);
}
.dz-total.dz-bump { animation: dz-bump 0.35s ease-out; }
.dz-pipsbox { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; min-width: 0; }
.dz-pips { display: flex; gap: 7px; }
.dz-pip {
  width: 7px;
  height: 24px;
  border-radius: 4px 4px 2px 2px;
  background: linear-gradient(var(--nd-cyan, #00f0ff), var(--nd-pink, #ff2e97));
  box-shadow: 0 0 10px rgba(255, 46, 151, 0.7);
  transition: opacity 0.2s, transform 0.2s;
}
.dz-pip.is-used { opacity: 0.16; box-shadow: none; transform: translateY(4px); }
.dz-last {
  max-width: 100%;
  font-family: var(--nd-font-mono, 'VT323', monospace);
  font-size: 19px;
  color: rgba(246, 234, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dz-stamina { grid-column: 1 / -1; height: 8px; border-radius: 999px; overflow: hidden; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.14); }
.dz-stamina > i {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: left center;
  background: linear-gradient(90deg, var(--nd-cyan, #00f0ff), var(--nd-purple, #8a2be2) 55%, var(--nd-pink, #ff2e97));
  box-shadow: 0 0 12px rgba(255, 46, 151, 0.8);
}
.dz-stamina.is-low > i { background: linear-gradient(90deg, var(--nd-orange, #ff9a3c), var(--nd-yellow, #ffe45e)); }
.dz-stage { position: relative; display: flex; justify-content: center; }
.dz-wrap { position: relative; }
.dz-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: crosshair;
  outline: none;
  border-radius: 50%;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.dz-canvas:focus-visible { box-shadow: 0 0 0 2px rgba(0, 240, 255, 0.55); }
.dz-pops { position: absolute; inset: 0; pointer-events: none; }
.dz-pop {
  position: absolute;
  transform: translate(-50%, -50%);
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  animation: dz-float 1.15s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
}
.dz-pop b { display: block; font-size: 20px; font-weight: 900; letter-spacing: 0.06em; color: #fff; }
.dz-pop span { display: block; font-family: var(--nd-font-mono, 'VT323', monospace); font-size: 24px; color: #fff; }
.dz-pop.is-bull b { font-size: 28px; text-shadow: 0 0 8px var(--nd-yellow, #ffe45e), 0 0 24px var(--nd-orange, #ff9a3c), 0 0 48px var(--nd-orange, #ff9a3c); }
.dz-pop.is-bull span { color: var(--nd-yellow, #ffe45e); }
.dz-pop.is-treble b { text-shadow: 0 0 8px var(--nd-pink, #ff2e97), 0 0 22px var(--nd-pink, #ff2e97); }
.dz-pop.is-treble span { color: var(--nd-pink, #ff2e97); }
.dz-pop.is-double b { text-shadow: 0 0 8px var(--nd-cyan, #00f0ff), 0 0 22px var(--nd-cyan, #00f0ff); }
.dz-pop.is-double span { color: var(--nd-cyan, #00f0ff); }
.dz-pop.is-single b { font-size: 17px; text-shadow: 0 0 8px rgba(246, 234, 255, 0.8); }
.dz-pop.is-miss b { font-size: 18px; color: rgba(246, 234, 255, 0.55); }
.dz-help {
  margin-top: 12px;
  text-align: center;
  font-family: var(--nd-font-mono, 'VT323', monospace);
  font-size: 19px;
  line-height: 1.2;
  color: rgba(246, 234, 255, 0.72);
}
.dz-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
.dz-end {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 16px;
  overflow-y: auto;
  text-align: center;
  border-radius: inherit;
  background: radial-gradient(90% 70% at 50% 28%, rgba(255, 46, 151, 0.2), rgba(8, 1, 22, 0.93) 70%);
  animation: dz-in 0.25s ease-out;
}
.dz-end[hidden] { display: none; }
.dz-final {
  font-family: var(--nd-font-display, 'Monoton', sans-serif);
  font-size: clamp(56px, 18vw, 96px);
  line-height: 1;
  color: #fff;
  text-shadow: 0 0 4px #fff, 0 0 14px var(--nd-pink, #ff2e97), 0 0 36px var(--nd-pink, #ff2e97), 0 0 72px rgba(255, 46, 151, 0.6);
}
.dz-rating { font-size: 13px; font-weight: 700; letter-spacing: 0.2em; color: var(--nd-cyan, #00f0ff); text-shadow: 0 0 10px rgba(0, 240, 255, 0.8); }
.dz-note { font-family: var(--nd-font-mono, 'VT323', monospace); font-size: 18px; color: var(--nd-orange, #ff9a3c); }
.dz-note:empty { display: none; }
.dz-leader {
  width: min(340px, 100%);
  margin-top: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(0, 240, 255, 0.28);
  background: rgba(13, 2, 33, 0.65);
  box-shadow: inset 0 0 24px rgba(138, 43, 226, 0.25);
}
.dz-leader-title {
  margin-bottom: 6px;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--nd-pink, #ff2e97);
  text-shadow: 0 0 8px rgba(255, 46, 151, 0.7);
}
.dz-ranks { list-style: none; margin: 0; padding: 0; }
.dz-ranks li {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: baseline;
  padding: 4px 2px;
  text-align: left;
  font-family: var(--nd-font-mono, 'VT323', monospace);
  font-size: 21px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.09);
}
.dz-ranks li:last-child { border-bottom: 0; }
.dz-ranks li:first-child:not(.dz-empty) { color: var(--nd-yellow, #ffe45e); text-shadow: 0 0 8px rgba(255, 228, 94, 0.6); }
.dz-ranks li.dz-empty { display: block; text-align: center; color: rgba(246, 234, 255, 0.6); }
.dz-rank { color: rgba(246, 234, 255, 0.5); }
.dz-handle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dz-points { font-variant-numeric: tabular-nums; color: var(--nd-cyan, #00f0ff); }
.dz-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 6px; }
.dz-btn {
  padding: 12px 18px;
  border-radius: 12px;
  border: 1px solid var(--nd-pink, #ff2e97);
  color: #fff;
  background: linear-gradient(135deg, rgba(255, 46, 151, 0.42), rgba(138, 43, 226, 0.42));
  box-shadow: 0 0 16px rgba(255, 46, 151, 0.45), inset 0 0 12px rgba(255, 255, 255, 0.08);
  font-family: var(--nd-font-ui, 'Orbitron', sans-serif);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.12s;
}
.dz-btn:hover, .dz-btn:focus-visible { transform: translateY(-1px); box-shadow: 0 0 26px rgba(255, 46, 151, 0.75); outline: none; }
.dz-btn.dz-ghost { border-color: rgba(0, 240, 255, 0.6); background: rgba(0, 240, 255, 0.08); box-shadow: 0 0 12px rgba(0, 240, 255, 0.3); }
.dz-btn.dz-ghost:hover, .dz-btn.dz-ghost:focus-visible { box-shadow: 0 0 22px rgba(0, 240, 255, 0.6); }
@keyframes dz-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes dz-rise-in { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes dz-float {
  0% { opacity: 0; transform: translate(-50%, -20%) scale(0.6); }
  14% { opacity: 1; transform: translate(-50%, -70%) scale(1.15); }
  30% { transform: translate(-50%, -80%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -190%) scale(1); }
}
@keyframes dz-bump { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 100% { transform: scale(1); } }
@keyframes dz-flicker { 0%, 91%, 100% { opacity: 1; } 92% { opacity: 0.55; } 93% { opacity: 1; } 95% { opacity: 0.7; } 96% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .dz-overlay, .dz-panel, .dz-end, .dz-title { animation: none; }
  .dz-pop { animation-duration: 0.6s; }
}
`;

function injectStyle() {
  if (document.getElementById('dz-style')) return;
  const tag = document.createElement('style');
  tag.id = 'dz-style';
  tag.textContent = STYLE;
  document.head.appendChild(tag);
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function tint(color, alpha) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return color;
  const hex = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function drift(seed) {
  const table = Array.from({ length: 256 }, (_, i) => {
    const s = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  });
  return (t) => {
    const i = Math.floor(t);
    const f = t - i;
    const u = f * f * (3 - 2 * f);
    const a = table[((i % 256) + 256) % 256];
    const b = table[(((i + 1) % 256) + 256) % 256];
    return a + (b - a) * u;
  };
}

function rating(total) {
  if (total >= 200) return 'LEGENDARY ARM';
  if (total >= 140) return 'SHARPSHOOTER';
  if (total >= 90) return 'SOLID THROWS';
  if (total >= 45) return 'WARMING UP';
  return 'THE BARTENDER IS LAUGHING';
}

function callout(result) {
  if (result.points === 50) return { text: 'BULLSEYE!', kind: 'is-bull' };
  if (result.label === 'BULL') return { text: 'BULL 25!', kind: 'is-bull' };
  if (result.label.startsWith('TREBLE')) return { text: `${result.label}!`, kind: 'is-treble' };
  if (result.label.startsWith('DOUBLE')) return { text: `${result.label}!`, kind: 'is-double' };
  if (result.points === 0) return { text: 'MISS', kind: 'is-miss' };
  return { text: result.label, kind: 'is-single' };
}

export function openDarts({ root, lobbyName, onFinish, loadLeaderboard, onClose } = {}) {
  injectStyle();
  const host = root || document.body;
  const css = getComputedStyle(document.documentElement);
  const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const colors = {
    pink: token('--nd-pink', '#ff2e97'),
    cyan: token('--nd-cyan', '#00f0ff'),
    purple: token('--nd-purple', '#8a2be2'),
    orange: token('--nd-orange', '#ff9a3c'),
    yellow: token('--nd-yellow', '#ffe45e'),
    text: token('--nd-text', '#f6eaff'),
  };
  const uiFont = token('--nd-font-ui', "'Orbitron', system-ui, sans-serif");
  const place = lobbyName || 'the bar';
  const previousFocus = document.activeElement;

  const overlay = make('div', 'dz-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Neon Darts');
  const panel = make('div', 'dz-panel');

  const head = make('div', 'dz-head');
  const titles = make('div', 'dz-titles');
  titles.append(make('div', 'dz-title', 'NEON DARTS'), make('div', 'dz-sub', `${place} · ${DARTS} darts`));
  const closeButton = make('button', 'dz-close', '×');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close darts');
  head.append(titles, closeButton);

  const hud = make('div', 'dz-hud');
  const scoreBox = make('div');
  const totalEl = make('div', 'dz-total', '0');
  scoreBox.append(make('div', 'dz-label', 'Score'), totalEl);
  const pipsBox = make('div', 'dz-pipsbox');
  const pips = make('div', 'dz-pips');
  const pipEls = Array.from({ length: DARTS }, () => make('span', 'dz-pip'));
  pips.append(...pipEls);
  const lastEl = make('div', 'dz-last', 'Ready');
  pipsBox.append(pips, lastEl);
  const staminaBar = make('div', 'dz-stamina');
  staminaBar.setAttribute('aria-hidden', 'true');
  const staminaFill = make('i');
  staminaBar.append(staminaFill);
  hud.append(scoreBox, pipsBox, staminaBar);

  const stage = make('div', 'dz-stage');
  const wrap = make('div', 'dz-wrap');
  const canvas = make('canvas', 'dz-canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Dartboard. Hold to steady your aim, release to throw.');
  const pops = make('div', 'dz-pops');
  wrap.append(canvas, pops);
  stage.append(wrap);

  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const help = make(
    'div',
    'dz-help',
    coarse ? 'Touch to aim · hold to steady · let go to throw' : 'Aim with the mouse · hold to steady · release to throw · Space works too',
  );
  const live = make('div', 'dz-sr');
  live.setAttribute('aria-live', 'polite');

  const end = make('div', 'dz-end');
  end.hidden = true;
  const finalEl = make('div', 'dz-final', '0');
  const ratingEl = make('div', 'dz-rating');
  const noteEl = make('div', 'dz-note');
  const leader = make('div', 'dz-leader');
  const ranks = make('ol', 'dz-ranks');
  leader.append(make('div', 'dz-leader-title', `Top arms · ${place}`), ranks);
  const actions = make('div', 'dz-actions');
  const againButton = make('button', 'dz-btn', 'Play again');
  againButton.type = 'button';
  const doneButton = make('button', 'dz-btn dz-ghost', 'Back to the bar');
  doneButton.type = 'button';
  actions.append(againButton, doneButton);
  end.append(make('div', 'dz-label', 'Final score'), finalEl, ratingEl, noteEl, leader, actions);

  panel.append(head, hud, stage, help, live, end);
  overlay.append(panel);
  host.append(overlay);

  const ctx = canvas.getContext('2d');
  const board = document.createElement('canvas');
  const wobbleX = drift(3.1);
  const wobbleY = drift(8.7);
  const offset = Math.random() * 100;

  let size = 0;
  let radius = 0;
  let dpr = 1;
  let aim = null;
  let holding = false;
  let stamina = 1;
  let amp = 0.15;
  let phase = 'aim';
  let total = 0;
  let thrown = 0;
  let darts = [];
  let flashes = [];
  let flight = null;
  let clock = 0;
  let last = performance.now();
  let raf = 0;
  let readyAt = 0;
  let shake = 0;
  let closed = false;
  let round = 0;
  let endTimer = 0;

  function sector(g, c, r0, r1, a0, a1) {
    g.beginPath();
    g.arc(c, c, r1, a0, a1);
    g.arc(c, c, r0, a1, a0, true);
    g.closePath();
  }

  function renderBoard() {
    board.width = Math.round(size * dpr);
    board.height = Math.round(size * dpr);
    const g = board.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const c = size / 2;
    const R = radius;

    const halo = g.createRadialGradient(c, c, R * 0.5, c, c, c);
    halo.addColorStop(0, tint(colors.purple, 0.32));
    halo.addColorStop(1, tint(colors.purple, 0));
    g.fillStyle = halo;
    g.fillRect(0, 0, size, size);

    g.beginPath();
    g.arc(c, c, R * 1.24, 0, TAU);
    g.fillStyle = '#06010e';
    g.fill();

    for (let i = 0; i < 20; i++) {
      const a0 = -Math.PI / 2 + (i - 0.5) * SEGMENT;
      const a1 = a0 + SEGMENT;
      const even = i % 2 === 0;
      g.fillStyle = even ? '#12062a' : '#23104a';
      sector(g, c, R * OUTER_BULL, R * TREBLE_IN, a0, a1);
      g.fill();
      sector(g, c, R * TREBLE_OUT, R * DOUBLE_IN, a0, a1);
      g.fill();
      g.fillStyle = tint(even ? colors.pink : colors.cyan, 0.88);
      sector(g, c, R * TREBLE_IN, R * TREBLE_OUT, a0, a1);
      g.fill();
      sector(g, c, R * DOUBLE_IN, R, a0, a1);
      g.fill();
    }

    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 20; i++) {
      const a0 = -Math.PI / 2 + (i - 0.5) * SEGMENT;
      const a1 = a0 + SEGMENT;
      const glow = i % 2 === 0 ? colors.pink : colors.cyan;
      g.shadowColor = glow;
      g.shadowBlur = 14;
      g.fillStyle = tint(glow, 0.22);
      sector(g, c, R * TREBLE_IN, R * TREBLE_OUT, a0, a1);
      g.fill();
      sector(g, c, R * DOUBLE_IN, R, a0, a1);
      g.fill();
    }
    g.restore();

    g.save();
    g.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    g.lineWidth = 1;
    g.shadowColor = colors.purple;
    g.shadowBlur = 6;
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 + (i - 0.5) * SEGMENT;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * R * OUTER_BULL, c + Math.sin(a) * R * OUTER_BULL);
      g.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
      g.stroke();
    }
    [OUTER_BULL, TREBLE_IN, TREBLE_OUT, DOUBLE_IN, 1].forEach((k) => {
      g.beginPath();
      g.arc(c, c, R * k, 0, TAU);
      g.stroke();
    });
    g.restore();

    g.save();
    g.shadowBlur = 18;
    g.shadowColor = colors.cyan;
    g.fillStyle = tint(colors.cyan, 0.92);
    g.beginPath();
    g.arc(c, c, R * OUTER_BULL, 0, TAU);
    g.fill();
    g.shadowColor = colors.pink;
    g.fillStyle = colors.pink;
    g.beginPath();
    g.arc(c, c, R * BULL, 0, TAU);
    g.fill();
    g.restore();

    g.save();
    g.lineWidth = 2.5;
    g.strokeStyle = colors.cyan;
    g.shadowColor = colors.cyan;
    g.shadowBlur = 16;
    g.beginPath();
    g.arc(c, c, R * 1.24, 0, TAU);
    g.stroke();
    g.restore();

    g.save();
    g.font = `700 ${Math.max(10, Math.round(R * 0.105))}px ${uiFont}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = colors.text;
    g.shadowColor = colors.pink;
    g.shadowBlur = 8;
    ORDER.forEach((n, i) => {
      const a = -Math.PI / 2 + i * SEGMENT;
      g.fillText(String(n), c + Math.cos(a) * R * 1.12, c + Math.sin(a) * R * 1.12);
    });
    g.restore();
  }

  function resize() {
    if (closed) return;
    const reserved = panel.scrollHeight - wrap.offsetHeight + 34;
    const room = Math.min(stage.clientWidth, window.innerHeight - reserved);
    const next = Math.max(180, Math.min(640, Math.floor(room)));
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    if (next === size && ratio === dpr) return;
    size = next;
    dpr = ratio;
    radius = size * 0.4;
    wrap.style.width = `${size}px`;
    wrap.style.height = `${size}px`;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    aim = null;
    renderBoard();
  }

  function reticle() {
    const c = size / 2;
    const base = aim || { x: c, y: c };
    const t = clock + offset;
    const ox = Math.sin(t * 1.7) * 0.55 + Math.sin(t * 2.9 + 1.3) * 0.3 + wobbleX(t * 1.2) * 0.45;
    const oy = Math.sin(t * 2.3 + 0.7) * 0.55 + Math.sin(t * 1.3 + 2.1) * 0.3 + wobbleY(t * 1.2) * 0.45;
    return { x: base.x + ox * amp * radius, y: base.y + oy * amp * radius };
  }

  function flashColor(kind) {
    if (kind === 'is-bull') return colors.yellow;
    if (kind === 'is-treble') return colors.pink;
    if (kind === 'is-double') return colors.cyan;
    if (kind === 'is-miss') return 'rgba(246, 234, 255, 0.35)';
    return colors.text;
  }

  function syncHud() {
    totalEl.textContent = String(total);
    pipEls.forEach((pip, i) => pip.classList.toggle('is-used', i < thrown));
  }

  function bumpTotal() {
    totalEl.classList.remove('dz-bump');
    void totalEl.offsetWidth;
    totalEl.classList.add('dz-bump');
  }

  function popup(call, result, point) {
    const pop = make('div', `dz-pop ${call.kind}`);
    pop.style.left = `${point.x}px`;
    pop.style.top = `${point.y}px`;
    pop.append(make('b', '', call.text));
    if (result.points) pop.append(make('span', '', `+${result.points}`));
    pops.append(pop);
    setTimeout(() => pop.remove(), 1200);
  }

  function beginHold() {
    if (phase !== 'aim' || holding || performance.now() < readyAt) return;
    holding = true;
  }

  function release() {
    if (!holding) return;
    holding = false;
    if (phase === 'aim') throwDart();
  }

  function throwDart() {
    phase = 'flight';
    flight = {
      from: { x: size * 0.86, y: size * 1.08 },
      to: reticle(),
      start: clock,
      duration: 0.3,
      color: thrown % 2 ? colors.cyan : colors.pink,
    };
    lastEl.textContent = 'Incoming…';
  }

  function land() {
    const c = size / 2;
    const { to, color } = flight;
    flight = null;
    const result = scoreAt(to.x - c, to.y - c, radius);
    const call = callout(result);
    darts.push({ nx: (to.x - c) / radius, ny: (to.y - c) / radius, color });
    flashes.push({ x: to.x, y: to.y, start: clock, color: flashColor(call.kind), big: call.kind === 'is-bull' || call.kind === 'is-treble' });
    total += result.points;
    thrown += 1;
    if (result.points >= 50) shake = 0.35;
    popup(call, result, to);
    bumpTotal();
    syncHud();
    lastEl.textContent = result.points ? `${call.text} +${result.points}` : call.text;
    live.textContent = `${result.label}, ${result.points} points. Total ${total}.`;
    if (thrown >= DARTS) {
      phase = 'done';
      endTimer = setTimeout(showEnd, 900);
    } else {
      phase = 'aim';
      readyAt = performance.now() + 350;
    }
  }

  function update(dt) {
    clock += dt;
    if (holding) stamina = Math.max(0, stamina - dt / 2.4);
    else stamina = Math.min(1, stamina + dt / 1.4);
    const target = holding ? (stamina > 0 ? 0.03 + (1 - stamina) * 0.025 : 0.34) : 0.15;
    amp += (target - amp) * (1 - Math.exp(-dt * (holding ? 5 : 2.5)));
    shake = Math.max(0, shake - dt);
    flashes = flashes.filter((f) => clock - f.start < 0.7);
    if (flight && clock - flight.start >= flight.duration) land();
    staminaFill.style.transform = `scaleX(${stamina.toFixed(3)})`;
    staminaBar.classList.toggle('is-low', holding && stamina < 0.3);
  }

  function drawDart(x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(-0.5);
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#dfe6ff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 7);
    ctx.stroke();
    const barrel = ctx.createLinearGradient(-2.5, 0, 2.5, 0);
    barrel.addColorStop(0, '#7f81a8');
    barrel.addColorStop(0.5, '#ffffff');
    barrel.addColorStop(1, '#5f6188');
    ctx.fillStyle = barrel;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-2.4, 6, 4.8, 9, 2);
    else ctx.rect(-2.4, 6, 4.8, 9);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.lineTo(0, 24);
    ctx.stroke();
    ctx.fillStyle = tint(color, 0.88);
    ctx.beginPath();
    ctx.moveTo(0, 17.5);
    ctx.lineTo(-6.5, 28.5);
    ctx.lineTo(0, 25.5);
    ctx.lineTo(6.5, 28.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 1.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawReticle() {
    const p = reticle();
    const ready = performance.now() >= readyAt;
    const color = !ready ? tint(colors.text, 0.35) : holding && stamina < 0.3 ? colors.yellow : colors.cyan;
    const r = 8 + amp * radius * 0.5;
    ctx.save();
    if (aim) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(aim.x - 5, aim.y);
      ctx.lineTo(aim.x + 5, aim.y);
      ctx.moveTo(aim.x, aim.y - 5);
      ctx.lineTo(aim.x, aim.y + 5);
      ctx.stroke();
    }
    ctx.globalAlpha = holding ? 1 : 0.85;
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      ctx.moveTo(p.x + dx * (r - 3), p.y + dy * (r - 3));
      ctx.lineTo(p.x + dx * (r + 7), p.y + dy * (r + 7));
    });
    ctx.stroke();
    ctx.fillStyle = colors.pink;
    ctx.shadowColor = colors.pink;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    if (!size) return;
    const c = size / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 22, (Math.random() - 0.5) * shake * 22);
    ctx.drawImage(board, 0, 0, size, size);
    const pulse = ctx.createRadialGradient(c, c, radius * 0.96, c, c, radius * 1.32);
    const strength = 0.12 + 0.07 * Math.sin(clock * 2.2);
    pulse.addColorStop(0, tint(colors.pink, 0));
    pulse.addColorStop(0.45, tint(colors.pink, strength));
    pulse.addColorStop(1, tint(colors.pink, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = pulse;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
    const scale = Math.max(0.85, radius / 150);
    darts.forEach((d) => drawDart(c + d.nx * radius, c + d.ny * radius, scale, d.color));
    flashes.forEach((f) => {
      const k = (clock - f.start) / 0.7;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.strokeStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 16;
      ctx.lineWidth = f.big ? 3 : 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4 + k * (f.big ? 70 : 34), 0, TAU);
      ctx.stroke();
      if (k < 0.25) {
        ctx.globalAlpha = (0.25 - k) * 3;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 10 + k * 30, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    });
    if (flight) {
      const p = Math.min(1, (clock - flight.start) / flight.duration);
      const e = 1 - Math.pow(1 - p, 3);
      const x = flight.from.x + (flight.to.x - flight.from.x) * e;
      const y = flight.from.y + (flight.to.y - flight.from.y) * e - Math.sin(Math.PI * p) * size * 0.08;
      drawDart(x, y, scale * (2.6 - 1.6 * e), flight.color);
    }
    ctx.restore();
    if (phase === 'aim') drawReticle();
  }

  function renderRanks(rows) {
    const list = Array.isArray(rows) ? rows.slice(0, 10) : [];
    if (!list.length) {
      ranks.replaceChildren(make('li', 'dz-empty', 'No scores yet. Be the first legend.'));
      return;
    }
    ranks.replaceChildren(
      ...list.map((row, i) => {
        const item = make('li');
        item.append(make('span', 'dz-rank', String(i + 1)), make('span', 'dz-handle', `@${row && row.handle != null ? row.handle : '???'}`), make('span', 'dz-points', String(row && row.score != null ? row.score : 0)));
        return item;
      }),
    );
  }

  function showEnd() {
    if (closed) return;
    const thisRound = round;
    const score = total;
    finalEl.textContent = String(score);
    ratingEl.textContent = rating(score);
    noteEl.textContent = '';
    ranks.replaceChildren(make('li', 'dz-empty', 'Loading leaderboard…'));
    end.hidden = false;
    againButton.focus({ preventScroll: true });
    Promise.resolve()
      .then(() => (onFinish ? onFinish(score) : undefined))
      .catch((err) => {
        console.error(err);
        if (round === thisRound) noteEl.textContent = 'Your score could not be saved.';
      })
      .then(() => (loadLeaderboard ? loadLeaderboard() : []))
      .then((rows) => {
        if (!closed && round === thisRound) renderRanks(rows);
      })
      .catch((err) => {
        console.error(err);
        if (!closed && round === thisRound) ranks.replaceChildren(make('li', 'dz-empty', 'Leaderboard unavailable right now.'));
      });
  }

  function restart() {
    clearTimeout(endTimer);
    round += 1;
    total = 0;
    thrown = 0;
    darts = [];
    flashes = [];
    flight = null;
    phase = 'aim';
    holding = false;
    stamina = 1;
    amp = 0.15;
    readyAt = performance.now() + 250;
    pops.replaceChildren();
    end.hidden = true;
    lastEl.textContent = 'Ready';
    syncHud();
    canvas.focus({ preventScroll: true });
  }

  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * size,
      y: ((event.clientY - rect.top) / rect.height) * size,
    };
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      if (event.type === 'keydown') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      return;
    }
    if (event.code !== 'Space' && event.key !== ' ') return;
    const tag = event.target && event.target.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    event.preventDefault();
    if (event.type === 'keydown') {
      if (!event.repeat) beginHold();
    } else {
      release();
    }
  }

  function frame(now) {
    if (closed) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;

  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    clearTimeout(endTimer);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKey, true);
    window.removeEventListener('resize', resize);
    if (observer) observer.disconnect();
    overlay.remove();
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
    if (onClose) {
      try {
        onClose();
      } catch (err) {
        console.error(err);
      }
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {}
    aim = pointFrom(event);
    beginHold();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' || holding) aim = pointFrom(event);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'mouse' && holding) aim = pointFrom(event);
    release();
  });
  canvas.addEventListener('pointercancel', () => {
    holding = false;
  });
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !holding) aim = null;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  closeButton.addEventListener('click', close);
  doneButton.addEventListener('click', close);
  againButton.addEventListener('click', restart);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);
  window.addEventListener('resize', resize);
  if (observer) observer.observe(stage);

  resize();
  syncHud();
  if (document.fonts && typeof document.fonts.load === 'function') {
    document.fonts
      .load(`700 20px ${uiFont}`)
      .then(() => {
        if (!closed) renderBoard();
      })
      .catch(() => {});
  }
  canvas.focus({ preventScroll: true });
  raf = requestAnimationFrame(frame);

  return { close };
}
