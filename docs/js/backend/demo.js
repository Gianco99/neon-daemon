import { createEmitter, pick, BET_WINDOW_S, bucketFor } from "../lib/util.js";
import { randomString, randomHex, sha256Hex, normalizeCode, seal, unseal } from "../lib/crypto.js";
import { load, save } from "../lib/store.js";
import { normalizeLook } from "../looks.js";
import { LOUNGE, STOOLS } from "../scene/bar.js";

const NPCS = [
  { id: "npc-vic", handle: "vapor_vic", display_name: "Vic", status_text: "refactoring the universe", look: { body: "#f6f6ff", visor: "#120a2a", eyeColor: "#00f0ff", outfitColor: "#ff8fc7", eyes: "visor", hat: "fedora", outfit: "blazer", accessory: "shades", drink: "pina" } },
  { id: "npc-nina", handle: "neon_nina", display_name: "Nina", status_text: "tests or it didn't happen", look: { body: "#ff4fa3", visor: "#2a0f3a", eyeColor: "#ffe45e", outfitColor: "#111111", eyes: "hearts", hat: "headphones", outfit: "jacket", accessory: "chain", drink: "martini" } },
  { id: "npc-gus", handle: "glitch_gus", display_name: "Gus", status_text: "it works on my machine", look: { body: "#7dffc4", visor: "#082a26", eyeColor: "#ff2e97", outfitColor: "#8a2be2", eyes: "x", hat: "beanie", outfit: "hoodie", accessory: "none", drink: "soda" } },
  { id: "npc-pete", handle: "palm_pete", display_name: "Pete", status_text: "on a beach, mentally", look: { body: "#ff9a3c", visor: "#301018", eyeColor: "#7dffc4", outfitColor: "#3a86ff", eyes: "happy", hat: "cap", outfit: "hawaiian", accessory: "none", drink: "blue" } },
  { id: "npc-sol", handle: "solstice", display_name: "Sol", status_text: "pairing with three agents", look: { body: "#b892ff", visor: "#120a2a", eyeColor: "#ffffff", outfitColor: "#f6f6ff", eyes: "stars", hat: "halo", outfit: "suit", accessory: "bowtie", drink: "sake" } },
  { id: "npc-rio", handle: "rio_rewrite", display_name: "Rio", status_text: "rewriting it in rust", look: { body: "#39f3ff", visor: "#0d2140", eyeColor: "#ff9a3c", outfitColor: "#ff2e97", eyes: "dots", hat: "mohawk", outfit: "tank", accessory: "scarf", drink: "mojito" } },
];
const NPC_BY_ID = new Map(NPCS.map((n) => [n.id, n]));

const BUILTIN_LOBBIES = [
  { id: "demo-ocean", code: "VCE247", name: "Ocean Drive Lounge", is_private: false, owner_id: "npc-vic", npcs: ["npc-vic", "npc-nina", "npc-sol"], created_at: "2026-11-01T20:00:00Z" },
  { id: "demo-grid", code: "GRD888", name: "The Grid", is_private: false, owner_id: "npc-gus", npcs: ["npc-gus", "npc-pete", "npc-rio"], created_at: "2026-11-02T20:00:00Z" },
  { id: "demo-static", code: "STC999", name: "Static Club", is_private: false, owner_id: "npc-rio", npcs: ["npc-rio"], created_at: "2026-11-03T08:00:00Z" },
];

const LABELS = ["auth refactor", "flaky tests", "api docs", "css crimes", "db migration", "perf pass", "bug #1337", "release notes", "dark mode", "rate limiter"];

const LINES = {
  general: [
    "anyone else's agent writing poetry in the commit messages?",
    "ok who put the synthwave on",
    "my agent just asked to delete node_modules. respect.",
    "one more drink and then I review that PR",
    "the sunset in here never ends and I'm fine with that",
    "the bartender bot makes a mean martini",
    "context window: full. glass: also full.",
    "running three agents at once is basically conducting an orchestra",
    "if the tests pass on the first try I'm buying a round",
    "who's up for darts",
    "my agent fixed a bug I wrote in 2019. humbling.",
    "the bet booth owes me 200 chips",
  ],
  done: ["agent shipped it 🚀", "job done. back to the bar.", "green checks across the board", "done, and it even wrote the tests", "merged. drinks on me."],
  waiting: ["brb my agent needs a permission", "hold up, my agent is waving at me", "approving a command, one sec"],
  replies: ["real", "lol yes", "say less", "that's the dream", "big if true", "cheers to that 🍹", "ask your agent, it knows", "100%"],
  greet: ["yo {name}!", "welcome to the bar {name}", "{name} in the house", "hey {name}, grab a stool"],
};

const sim = createEmitter();
const agents = new Map();

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function planTurn(fast) {
  const roll = Math.random();
  const duration = fast ? rand(25, 95) : roll < 0.3 ? rand(22, 56) : roll < 0.78 ? rand(65, 220) : rand(305, 380);
  const ask = Math.random() < (fast ? 0.45 : 0.35);
  return { duration, permAt: ask ? duration * rand(0.25, 0.65) : null, permLen: rand(6, 14) };
}

function startTurn(a, now, ago = 0) {
  a.turn_no += 1;
  a.turn_started_at = new Date(now - ago * 1000).toISOString();
  a.asked_permission = false;
  a.plan = planTurn(a.fast);
  a.state = "working";
  a.label = a.fast ? a.label : pick(LABELS);
  a.updated_at = new Date(now).toISOString();
  sim.emit("turn", { ownerId: a.ownerId, session_key: a.session_key, turn_no: a.turn_no });
}

function makeAgent(ownerId, { fast = false, start = "idle", ago = 0, label = "" } = {}) {
  const now = Date.now();
  const a = {
    ownerId, session_key: randomString(16), state: "idle", label, tool: null, turn_no: 0, turn_started_at: null,
    asked_permission: false, updated_at: new Date(now).toISOString(), fast, plan: null, nextAt: now + rand(5, 20) * 1000,
  };
  if (start === "working") startTurn(a, now, ago);
  agents.set(`${ownerId}:${a.session_key}`, a);
  return a;
}

function tickAgent(a, now) {
  if (a.state === "idle") {
    if (now >= a.nextAt) startTurn(a, now);
    return;
  }
  const elapsed = (now - new Date(a.turn_started_at).getTime()) / 1000;
  const p = a.plan;
  const permEnd = p.permAt != null ? p.permAt + p.permLen : null;
  const end = p.duration + (permEnd != null ? p.permLen : 0);
  if (p.permAt != null && elapsed >= p.permAt && elapsed < permEnd) {
    if (a.state !== "waiting") {
      a.state = "waiting";
      a.asked_permission = true;
      a.updated_at = new Date(now).toISOString();
      sim.emit("waiting", a);
    }
    return;
  }
  if (a.state === "waiting") {
    a.state = "working";
    a.updated_at = new Date(now).toISOString();
  }
  if (elapsed >= end) {
    a.state = "idle";
    a.updated_at = new Date(now).toISOString();
    a.nextAt = now + (a.fast ? rand(18, 40) : rand(15, 70)) * 1000;
    sim.emit("turnEnd", { ownerId: a.ownerId, session_key: a.session_key, turn_no: a.turn_no, duration: elapsed, asked: a.asked_permission });
  }
}

makeAgent("npc-vic", { start: "working", ago: 8 });
makeAgent("npc-nina");
makeAgent("npc-sol", { start: "working", ago: 140 });
makeAgent("npc-gus", { start: "working", ago: 20 });
makeAgent("npc-pete");
makeAgent("npc-rio", { start: "working", ago: 3 });
makeAgent("npc-sol");

setInterval(() => {
  const now = Date.now();
  for (const a of agents.values()) tickAgent(a, now);
  sim.emit("tick", now);
}, 1000);

function agentsOf(ownerId) {
  return [...agents.values()].filter((a) => a.ownerId === ownerId);
}

function publicAgent(a) {
  const { plan, nextAt, fast, ...rest } = a;
  return rest;
}

function lobbyJson(l, uid) {
  const members = load(`demo.members.${l.id}`, []);
  const npcCount = l.npcs?.length || 0;
  return {
    id: l.id, code: l.code, name: l.name, is_private: l.is_private, owner_id: l.owner_id,
    owner_handle: NPC_BY_ID.get(l.owner_id)?.handle || load("demo.profiles", {})[l.owner_id]?.handle || "someone",
    role: l.owner_id === uid ? "owner" : members.includes(uid) ? "member" : null,
    members: npcCount + members.length, here: npcCount, created_at: l.created_at,
  };
}

export function createDemoBackend() {
  const bus = createEmitter();
  let user = null;
  let profile = null;
  let approveLogin = null;

  const profiles = () => load("demo.profiles", {});
  const saveProfile = (p) => {
    const all = profiles();
    all[p.id] = p;
    save("demo.profiles", all);
  };
  const userLobbies = () => load("demo.lobbies", []);
  const allLobbies = () => [...BUILTIN_LOBBIES, ...userLobbies()];
  const friendMap = () => load(`demo.friends.${user.id}`, null) ?? seedFriends();

  function seedFriends() {
    const map = { "npc-vic": "friend", "npc-nina": "friend", "npc-sol": "friend", "npc-gus": "incoming" };
    save(`demo.friends.${user.id}`, map);
    return map;
  }

  function readSession() {
    try {
      const s = sessionStorage.getItem("nd.demo.session");
      if (s) return JSON.parse(s);
    } catch {}
    return load("demo.session", null);
  }

  function writeSession(value) {
    try {
      if (value) sessionStorage.setItem("nd.demo.session", JSON.stringify(value));
      else sessionStorage.removeItem("nd.demo.session");
    } catch {}
    save("demo.session", value);
  }

  function setSession(id) {
    const p = profiles()[id];
    if (!p) return;
    user = { id, email: p.email || null };
    profile = { ...p, look: normalizeLook(p.look, id) };
    writeSession({ id });
    bus.emit("profile", profile);
    bus.emit("auth", user);
    syncMyAgent();
  }

  function syncMyAgent() {
    for (const [key, a] of agents) if (a.ownerId.startsWith("u_") && (!user || a.ownerId !== user.id)) agents.delete(key);
    if (!user) return;
    const want = load("demo.simAgent", false);
    const mine = agentsOf(user.id);
    if (want && !mine.length) makeAgent(user.id, { fast: true, label: "demo agent" }).nextAt = Date.now() + 4000;
    if (!want) for (const a of mine) agents.delete(`${a.ownerId}:${a.session_key}`);
  }

  function updateChips(delta) {
    profile = { ...profile, chips: Math.max(0, profile.chips + delta) };
    saveProfile({ ...profiles()[profile.id], chips: profile.chips });
    bus.emit("profile", profile);
  }

  function myBets() {
    return load(`demo.bets.${user.id}`, []);
  }

  function saveBets(bets) {
    save(`demo.bets.${user.id}`, bets.slice(0, 40));
  }

  sim.on("turnEnd", (ev) => {
    if (!user) return;
    const bets = myBets();
    let touched = false;
    for (const b of bets) {
      if (b.status !== "open" || b.owner_id !== ev.ownerId || b.session_key !== ev.session_key || b.turn_no !== ev.turn_no) continue;
      const bucket = bucketFor(ev.duration);
      let won;
      let odds;
      if (["flash", "grind", "marathon"].includes(b.pick)) {
        won = b.pick === bucket;
        odds = 3;
      } else {
        won = (b.pick === "permission") === ev.asked;
        odds = 2;
      }
      b.status = won ? "won" : "lost";
      b.payout = won ? b.amount * odds : 0;
      touched = true;
      if (won) updateChips(b.payout);
      bus.emit("settled", b);
    }
    if (touched) saveBets(bets);
  });

  const api = {
    mode: "demo",
    get user() { return user; },
    get profile() { return profile; },
    on: bus.on,

    async init() {
      const s = readSession();
      if (s?.id && profiles()[s.id]) setSession(s.id);
    },

    async handleAvailable(handle) {
      const h = String(handle || "").toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(h)) return false;
      return !NPCS.some((n) => n.handle === h) && !Object.values(profiles()).some((p) => p.handle === h);
    },

    async signUp({ email, password, handle }) {
      const accounts = load("demo.accounts", {});
      const key = String(email).trim().toLowerCase();
      if (accounts[key]) throw new Error("That email already has a demo account here. Sign in instead.");
      const h = String(handle).toLowerCase();
      if (!(await api.handleAvailable(h))) throw new Error("That handle is taken or invalid.");
      const id = `u_${randomHex(6)}`;
      const salt = randomHex(8);
      accounts[key] = { id, salt, hash: await sha256Hex(salt + password) };
      save("demo.accounts", accounts);
      saveProfile({ id, email: key, handle: h, display_name: h, look: normalizeLook(null, id), status_text: "", chips: 500 });
      setSession(id);
      return { confirm: false };
    },

    async signIn({ email, password }) {
      const acc = load("demo.accounts", {})[String(email).trim().toLowerCase()];
      if (!acc || (await sha256Hex(acc.salt + password)) !== acc.hash) throw new Error("Wrong email or password.");
      setSession(acc.id);
    },

    async guest() {
      let handle;
      do handle = `guest_${randomString(4).toLowerCase()}`;
      while (!(await api.handleAvailable(handle)));
      const id = `u_${randomHex(6)}`;
      saveProfile({ id, email: null, handle, display_name: handle, look: normalizeLook(null, id), status_text: "just looking around", chips: 500 });
      setSession(id);
    },

    async signInWithGitHub() {
      throw new Error("GitHub sign-in turns on once the bar is connected to Supabase.");
    },

    async startClaudeLogin() {
      const code = randomString(8);
      const done = new Promise((resolve) => {
        approveLogin = resolve;
      }).then(async () => {
        const last = load("demo.lastUser", null);
        if (last && profiles()[last]) setSession(last);
        else await api.guest();
        return true;
      });
      return { code, expiresAt: new Date(Date.now() + 600000).toISOString(), done, cancel: () => { approveLogin = null; } };
    },

    demoApprove() {
      approveLogin?.();
      approveLogin = null;
    },

    async signOut() {
      if (user) save("demo.lastUser", user.id);
      user = null;
      profile = null;
      writeSession(null);
      syncMyAgent();
      bus.emit("auth", null);
    },

    async loadProfile() {
      return profile;
    },

    async updateProfile(patch) {
      const cur = profiles()[user.id];
      const next = { ...cur };
      if ("handle" in patch && patch.handle !== cur.handle) {
        if (!(await api.handleAvailable(patch.handle))) throw new Error("That handle is taken or invalid.");
        next.handle = patch.handle.toLowerCase();
      }
      if ("display_name" in patch) next.display_name = String(patch.display_name).slice(0, 32);
      if ("status_text" in patch) next.status_text = String(patch.status_text).slice(0, 80);
      if ("look" in patch) next.look = normalizeLook(patch.look, user.id);
      saveProfile(next);
      profile = { ...next, look: normalizeLook(next.look, user.id) };
      bus.emit("profile", profile);
      return profile;
    },

    async publicLobbies() {
      return allLobbies().filter((l) => !l.is_private).map((l) => lobbyJson(l, user?.id));
    },

    async myLobbies() {
      return allLobbies()
        .filter((l) => l.owner_id === user.id || load(`demo.members.${l.id}`, []).includes(user.id))
        .map((l) => lobbyJson(l, user.id));
    },

    async createLobby({ name, isPrivate, proof }) {
      const all = userLobbies();
      let code;
      do code = randomString(6);
      while (allLobbies().some((l) => l.code === code));
      const lobby = {
        id: `demo-${randomHex(6)}`, code, name: String(name).trim().slice(0, 40), is_private: !!isPrivate,
        owner_id: user.id, npcs: [], proofHash: isPrivate ? await sha256Hex(proof) : null, created_at: new Date().toISOString(),
      };
      all.push(lobby);
      save("demo.lobbies", all);
      save(`demo.members.${lobby.id}`, [user.id]);
      return lobbyJson(lobby, user.id);
    },

    async joinLobby(code, proof) {
      const l = allLobbies().find((x) => x.code === normalizeCode(code));
      if (!l) throw new Error("no bar with that code");
      const members = load(`demo.members.${l.id}`, []);
      if (!members.includes(user.id) && l.owner_id !== user.id) {
        if (l.is_private && (!proof || (await sha256Hex(proof)) !== l.proofHash)) throw new Error("wrong key for that bar");
        members.push(user.id);
        save(`demo.members.${l.id}`, members);
      }
      return lobbyJson(l, user.id);
    },

    async leaveLobby(id) {
      save(`demo.members.${id}`, load(`demo.members.${id}`, []).filter((m) => m !== user.id));
      const mine = userLobbies();
      const l = mine.find((x) => x.id === id);
      if (l && l.owner_id === user.id) save("demo.lobbies", mine.filter((x) => x.id !== id));
    },

    async deleteLobby(id) {
      save("demo.lobbies", userLobbies().filter((x) => !(x.id === id && x.owner_id === user.id)));
    },

    async touch() {},

    async friends() {
      const map = friendMap();
      const all = profiles();
      return Object.entries(map).map(([id, rel]) => {
        const npc = NPC_BY_ID.get(id);
        const p = npc || all[id];
        const lobby = npc ? BUILTIN_LOBBIES.find((l) => l.npcs.includes(id)) : null;
        return {
          id, handle: p?.handle || "unknown", display_name: p?.display_name || "", look: normalizeLook(p?.look, id),
          status_text: p?.status_text || "", relation: rel, online: rel === "friend" && !!npc, last_seen: npc ? new Date().toISOString() : null,
          lobby: rel === "friend" && lobby ? { id: lobby.id, code: lobby.code, name: lobby.name, is_private: false } : null,
          agents: rel === "friend" ? agentsOf(id).map(publicAgent) : [],
        };
      }).sort((a, b) => (a.relation === "friend") - (b.relation === "friend") || b.online - a.online || a.handle.localeCompare(b.handle));
    },

    watchFriends(cb) {
      let alive = true;
      const tick = async () => alive && user && cb(await api.friends());
      tick();
      const timer = setInterval(tick, 4000);
      const off = bus.on("friends", tick);
      return () => {
        alive = false;
        clearInterval(timer);
        off();
      };
    },

    async addFriend(handle) {
      const h = String(handle || "").trim().toLowerCase().replace(/^@/, "");
      const target = NPCS.find((n) => n.handle === h) || Object.values(profiles()).find((p) => p.handle === h);
      if (!target) throw new Error("no daemon goes by that handle");
      if (target.id === user.id) throw new Error("that's you");
      const map = friendMap();
      if (map[target.id] === "friend") return "already";
      if (map[target.id] === "incoming") {
        map[target.id] = "friend";
        save(`demo.friends.${user.id}`, map);
        bus.emit("friends");
        return "accepted";
      }
      map[target.id] = "outgoing";
      save(`demo.friends.${user.id}`, map);
      bus.emit("friends");
      setTimeout(() => {
        const m = load(`demo.friends.${user.id}`, {});
        if (m[target.id] === "outgoing") {
          m[target.id] = "friend";
          save(`demo.friends.${user.id}`, m);
          bus.emit("friends");
          bus.emit("notice", `@${target.handle} accepted your friend request`);
        }
      }, 2600);
      return "requested";
    },

    async respondFriend(id, accept) {
      const map = friendMap();
      if (accept) map[id] = "friend";
      else delete map[id];
      save(`demo.friends.${user.id}`, map);
      bus.emit("friends");
    },

    async removeFriend(id) {
      const map = friendMap();
      delete map[id];
      save(`demo.friends.${user.id}`, map);
      bus.emit("friends");
    },

    async createPairingCode() {
      return { code: randomString(8), expires_at: new Date(Date.now() + 600000).toISOString() };
    },

    async devices() {
      return load("demo.simAgent", false) ? [{ id: "demo-device", name: "Demo agent (simulated)", created_at: new Date().toISOString(), last_seen: new Date().toISOString() }] : [];
    },

    async revokeDevice() {
      api.setSimAgent(false);
    },

    setSimAgent(on) {
      save("demo.simAgent", !!on);
      syncMyAgent();
      bus.emit("simAgent", !!on);
    },

    get simAgent() {
      return load("demo.simAgent", false);
    },

    async placeBet(ownerId, sessionKey, pickName, amount) {
      if (ownerId === user.id) throw new Error("no betting on your own agent");
      const a = agents.get(`${ownerId}:${sessionKey}`);
      if (!a || !["working", "waiting"].includes(a.state)) throw new Error("that agent is not on a job right now");
      if ((Date.now() - new Date(a.turn_started_at).getTime()) / 1000 > BET_WINDOW_S) throw new Error("betting closed for this job");
      if (["permission", "clean"].includes(pickName) && a.asked_permission) throw new Error("it already asked for permission, no bets on that");
      const bets = myBets();
      if (bets.some((b) => b.owner_id === ownerId && b.session_key === sessionKey && b.turn_no === a.turn_no)) throw new Error("one bet per job");
      if (amount < 1 || amount > 1000) throw new Error("bets are 1 to 1000 chips");
      if (profile.chips < amount) throw new Error("not enough chips");
      updateChips(-amount);
      const owner = NPC_BY_ID.get(ownerId) || profiles()[ownerId];
      bets.unshift({
        id: randomHex(4), bettor_id: user.id, owner_id: ownerId, owner_handle: owner?.handle || "?", session_key: sessionKey,
        turn_no: a.turn_no, pick: pickName, amount, payout: null, status: "open", created_at: new Date().toISOString(),
      });
      saveBets(bets);
      bus.emit("bets");
      return { ok: true, chips: profile.chips };
    },

    async myBets() {
      return myBets();
    },

    async topUp() {
      if (profile.chips >= 100) throw new Error("the bartender says come back when you're under 100 chips");
      updateChips(250);
      return profile.chips;
    },

    async refreshChips() {
      return profile.chips;
    },

    async submitScore(game, lobbyId, score) {
      const key = `demo.scores.${lobbyId || "global"}`;
      const list = load(key, null) ?? [{ handle: "neon_nina", score: 141 }, { handle: "vapor_vic", score: 96 }, { handle: "glitch_gus", score: 60 }];
      list.push({ handle: profile.handle, score });
      save(key, list);
    },

    async topScores(game, lobbyId) {
      const list = load(`demo.scores.${lobbyId || "global"}`, null) ?? [{ handle: "neon_nina", score: 141 }, { handle: "vapor_vic", score: 96 }, { handle: "glitch_gus", score: 60 }];
      const best = new Map();
      for (const s of list) best.set(s.handle, Math.max(best.get(s.handle) || 0, s.score));
      return [...best.entries()].map(([handle, score]) => ({ handle, score })).sort((a, b) => b.score - a.score).slice(0, 10);
    },

    connect(lobby, { cryptoKey = null } = {}) {
      const emitter = createEmitter();
      const def = allLobbies().find((l) => l.id === lobby.id) || lobby;
      const npcIds = def.npcs || [];
      const peers = new Map();
      const remote = new Map();
      const timers = [];
      const chatKey = `demo.chat.${lobby.id}`;
      let pos = { x: 240, y: 240 };
      let closed = false;
      const channel = "BroadcastChannel" in window ? new BroadcastChannel(`nd-demo-${lobby.id}`) : null;

      for (const id of npcIds) {
        const n = NPC_BY_ID.get(id);
        const spot = Math.random() < 0.5 ? STOOLS[Math.floor(Math.random() * STOOLS.length)] : LOUNGE[Math.floor(Math.random() * LOUNGE.length)];
        peers.set(id, { id, handle: n.handle, look: normalizeLook(n.look, id), x: spot.x + rand(-6, 6), y: spot.y - 6 + rand(-4, 4) });
      }

      const me = () => ({ id: user.id, handle: profile.handle, look: profile.look, x: pos.x, y: pos.y });
      const emitPeers = () => emitter.emit("peers", [me(), ...peers.values(), ...[...remote.values()].map((r) => r.peer)]);
      const visibleOwners = () => new Set([user.id, ...peers.keys(), ...remote.keys()]);
      const emitAgents = () => {
        const owners = visibleOwners();
        emitter.emit("agents", [...agents.values()].filter((a) => owners.has(a.ownerId) && a.state !== "offline").map(publicAgent));
      };
      const emitBets = () => emitter.emit("bets", myBets().filter((b) => b.status === "open"));

      const storeChat = (msg) => {
        const list = load(chatKey, []);
        list.push(msg);
        save(chatKey, list.slice(-80));
      };

      const npcSay = (id, text) => {
        const n = NPC_BY_ID.get(id);
        if (!n || closed) return;
        const msg = { id: randomHex(6), sender_id: id, handle: n.handle, look: normalizeLook(n.look, id), text, created_at: new Date().toISOString(), encrypted: false, failed: false };
        storeChat({ ...msg, body: text, encrypted: false });
        emitter.emit("chat", msg);
      };

      const later = (fn, ms) => {
        const t = setTimeout(() => !closed && fn(), ms);
        timers.push(t);
      };

      if (npcIds.length) {
        later(() => npcSay(pick(npcIds), pick(LINES.greet).replace("{name}", profile.handle)), 2200);
        timers.push(setInterval(() => {
          const id = pick(npcIds);
          const spot = Math.random() < 0.45 ? STOOLS[Math.floor(Math.random() * STOOLS.length)] : LOUNGE[Math.floor(Math.random() * LOUNGE.length)];
          const p = peers.get(id);
          p.x = spot.x + rand(-8, 8);
          p.y = spot.y - 6 + rand(-4, 6);
          emitter.emit("move", { id, x: p.x, y: p.y });
        }, 6500));
        timers.push(setInterval(() => npcSay(pick(npcIds), pick(LINES.general)), 31000));
        timers.push(setInterval(() => emitter.emit("emote", { id: pick(npcIds), kind: pick(["wave", "cheer", "dance", "drink", "laugh"]) }), 17000));
      }

      const offs = [
        sim.on("tick", () => emitAgents()),
        sim.on("waiting", (a) => {
          if (npcIds.includes(a.ownerId) && Math.random() < 0.5) later(() => npcSay(a.ownerId, pick(LINES.waiting)), 1200);
        }),
        sim.on("turnEnd", (ev) => {
          if (npcIds.includes(ev.ownerId) && Math.random() < 0.45) later(() => npcSay(ev.ownerId, pick(LINES.done)), 1500);
          later(emitBets, 100);
        }),
        sim.on("turn", (ev) => {
          if (ev.ownerId === user.id && npcIds.length && Math.random() < 0.6) {
            const better = pick(npcIds);
            later(() => {
              npcSay(better, `${pick(["50", "80", "120"])} chips says your agent goes ${pick(["FLASH", "GRIND", "MARATHON"])} 🎲`);
            }, 3000);
          }
        }),
        bus.on("bets", emitBets),
        bus.on("settled", (b) => emitter.emit("settled", b)),
        bus.on("profile", () => {
          emitPeers();
          post({ type: "presence", peer: me() });
        }),
      ];

      function post(msg) {
        try {
          channel?.postMessage(msg);
        } catch {}
      }

      if (channel) {
        channel.onmessage = ({ data }) => {
          if (closed || !data || data.from === user.id) return;
          if (data.type === "presence") {
            const fresh = !remote.has(data.peer.id);
            remote.set(data.peer.id, { peer: { ...data.peer, look: normalizeLook(data.peer.look, data.peer.id) }, seen: Date.now() });
            if (fresh) {
              emitPeers();
              post({ type: "presence", from: user.id, peer: me() });
            }
          } else if (data.type === "leave") {
            remote.delete(data.id);
            emitPeers();
          } else if (data.type === "move") {
            const r = remote.get(data.id);
            if (r) {
              r.peer.x = data.x;
              r.peer.y = data.y;
            }
            emitter.emit("move", data);
          } else if (data.type === "chat") {
            (async () => {
              let text = data.msg.text;
              let failed = false;
              if (data.msg.encrypted) {
                try {
                  text = cryptoKey ? await unseal(cryptoKey, data.msg.body) : "[encrypted]";
                } catch {
                  text = "[could not decrypt]";
                  failed = true;
                }
              }
              emitter.emit("chat", { ...data.msg, text, failed });
            })();
          } else if (data.type === "emote") {
            emitter.emit("emote", data);
          } else if (data.type === "game") {
            emitter.emit("game", data);
          }
        };
        timers.push(setInterval(() => {
          post({ type: "presence", from: user.id, peer: me() });
          const now = Date.now();
          let changed = false;
          for (const [id, r] of remote) {
            if (now - r.seen > 7000) {
              remote.delete(id);
              changed = true;
            }
          }
          if (changed) emitPeers();
        }, 2000));
        post({ type: "presence", from: user.id, peer: me() });
      }

      const ready = Promise.resolve().then(() => {
        emitter.emit("status", "online");
        emitPeers();
        emitAgents();
        emitBets();
      });

      return {
        ready,
        on: emitter.on,
        move(x, y) {
          pos = { x, y };
          post({ type: "move", from: user.id, id: user.id, x, y });
        },
        setPosition(x, y) {
          pos = { x, y };
        },
        async say(text) {
          const created_at = new Date().toISOString();
          const body = cryptoKey ? await seal(cryptoKey, text) : text;
          const msg = { id: randomHex(6), sender_id: user.id, handle: profile.handle, look: profile.look, text, created_at, encrypted: !!cryptoKey, failed: false };
          storeChat({ ...msg, text: cryptoKey ? null : text, body });
          emitter.emit("chat", msg);
          post({ type: "chat", from: user.id, msg: { ...msg, text: cryptoKey ? null : text, body } });
          if (npcIds.length && Math.random() < 0.55) {
            later(() => npcSay(pick(npcIds), text.includes("?") ? pick(["good question", "ask your agent, it knows", "no idea lol", "probably yes"]) : pick(LINES.replies)), rand(1500, 4000));
          }
        },
        emote(kind, target = null) {
          post({ type: "emote", from: user.id, id: user.id, kind, target });
        },
        game(kind, data) {
          post({ type: "game", from: user.id, id: user.id, kind, data });
          if (kind === "darts" && npcIds.length) later(() => npcSay(pick(npcIds), data.score >= 120 ? `${data.score}?! who taught you that` : `${data.score}, not bad`), 1800);
        },
        updateLook() {
          emitPeers();
          post({ type: "presence", from: user.id, peer: me() });
        },
        async history() {
          const list = load(chatKey, []);
          const out = [];
          for (const m of list) {
            let text = m.text;
            let failed = false;
            if (m.encrypted) {
              try {
                text = cryptoKey ? await unseal(cryptoKey, m.body) : "[encrypted]";
              } catch {
                text = "[could not decrypt]";
                failed = true;
              }
            }
            out.push({ ...m, text: text ?? m.body, failed });
          }
          return out;
        },
        refreshAgents: emitAgents,
        refreshBets: emitBets,
        close() {
          closed = true;
          timers.forEach((t) => {
            clearTimeout(t);
            clearInterval(t);
          });
          offs.forEach((off) => off());
          post({ type: "leave", from: user.id, id: user.id });
          channel?.close();
          emitter.clear();
        },
      };
    },
  };
  return api;
}
