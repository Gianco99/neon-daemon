import { W, H, FLOOR_TOP, FLOOR_BOTTOM, DESKS, STOOLS, LOUNGE, OVERFLOW_DESK, HOTSPOTS, SIGNS, drawStatic, drawAnimated, drawLights, makeProps } from "./bar.js";
import { drawDaemon, drawDrone, drawAura } from "./sprites.js";
import { h } from "../lib/dom.js";
import { clamp, hashString, fmtClock } from "../lib/util.js";
import { normalizeLook, activeBuff } from "../looks.js";
import config from "../../config.js";

const EMOJI = { wave: "👋", dance: "🕺", cheer: "🍻", heart: "💖", laugh: "😂", drink: "🍹", fire: "🔥" };
const EMOTE_ACTION = { wave: "wave", dance: "dance", cheer: "cheer", drink: "sip" };
const STATE_TEXT = { working: "working", waiting: "needs you", idle: "chilling", offline: "offline" };

function auraColor(buff, t) {
  if (buff.effect === "sugar") return `hsla(${Math.floor(t * 140) % 360},100%,62%,ALPHA)`;
  let n = parseInt(buff.color.slice(1), 16);
  if (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 110) n = parseInt(buff.garnish.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},ALPHA)`;
}

export function clampToFloor(x, y) {
  let cx = clamp(x, 10, W - 10);
  let cy = clamp(y, FLOOR_TOP + 4, FLOOR_BOTTOM);
  if (cx > 328 && cy < 186) cy = 188;
  return [Math.round(cx), Math.round(cy)];
}

export class Stage {
  constructor(container, opts = {}) {
    this.opts = opts;
    this.container = container;
    this.root = h("div", { class: "stage" });
    this.canvas = h("canvas", { width: W, height: H, role: "img", "aria-label": "The bar. Click the floor to walk, or click the dartboard, jukebox or bet booth." });
    this.overlay = h("div", { class: "overlay" });
    this.hover = h("div", { class: "ov tag hidden" });
    this.overlay.append(this.hover);
    this.root.append(this.canvas, this.overlay, h("div", { class: "crt" }));
    container.append(this.root);

    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.staticLayer = document.createElement("canvas");
    this.staticLayer.width = W;
    this.staticLayer.height = H;
    drawStatic(this.staticLayer.getContext("2d"));

    this.props = makeProps();
    this.entities = new Map();
    this.state = { music: false, betting: false, desks: [false, false, false, false], rain: false };
    this.deskOf = new Map();
    this.stoolOf = new Map();
    this.t = 0;
    this.scale = 1;
    this.signs = SIGNS.map((s) => this.makeSign(s));

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerleave", () => this.hover.classList.add("hidden"));

    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(container);
    this.fit();

    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  makeSign(s) {
    let el;
    if (s.kind === "logo") {
      const [first, ...rest] = config.appName.split(" ");
      el = h("div", { class: "ov sign-text logo flicker" }, h("span", { class: "script" }, first), " ", h("span", { class: "block" }, rest.join(" ")));
    } else {
      const script = s.color === "pink";
      el = h("div", { class: `ov sign-text ${script ? "logo" : "small"} ${s.text === "OPEN" ? "flicker" : ""}` }, script ? h("span", { class: "script" }, s.text.charAt(0) + s.text.slice(1).toLowerCase()) : s.text);
      if (!script) {
        el.style.color = "#e2fdff";
        el.style.textShadow = "0 0 2px #fff, 0 0 6px #00f0ff, 0 0 14px #00f0ff";
      }
    }
    this.overlay.append(el);
    return { ...s, el };
  }

  fit() {
    const r = this.container.getBoundingClientRect();
    if (!r.width || !r.height) return;
    let w = r.width;
    let hh = (w * 9) / 16;
    if (hh > r.height) {
      hh = r.height;
      w = (hh * 16) / 9;
    }
    this.root.style.width = `${Math.floor(w)}px`;
    this.root.style.height = `${Math.floor(hh)}px`;
    this.scale = Math.floor(w) / W;
    this.root.style.setProperty("--s", this.scale.toFixed(3));
    for (const s of this.signs) {
      const sc = this.scale;
      s.el.style.transform = `translate(${s.x * sc}px, ${s.y * sc}px) translate(-50%, -50%)`;
      if (s.kind === "logo") {
        s.el.querySelector(".script").style.fontSize = `${23 * sc}px`;
        s.el.querySelector(".block").style.fontSize = `${14 * sc}px`;
      } else if (s.color === "pink") {
        s.el.querySelector(".script").style.fontSize = `${15 * sc * s.size}px`;
      } else {
        s.el.style.fontSize = `${7 * sc * s.size}px`;
      }
    }
    for (const e of this.entities.values()) e.lastTransform = "";
  }

  get me() {
    return this.entities.get(this.opts.meId);
  }

  setPeers(peers) {
    const seen = new Set();
    for (const p of peers) {
      seen.add(p.id);
      let e = this.entities.get(p.id);
      const look = normalizeLook(p.look, p.id);
      if (!e) {
        const [sx, sy] = Number.isFinite(p.x) && Number.isFinite(p.y) ? clampToFloor(p.x, p.y) : [240, FLOOR_BOTTOM];
        e = {
          id: p.id, kind: "avatar", x: sx, y: sy, tx: sx, ty: sy, facing: 1, look, handle: p.handle,
          me: p.id === this.opts.meId, seed: (hashString(p.id) % 1000) / 100,
          tagEl: h("div", { class: `ov tag${p.id === this.opts.meId ? " me" : ""}` }, p.handle),
          bubbleEl: null, emote: null, emoteUntil: 0, lastTransform: "",
          buffInfo: { buff: p.buff, buff_until: p.buffUntil }, tagText: p.handle,
        };
        this.overlay.append(e.tagEl);
        this.entities.set(p.id, e);
        if (!Number.isFinite(p.x)) {
          const spot = LOUNGE[hashString(p.id) % LOUNGE.length];
          e.tx = spot.x;
          e.ty = spot.y;
        }
      } else {
        e.look = look;
        e.buffInfo = { buff: p.buff, buff_until: p.buffUntil };
        e.handle = p.handle;
      }
    }
    for (const [id, e] of this.entities) {
      if (e.kind === "avatar" && !seen.has(id)) this.removeEntity(id);
    }
    this.assignSlots();
  }

  removeEntity(id) {
    const e = this.entities.get(id);
    if (!e) return;
    e.tagEl?.remove();
    e.bubbleEl?.remove();
    e.alertEl?.remove();
    this.entities.delete(id);
    if (e.kind === "avatar") {
      for (const [did, d] of this.entities) if (d.kind === "drone" && d.ownerId === id) this.removeEntity(did);
    }
    this.deskOf.delete(id);
    this.stoolOf.delete(id);
  }

  moveEntity(id, x, y) {
    const e = this.entities.get(id);
    if (!e || e.me) return;
    [e.tx, e.ty] = clampToFloor(x, y);
  }

  walkMe(x, y, onArrive) {
    const me = this.me;
    if (!me) return null;
    [me.tx, me.ty] = clampToFloor(x, y);
    me.onArrive = onArrive || null;
    this.opts.onMove?.(me.tx, me.ty);
    return [me.tx, me.ty];
  }

  setAgents(agents) {
    const seen = new Set();
    for (const a of agents) {
      const owner = this.entities.get(a.ownerId);
      if (!owner || a.state === "offline") continue;
      const id = `${a.ownerId}:${a.session_key}`;
      seen.add(id);
      let d = this.entities.get(id);
      if (!d) {
        d = {
          id, kind: "drone", ownerId: a.ownerId, sessionKey: a.session_key, x: owner.x + 8, y: owner.y, tx: owner.x + 8, ty: owner.y,
          facing: 1, seed: (hashString(id) % 1000) / 100, look: owner.look, state: a.state, label: a.label || "",
          turnStartedAt: a.turn_started_at, tagEl: h("div", { class: "ov tag drone hidden" }), alertEl: h("div", { class: "ov alert-bubble hidden" }, "!"),
          lastTransform: "",
        };
        this.overlay.append(d.tagEl, d.alertEl);
        this.entities.set(id, d);
      }
      const changed = d.state !== a.state;
      d.state = a.state;
      d.label = a.label || "";
      d.look = owner.look;
      d.turnStartedAt = a.turn_started_at;
      d.tagEl.className = `ov tag drone ${d.state}${d.label ? "" : " hidden"}`;
      d.tagEl.textContent = d.label;
      d.alertEl.classList.toggle("hidden", d.state !== "waiting");
      if (changed && d.state === "waiting" && owner.me) this.opts.onMyAgentWaiting?.(d);
    }
    for (const [id, e] of this.entities) {
      if (e.kind === "drone" && !seen.has(id)) this.removeEntity(id);
    }
    this.assignSlots();
  }

  assignSlots() {
    const drones = [...this.entities.values()].filter((e) => e.kind === "drone").sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const [id, slot] of this.deskOf) {
      const d = this.entities.get(id);
      if (!d || d.state !== "working") this.deskOf.delete(id);
      else if (slot == null) this.deskOf.delete(id);
    }
    for (const [id] of this.stoolOf) {
      const d = this.entities.get(id);
      if (!d || d.state !== "idle") this.stoolOf.delete(id);
    }
    const usedDesks = new Set(this.deskOf.values());
    const usedStools = new Set(this.stoolOf.values());
    let overflow = 0;
    let lounge = 0;
    const waitingByOwner = new Map();
    for (const d of drones) {
      if (d.state === "working") {
        if (!this.deskOf.has(d.id)) {
          const free = DESKS.findIndex((_, i) => !usedDesks.has(i));
          if (free >= 0) {
            this.deskOf.set(d.id, free);
            usedDesks.add(free);
          }
        }
        const slot = this.deskOf.get(d.id);
        if (slot != null) {
          d.tx = DESKS[slot].x;
          d.ty = DESKS[slot].y + 9;
          d.atDesk = true;
        } else {
          const p = OVERFLOW_DESK[overflow++ % OVERFLOW_DESK.length];
          d.tx = p.x;
          d.ty = p.y;
          d.atDesk = false;
        }
      } else if (d.state === "idle") {
        d.atDesk = false;
        if (!this.stoolOf.has(d.id)) {
          const free = STOOLS.findIndex((_, i) => !usedStools.has(i));
          if (free >= 0) {
            this.stoolOf.set(d.id, free);
            usedStools.add(free);
          }
        }
        const slot = this.stoolOf.get(d.id);
        const p = slot != null ? { x: STOOLS[slot].x, y: STOOLS[slot].y + 1 } : LOUNGE[(lounge++ + 3) % LOUNGE.length];
        d.tx = p.x;
        d.ty = p.y;
      } else if (d.state === "waiting") {
        d.atDesk = false;
        const n = waitingByOwner.get(d.ownerId) || 0;
        waitingByOwner.set(d.ownerId, n + 1);
        d.side = n % 2 === 0 ? -13 - n * 4 : 13 + n * 4;
      }
    }
    this.state.desks = DESKS.map((_, i) => [...this.deskOf.entries()].some(([id, slot]) => {
      const d = this.entities.get(id);
      return slot === i && d && Math.abs(d.x - d.tx) < 2 && Math.abs(d.y - d.ty) < 2;
    }));
  }

  say(id, text) {
    const e = this.entities.get(id);
    if (!e || e.kind !== "avatar") return;
    e.bubbleEl?.remove();
    e.bubbleEl = h("div", { class: "ov bubble" }, text.length > 120 ? `${text.slice(0, 117)}...` : text);
    e.lastTransform = "";
    this.overlay.append(e.bubbleEl);
    const el = e.bubbleEl;
    setTimeout(() => {
      if (e.bubbleEl === el) {
        el.remove();
        e.bubbleEl = null;
      }
    }, Math.min(9000, 3500 + text.length * 60));
  }

  emote(id, kind) {
    const e = this.entities.get(id);
    if (!e) return;
    if (EMOTE_ACTION[kind] && e.kind === "avatar") {
      e.emote = EMOTE_ACTION[kind];
      e.emoteUntil = this.t + (kind === "dance" ? 4 : 2.4);
    }
    const sc = this.scale;
    const el = h("div", { class: "ov emote-float" }, EMOJI[kind] || "✨");
    el.style.transform = `translate(${(e.x + (Math.random() * 8 - 4)) * sc}px, ${(e.y - 30) * sc}px) translate(-50%, -100%)`;
    this.overlay.append(el);
    setTimeout(() => el.remove(), 1900);
  }

  setMusic(on) {
    this.state.music = !!on;
  }

  setBetting(on) {
    this.state.betting = !!on;
  }

  setRain(on) {
    this.state.rain = !!on;
  }

  worldPoint(ev) {
    const rect = this.canvas.getBoundingClientRect();
    return [((ev.clientX - rect.left) / rect.width) * W, ((ev.clientY - rect.top) / rect.height) * H];
  }

  hitTest(wx, wy) {
    const ents = [...this.entities.values()].sort((a, b) => b.y - a.y);
    for (const e of ents) {
      if (e.kind === "avatar" && Math.abs(wx - e.x) <= 7 && wy <= e.y + 1 && wy >= e.y - 28) return { entity: e };
      if (e.kind === "drone" && Math.abs(wx - e.x) <= 7 && wy <= e.y && wy >= e.y - 22) return { entity: e };
    }
    for (const hs of HOTSPOTS) {
      const [x, y, w, hh] = hs.rect;
      if (wx >= x && wx <= x + w && wy >= y && wy <= y + hh) return { hotspot: hs };
    }
    return null;
  }

  onPointerDown(ev) {
    const [wx, wy] = this.worldPoint(ev);
    const hit = this.hitTest(wx, wy);
    if (hit?.entity) {
      if (hit.entity.kind === "avatar") this.opts.onAvatarClick?.(hit.entity);
      else this.opts.onDroneClick?.(hit.entity);
      return;
    }
    if (hit?.hotspot) {
      const hs = hit.hotspot;
      const target = hs.approach ?? [clamp(wx, 346, 468), 190];
      this.walkMe(target[0], target[1], () => this.opts.onHotspot?.(hs.name));
      return;
    }
    this.walkMe(wx, wy < FLOOR_TOP ? FLOOR_TOP + 8 : wy);
  }

  onPointerMove(ev) {
    const [wx, wy] = this.worldPoint(ev);
    const hit = this.hitTest(wx, wy);
    let text = "";
    let x = wx;
    let y = wy - 6;
    if (hit?.entity?.kind === "avatar") {
      text = hit.entity.me ? "that's you" : `@${hit.entity.handle}`;
      x = hit.entity.x;
      y = hit.entity.y - 34;
    } else if (hit?.entity?.kind === "drone") {
      const d = hit.entity;
      const owner = this.entities.get(d.ownerId);
      const since = d.turnStartedAt && d.state !== "idle" ? ` ${fmtClock((Date.now() - new Date(d.turnStartedAt).getTime()) / 1000)}` : "";
      text = `${owner?.me ? "your" : `@${owner?.handle || "?"}'s`} agent · ${STATE_TEXT[d.state]}${since}`;
      x = d.x;
      y = d.y - 26;
    } else if (hit?.hotspot) {
      text = hit.hotspot.label;
    }
    this.canvas.style.cursor = hit ? "pointer" : "crosshair";
    if (!text) {
      this.hover.classList.add("hidden");
      return;
    }
    this.hover.textContent = text;
    this.hover.classList.remove("hidden");
    this.hover.style.transform = `translate(${x * this.scale}px, ${y * this.scale}px) translate(-50%, -100%)`;
  }

  update(dt) {
    for (const e of this.entities.values()) {
      if (e.kind === "drone" && e.state === "waiting") {
        const owner = this.entities.get(e.ownerId);
        if (owner) {
          e.tx = clamp(owner.x + (e.side || -13), 8, W - 8);
          e.ty = clamp(owner.y - 1, FLOOR_TOP, FLOOR_BOTTOM);
        }
      }
      const dx = e.tx - e.x;
      const dy = e.ty - e.y;
      const dist = Math.hypot(dx, dy);
      const wired = e.kind === "avatar" && activeBuff(e.buffInfo)?.effect === "wired";
      const speed = e.kind === "drone" ? (e.state === "waiting" ? 110 : 72) : wired ? 104 : 58;
      if (dist > 0.6) {
        const step = Math.min(dist, speed * dt);
        e.x += (dx / dist) * step;
        e.y += (dy / dist) * step;
        e.moving = true;
        if (Math.abs(dx) > 0.4) e.facing = dx > 0 ? 1 : -1;
      } else {
        e.x = e.tx;
        e.y = e.ty;
        if (e.moving && e.onArrive) {
          const fn = e.onArrive;
          e.onArrive = null;
          setTimeout(fn, 0);
        }
        e.moving = false;
        if (e.kind === "drone" && e.state === "waiting") {
          const owner = this.entities.get(e.ownerId);
          if (owner) e.facing = owner.x > e.x ? 1 : -1;
        }
      }
    }
    this.state.desks = DESKS.map((_, i) => [...this.deskOf.entries()].some(([id, slot]) => {
      const d = this.entities.get(id);
      return slot === i && d && !d.moving;
    }));
  }

  drawEntity(e) {
    const ctx = this.ctx;
    if (e.kind === "avatar") {
      const buff = activeBuff(e.buffInfo);
      const tagText = buff ? `${e.handle} ${buff.emoji}` : e.handle;
      if (e.tagText !== tagText) {
        e.tagText = tagText;
        e.tagEl.textContent = tagText;
      }
      let action = "idle";
      if (e.emote && this.t < e.emoteUntil) action = e.emote;
      else if (e.moving) action = "walk";
      else if (buff?.effect === "sugar" && Math.sin(this.t * 0.9 + e.seed) > 0.3) action = "dance";
      else if (buff || (e.x > 340 && e.y >= 184 && e.y <= 198)) action = "sip";
      let x = e.x;
      if (buff?.effect === "wired" && Math.random() < 0.35) x += Math.random() < 0.5 ? -1 : 1;
      if (buff) drawAura(ctx, e.x, e.y, auraColor(buff, this.t), this.t);
      drawDaemon(ctx, x, e.y, e.look, { t: this.t, action, facing: e.facing, seed: e.seed, music: this.state.music, drink: buff?.id });
    } else {
      const back = e.state === "working" && e.atDesk && !e.moving;
      const drink = e.state === "idle" && !e.moving;
      drawDrone(ctx, e.x, e.y, e.look, { t: this.t, state: e.state, facing: e.facing, seed: e.seed, back, drink });
    }
  }

  updateOverlay() {
    const sc = this.scale;
    for (const e of this.entities.values()) {
      const tagY = e.kind === "avatar" ? e.y - 30 : e.y - 22;
      const key = `${Math.round(e.x * sc)},${Math.round(tagY * sc)}`;
      if (key === e.lastTransform) continue;
      e.lastTransform = key;
      const tx = `translate(${e.x * sc}px, ${tagY * sc}px) translate(-50%, -100%)`;
      if (e.tagEl) e.tagEl.style.transform = tx;
      if (e.bubbleEl) e.bubbleEl.style.transform = `translate(${e.x * sc}px, ${(tagY - 6) * sc}px) translate(-50%, -100%)`;
      if (e.alertEl) e.alertEl.style.transform = `translate(${e.x * sc}px, ${(e.y - 18) * sc}px) translate(-50%, -100%)`;
    }
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - (this.last ?? now)) / 1000);
    this.last = now;
    this.t += dt;
    this.update(dt);
    const ctx = this.ctx;
    ctx.drawImage(this.staticLayer, 0, 0);
    drawAnimated(ctx, this.t, this.state);
    const list = [];
    for (const p of this.props) list.push({ y: p.y, p });
    for (const e of this.entities.values()) list.push({ y: e.y + 0.5, e });
    list.sort((a, b) => a.y - b.y);
    for (const item of list) {
      if (item.p) item.p.draw(ctx, this.t, this.state);
      else this.drawEntity(item.e);
    }
    drawLights(ctx, this.t, this.state);
    this.updateOverlay();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.root.remove();
    this.entities.clear();
  }
}
