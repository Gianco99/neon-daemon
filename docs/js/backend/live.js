import config from "../../config.js";
import { createEmitter, describeBrowser, sleep } from "../lib/util.js";
import { randomHex, sha256Hex, seal, unseal } from "../lib/crypto.js";
import { normalizeLook } from "../looks.js";

const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";
const AGENT_WINDOW_MS = 30 * 60 * 1000;

function check({ data, error }) {
  if (error) throw error;
  return data;
}

export async function createLiveBackend() {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const bus = createEmitter();
  const profiles = new Map();
  let user = null;
  let profile = null;

  let unlockCache = null;
  let earnings = null;
  const EARN_LABEL = { job: "your agent shipped a job", hangout: "hanging out", daily: "daily streak", darts: "darts" };

  async function loadProfile() {
    const data = check(await sb.from("profiles").select("id, handle, display_name, look, status_text, chips, buff, buff_until, streak").eq("id", user.id).single());
    profile = { ...data, look: normalizeLook(data.look, data.id) };
    profiles.set(profile.id, profile);
    bus.emit("profile", profile);
    return profile;
  }

  function watchEarnings() {
    if (earnings) sb.removeChannel(earnings);
    earnings = null;
    unlockCache = null;
    if (!user) return;
    earnings = sb.channel(`me-${user.id}-${randomHex(3)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chip_log", filter: `user_id=eq.${user.id}` }, ({ new: row }) => {
        if (row.amount > 0 && EARN_LABEL[row.source]) {
          bus.emit("earned", { amount: row.amount, source: row.source, label: EARN_LABEL[row.source], note: row.note });
          api.refreshChips().catch(() => null);
        }
      })
      .subscribe();
  }

  async function profileOf(id) {
    if (profiles.has(id)) return profiles.get(id);
    const { data } = await sb.from("profiles").select("id, handle, display_name, look, status_text").eq("id", id).maybeSingle();
    const p = data ? { ...data, look: normalizeLook(data.look, data.id) } : { id, handle: "unknown", look: normalizeLook(null, id) };
    profiles.set(id, p);
    return p;
  }

  const api = {
    mode: "live",
    get user() { return user; },
    get profile() { return profile; },
    on: bus.on,

    async init() {
      const { data } = await sb.auth.getSession();
      user = data.session?.user ?? null;
      if (user) {
        await sb.realtime.setAuth(data.session.access_token);
        await loadProfile().catch(() => null);
        watchEarnings();
      }
      sb.auth.onAuthStateChange((event, session) => {
        setTimeout(async () => {
          const next = session?.user ?? null;
          if (session) await sb.realtime.setAuth(session.access_token);
          if (next?.id !== user?.id) {
            user = next;
            profile = null;
            if (user) await loadProfile().catch(() => null);
            watchEarnings();
            bus.emit("auth", user);
          }
        }, 0);
      });
      const params = new URLSearchParams(location.search);
      if (params.has("code") || params.has("error_description")) {
        if (params.get("error_description")) bus.emit("notice", params.get("error_description"));
        history.replaceState(null, "", location.pathname + location.hash);
      }
    },

    async handleAvailable(handle) {
      return !!check(await sb.rpc("handle_available", { p_handle: handle }));
    },

    async signUp({ email, password, handle }) {
      const data = check(await sb.auth.signUp({
        email,
        password,
        options: { data: { handle, display_name: handle }, emailRedirectTo: location.origin + location.pathname },
      }));
      return { confirm: !data.session };
    },

    async signIn({ email, password }) {
      check(await sb.auth.signInWithPassword({ email, password }));
    },

    async signInWithGitHub() {
      check(await sb.auth.signInWithOAuth({ provider: "github", options: { redirectTo: location.origin + location.pathname } }));
    },

    async startClaudeLogin() {
      const secret = randomHex(32);
      const data = check(await sb.rpc("start_claude_login", { p_secret_hash: await sha256Hex(secret), p_client: describeBrowser() }));
      let cancelled = false;
      const done = (async () => {
        while (!cancelled) {
          await sleep(2000);
          if (cancelled) return false;
          const { data: res, error } = await sb.rpc("poll_claude_login", { p_id: data.id, p_secret: secret });
          if (error) continue;
          if (res.status === "approved") {
            let out = await sb.auth.verifyOtp({ token_hash: res.token_hash, type: "magiclink" });
            if (out.error) out = await sb.auth.verifyOtp({ token_hash: res.token_hash, type: "email" });
            if (out.error) throw out.error;
            return true;
          }
          if (res.status !== "pending") throw new Error("That code expired. Grab a new one.");
        }
        return false;
      })();
      return { code: data.code, expiresAt: data.expires_at, done, cancel: () => { cancelled = true; } };
    },

    async signOut() {
      await sb.removeAllChannels();
      earnings = null;
      await sb.auth.signOut();
    },

    loadProfile,

    async updateProfile(patch) {
      const clean = {};
      for (const k of ["handle", "display_name", "look", "status_text"]) if (k in patch) clean[k] = patch[k];
      check(await sb.from("profiles").update(clean).eq("id", user.id));
      return loadProfile();
    },

    async publicLobbies() {
      return check(await sb.rpc("list_public_lobbies")) || [];
    },

    async myLobbies() {
      return check(await sb.rpc("my_lobbies")) || [];
    },

    async createLobby({ name, isPrivate, proof }) {
      return check(await sb.rpc("create_lobby", { p_name: name, p_private: isPrivate, p_proof: proof ?? null }));
    },

    async joinLobby(code, proof) {
      return check(await sb.rpc("join_lobby", { p_code: code, p_proof: proof ?? null }));
    },

    async leaveLobby(id) {
      check(await sb.rpc("leave_lobby", { p_lobby: id }));
    },

    async deleteLobby(id) {
      check(await sb.rpc("delete_lobby", { p_lobby: id }));
    },

    async touch(lobbyId) {
      if (!user) return;
      await sb.rpc("touch", { p_lobby: lobbyId ?? null });
    },

    async friends() {
      const list = check(await sb.rpc("friends_overview")) || [];
      return list.map((f) => ({ ...f, look: normalizeLook(f.look, f.id) }));
    },

    watchFriends(cb) {
      let alive = true;
      const tick = async () => {
        if (!alive || !user) return;
        try {
          cb(await api.friends());
        } catch {}
      };
      tick();
      const timer = setInterval(tick, 20000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    },

    async addFriend(handle) {
      return check(await sb.rpc("send_friend_request", { p_handle: handle }));
    },

    async respondFriend(id, accept) {
      check(await sb.rpc("respond_friend_request", { p_user: id, p_accept: accept }));
    },

    async removeFriend(id) {
      check(await sb.rpc("remove_friend", { p_user: id }));
    },

    async createPairingCode() {
      return check(await sb.rpc("create_pairing_code"));
    },

    async devices() {
      return check(await sb.from("devices").select("id, name, created_at, last_seen").order("created_at")) || [];
    },

    async revokeDevice(id) {
      check(await sb.from("devices").delete().eq("id", id));
    },

    async placeBet(ownerId, sessionKey, pick, amount) {
      const res = check(await sb.rpc("place_bet", { p_owner: ownerId, p_session: sessionKey, p_pick: pick, p_amount: amount }));
      if (profile) {
        profile = { ...profile, chips: res.chips };
        bus.emit("profile", profile);
      }
      return res;
    },

    async myBets() {
      return check(await sb.rpc("my_bets")) || [];
    },

    async topUp() {
      const chips = check(await sb.rpc("top_up"));
      profile = { ...profile, chips };
      bus.emit("profile", profile);
      return chips;
    },

    async refreshChips() {
      const data = check(await sb.from("profiles").select("chips").eq("id", user.id).single());
      profile = { ...profile, chips: data.chips };
      bus.emit("profile", profile);
      return data.chips;
    },

    async unlocks() {
      if (unlockCache) return unlockCache;
      const rows = check(await sb.from("unlocks").select("kind, value")) || [];
      unlockCache = new Set(rows.map((r) => `${r.kind}:${r.value}`));
      return unlockCache;
    },

    async buyItem(kind, value) {
      const res = check(await sb.rpc("buy_item", { p_kind: kind, p_value: value }));
      unlockCache?.add(`${kind}:${value}`);
      profile = { ...profile, chips: res.chips };
      bus.emit("profile", profile);
      return res;
    },

    async orderDrink(id) {
      const res = check(await sb.rpc("order_drink", { p_drink: id }));
      profile = { ...profile, chips: res.chips, buff: res.buff, buff_until: res.buff_until };
      bus.emit("profile", profile);
      return res;
    },

    async leaderboard(lobbyId) {
      const list = check(await sb.rpc("leaderboard", { p_lobby: lobbyId ?? null })) || [];
      return list.map((r) => ({ ...r, look: normalizeLook(r.look, r.id) }));
    },

    async submitScore(game, lobbyId, score) {
      check(await sb.from("scores").insert({ game, lobby_id: lobbyId ?? null, score }));
    },

    async topScores(game, lobbyId) {
      return check(await sb.rpc("top_scores", { p_game: game, p_lobby: lobbyId ?? null })) || [];
    },

    connect(lobby, { cryptoKey = null } = {}) {
      const emitter = createEmitter();
      const peers = new Map();
      const agents = new Map();
      const seenMessages = new Set();
      let pos = { x: null, y: null };
      let closed = false;
      let trackTimer = 0;

      const presencePayload = () => ({ handle: profile.handle, look: profile.look, x: pos.x, y: pos.y, buff: profile.buff ?? null, buffUntil: profile.buff_until ?? null });

      const emitAgents = () => {
        const cutoff = Date.now() - AGENT_WINDOW_MS;
        const list = [];
        for (const [ownerId, rows] of agents) {
          if (!peers.has(ownerId)) continue;
          for (const row of rows.values()) {
            if (row.state !== "offline" && new Date(row.updated_at).getTime() > cutoff) list.push({ ...row, ownerId });
          }
        }
        emitter.emit("agents", list);
      };

      const refreshAgents = async () => {
        const ids = [...peers.keys()];
        if (!ids.length) return;
        const since = new Date(Date.now() - AGENT_WINDOW_MS).toISOString();
        const { data } = await sb.from("agent_sessions")
          .select("user_id, session_key, state, label, tool, turn_no, turn_started_at, asked_permission, updated_at")
          .in("user_id", ids).neq("state", "offline").gt("updated_at", since);
        agents.clear();
        for (const row of data || []) {
          if (!agents.has(row.user_id)) agents.set(row.user_id, new Map());
          agents.get(row.user_id).set(row.session_key, row);
        }
        emitAgents();
      };

      const refreshBets = async () => {
        const ids = [...peers.keys()];
        if (!ids.length) return;
        const { data } = await sb.from("bets").select("id, bettor_id, owner_id, session_key, turn_no, pick, amount, status").eq("status", "open").in("owner_id", ids);
        emitter.emit("bets", data || []);
      };

      const decode = async (row) => {
        const sender = await profileOf(row.sender_id);
        let text = row.body;
        let failed = false;
        if (row.encrypted) {
          if (!cryptoKey) {
            text = "[encrypted message, enter the bar key to read]";
            failed = true;
          } else {
            try {
              text = await unseal(cryptoKey, row.body);
            } catch {
              text = "[could not decrypt]";
              failed = true;
            }
          }
        }
        return { id: row.id, sender_id: row.sender_id, handle: sender.handle, look: sender.look, text, created_at: row.created_at, encrypted: row.encrypted, failed };
      };

      const ch = sb.channel(`lobby:${lobby.id}`, { config: { private: true, presence: { key: user.id }, broadcast: { self: false } } });
      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        peers.clear();
        for (const [id, metas] of Object.entries(state)) {
          const m = metas[metas.length - 1];
          peers.set(id, { id, handle: m.handle, look: normalizeLook(m.look, id), x: m.x, y: m.y, buff: m.buff, buffUntil: m.buffUntil });
        }
        emitter.emit("peers", [...peers.values()]);
        refreshAgents();
        refreshBets();
      })
        .on("broadcast", { event: "move" }, ({ payload }) => emitter.emit("move", payload))
        .on("broadcast", { event: "emote" }, ({ payload }) => emitter.emit("emote", payload))
        .on("broadcast", { event: "game" }, ({ payload }) => emitter.emit("game", payload));

      const ready = new Promise((resolve, reject) => {
        ch.subscribe(async (status, err) => {
          if (status === "SUBSCRIBED") {
            await ch.track(presencePayload());
            emitter.emit("status", "online");
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            emitter.emit("status", "offline");
            reject(err || new Error("Could not reach the bar's channel. Are you a member?"));
          } else if (status === "CLOSED" && !closed) {
            emitter.emit("status", "offline");
          }
        });
      });

      const db = sb.channel(`db-lobby-${lobby.id}-${randomHex(4)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "lobby_messages", filter: `lobby_id=eq.${lobby.id}` }, async ({ new: row }) => {
          if (seenMessages.has(row.id)) return;
          seenMessages.add(row.id);
          emitter.emit("chat", await decode(row));
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "agent_sessions" }, ({ new: row }) => {
          if (!row?.user_id) return;
          if (!agents.has(row.user_id)) agents.set(row.user_id, new Map());
          agents.get(row.user_id).set(row.session_key, row);
          emitAgents();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, ({ new: row }) => {
          if (row?.bettor_id === user.id && row.status && row.status !== "open") {
            emitter.emit("settled", row);
            api.refreshChips().catch(() => null);
          }
          refreshBets();
        })
        .subscribe();

      api.touch(lobby.id);
      const heartbeat = setInterval(() => {
        api.touch(lobby.id);
        refreshAgents();
      }, 45000);

      return {
        ready,
        on: emitter.on,
        move(x, y) {
          pos = { x, y };
          ch.send({ type: "broadcast", event: "move", payload: { id: user.id, x, y } });
          clearTimeout(trackTimer);
          trackTimer = setTimeout(() => ch.track(presencePayload()), 1500);
        },
        setPosition(x, y) {
          pos = { x, y };
        },
        async say(text) {
          const body = cryptoKey ? await seal(cryptoKey, text) : text;
          const row = check(await sb.from("lobby_messages").insert({ lobby_id: lobby.id, body, encrypted: !!cryptoKey }).select("id, sender_id, body, encrypted, created_at").single());
          if (!seenMessages.has(row.id)) {
            seenMessages.add(row.id);
            emitter.emit("chat", await decode(row));
          }
        },
        emote(kind, target = null) {
          ch.send({ type: "broadcast", event: "emote", payload: { id: user.id, kind, target } });
        },
        game(kind, data) {
          ch.send({ type: "broadcast", event: "game", payload: { id: user.id, kind, data } });
        },
        updateLook() {
          ch.track(presencePayload());
        },
        async history() {
          const rows = check(await sb.from("lobby_messages").select("id, sender_id, body, encrypted, created_at").eq("lobby_id", lobby.id).order("id", { ascending: false }).limit(60)) || [];
          const out = [];
          for (const row of rows.reverse()) {
            seenMessages.add(row.id);
            out.push(await decode(row));
          }
          return out;
        },
        refreshAgents,
        refreshBets,
        close() {
          closed = true;
          clearInterval(heartbeat);
          clearTimeout(trackTimer);
          emitter.clear();
          sb.removeChannel(ch);
          sb.removeChannel(db);
          api.touch(null);
        },
      };
    },
  };
  return api;
}
