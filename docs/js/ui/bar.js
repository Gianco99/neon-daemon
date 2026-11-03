import { h, replace, toast, errorToast, errorMessage, copyText } from "../lib/dom.js";
import { keyProof, chatKey, lobbyCodeLabel, normalizeCode } from "../lib/crypto.js";
import { keyring } from "../lib/store.js";
import { fmtTime, fmtClock, PICKS } from "../lib/util.js";
import { activeBuff, EARNING } from "../looks.js";
import { openBarMenu, buffChip } from "./drinks.js";
import { Stage } from "../scene/stage.js";
import { LOUNGE } from "../scene/bar.js";
import { brand, navigate, mePill, inviteLink, portrait, stateBadge } from "./common.js";
import { userMenu, askForKey } from "./lobbies.js";
import { friendsPanel } from "./friends.js";
import { openLinkClaude } from "./link.js";
import { openCustomize } from "./customize.js";
import { openBets, bettable } from "./bets.js";
import { openProfile } from "./profile.js";
import { openJukebox, musicButton } from "./music.js";
import { agentNeedsYou } from "./alerts.js";

const EMOTES = [["wave", "👋"], ["dance", "🕺"], ["cheer", "🍻"], ["drink", "🍹"], ["heart", "💖"], ["laugh", "😂"], ["fire", "🔥"]];
const STATE_TEXT = { working: "on a job", waiting: "waiting on you", idle: "chilling at the bar" };

export function renderBar(app, backend, { code }) {
  const screen = h("div", { class: "screen bar-screen" });
  const loading = h("div", { class: "panel panel-pad", style: { margin: "auto", textAlign: "center", maxWidth: "460px" } }, h("h2", null, "Opening the door..."));
  screen.append(loading);
  app.replaceChildren(screen);
  const cleanup = [];
  let destroyed = false;
  let room = null;
  let stage = null;
  let darts = null;

  async function resolveLobby() {
    const norm = normalizeCode(code);
    const mine = await backend.myLobbies();
    const member = mine.find((l) => l.code === norm);
    if (member) return member;
    let key = keyring.get(norm);
    try {
      return await backend.joinLobby(norm, key ? await keyProof(key) : null);
    } catch (err) {
      if (!/wrong key/i.test(errorMessage(err))) throw err;
      if (key) keyring.forget(norm);
      key = await askForKey(null, norm);
      if (!key) throw new Error("That bar is locked. You need the key from an invite.");
      const lobby = await backend.joinLobby(norm, await keyProof(key));
      keyring.set(norm, key);
      return lobby;
    }
  }

  (async () => {
    let lobby;
    let cryptoKey = null;
    try {
      lobby = await resolveLobby();
      if (destroyed) return;
      if (lobby.is_private) {
        let key = keyring.get(lobby.code);
        if (!key) {
          key = await askForKey(lobby.name, lobby.code);
          if (!key) {
            navigate("#/");
            return;
          }
          keyring.set(lobby.code, key);
        }
        cryptoKey = await chatKey(key, lobby.id);
      }
    } catch (err) {
      if (destroyed) return;
      replace(loading, h("h2", null, "Couldn't get in"), h("p", null, errorMessage(err)), h("button", { class: "btn cyan mt", onclick: () => navigate("#/") }, "Back to the bars"));
      return;
    }
    if (!destroyed) build(lobby, cryptoKey);
  })();

  function build(lobby, cryptoKey) {
    const meId = backend.user.id;
    const me = mePill(backend, userMenu(backend));
    const music = musicButton();
    const buff = buffChip(backend, () => openDrinks());
    cleanup.push(me.destroy, music.destroy, buff.destroy);
    cleanup.push(backend.on("earned", (e) => toast(`+${e.amount} 🪙 ${e.label}`, "gold", 3600)));
    const peers = new Map();
    let known = new Map();
    let agents = [];
    let openBetsList = [];
    let placedMe = false;
    let hereSig = "";
    const listeners = { agents: new Set(), bets: new Set(), settled: new Set() };
    const subscribe = (set) => (fn) => {
      set.add(fn);
      return () => set.delete(fn);
    };

    const hereCount = h("span", { class: "badge cyan" }, "1 here");
    const copyInvite = () => copyText(
      inviteLink(lobby.code, lobby.is_private ? keyring.get(lobby.code) : ""),
      lobby.is_private ? "Invite copied. It contains the key, so share it privately." : "Invite link copied",
    );
    const sidebar = h("aside", { class: "sidebar" });
    const hud = h(
      "div",
      { class: "bar-hud" },
      brand(() => navigate("#/")),
      h("div", { class: "lobby-name", title: lobby.name }, lobby.name),
      h("span", { class: "chip lobby-code", title: "Copy invite link", onclick: copyInvite }, lobbyCodeLabel(lobby.code)),
      lobby.is_private ? h("span", { class: "badge mint", title: "Chat is end-to-end encrypted with this bar's key" }, "🔒 E2E") : null,
      hereCount,
      h("div", { class: "spacer" }),
      buff.el,
      me.chips,
      h(
        "div",
        { class: "actions" },
        music.el,
        h("button", { class: "btn icon", title: "Jukebox", onclick: () => openJukebox() }, "♫"),
        h("button", { class: "btn icon", title: "Bet booth", onclick: () => openBooth() }, "🎲"),
        h("button", { class: "btn icon", title: "Wardrobe", onclick: () => openCustomize(backend, { onSaved: () => room?.updateLook() }) }, "🎨"),
        h("button", { class: "btn icon", title: "Link Claude Code", onclick: () => openLinkClaude(backend) }, "🔗"),
        h("button", { class: "btn icon drawer-toggle", title: "Chat and people", onclick: () => sidebar.classList.toggle("open") }, "💬"),
      ),
      me.pill,
    );

    const stageArea = h("div", { class: "stage-area" });
    const emoteBar = h(
      "div",
      { class: "emote-bar" },
      EMOTES.map(([kind, icon]) => h("button", {
        class: "btn small ghost", title: kind === "drink" ? "Order a drink" : kind, "aria-label": kind,
        onclick: () => (kind === "drink" ? openDrinks() : doEmote(kind)),
      }, icon)),
      h("p", { class: "hint" }, "Click the floor to walk · try the dartboard, jukebox, BET booth and the bar"),
    );

    const tabsDef = [["chat", "Chat"], ["here", "Here"], ["top", "Top"], ["friends", "Friends"]];
    const unread = h("span", { class: "count hidden" }, "0");
    let activeTab = "chat";
    let unreadCount = 0;
    const tabButtons = tabsDef.map(([id, label]) => h("button", { class: "tab", type: "button", onclick: () => showTab(id) }, label, id === "chat" ? unread : null));
    const chatLog = h("div", { class: "chat-log" });
    const chatInput = h("input", { class: "input", placeholder: cryptoKey ? "Encrypted message..." : "Say something...", maxLength: 500, autocomplete: "off", "aria-label": "Chat message" });
    const chatForm = h("form", { class: "chat-form" }, chatInput, h("button", { class: "btn small primary", type: "submit" }, "Send"));
    const panes = {
      chat: h("div", { class: "chat-wrap" }, cryptoKey ? h("div", { class: "e2e-note" }, "🔒 End-to-end encrypted with this bar's key") : null, chatLog, chatForm),
      here: h("div", { class: "side-body" }),
      top: h("div", { class: "side-body" }),
      friends: h("div", { class: "side-body" }),
    };
    const friends = friendsPanel(backend, { onJoin: (l) => navigate(`#/bar/${l.code}`), currentLobbyId: lobby.id });
    cleanup.push(friends.destroy);
    panes.friends.append(friends.el);
    sidebar.append(h("div", { class: "tabs" }, tabButtons), panes.chat, panes.here, panes.top, panes.friends);

    async function renderTop() {
      let list = [];
      try {
        list = await backend.leaderboard(lobby.id);
      } catch {}
      replace(
        panes.top,
        h("div", { class: "group-title" }, "Jobs shipped this week"),
        list.length
          ? list.map((r, i) => h(
            "div",
            { class: "leader" },
            h("span", { class: "rank" }, `#${i + 1}`),
            portrait(r.look),
            h("div", { class: "who", style: { minWidth: "0", overflow: "hidden", textOverflow: "ellipsis" } }, `@${r.handle}`, r.id === meId ? h("span", { class: "muted" }, " (you)") : null),
            h("div", { class: "stat" }, h("div", null, `🤖 ${r.jobs}`), h("div", { class: "muted" }, `🪙 +${r.earned}`)),
          ))
          : h("div", { class: "empty" }, "Nobody has shipped anything yet this week."),
        h("div", { class: "group-title mt" }, "How to earn chips"),
        EARNING.map(([icon, title, text]) => h("div", { class: "earn-row" }, h("span", null, icon), h("div", null, h("b", null, title), h("div", { class: "muted" }, text)))),
        h("p", { class: "hint mt" }, "Spend chips on outfits and colors in the 🎨 wardrobe, or on drinks at the bar."),
      );
    }

    function showTab(id) {
      activeTab = id;
      tabButtons.forEach((b, i) => b.classList.toggle("active", tabsDef[i][0] === id));
      for (const [k, el] of Object.entries(panes)) el.classList.toggle("hidden", k !== id);
      if (id === "top") renderTop();
      if (id === "chat") {
        unreadCount = 0;
        unread.classList.add("hidden");
        chatLog.scrollTop = chatLog.scrollHeight;
      }
    }
    showTab("chat");

    screen.replaceChildren(hud, h("div", { class: "bar-main" }, h("div", { class: "stage-wrap" }, stageArea, emoteBar), sidebar));

    function addMessage(msg) {
      const near = chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 80;
      chatLog.append(h(
        "div",
        { class: `msg${msg.failed ? " failed" : ""}` },
        h("span", { class: "who", style: { color: msg.look?.eyeColor || "#00f0ff" } }, msg.handle),
        msg.text,
        h("span", { class: "when" }, fmtTime(msg.created_at)),
      ));
      while (chatLog.children.length > 200) chatLog.firstChild.remove();
      if (near || msg.sender_id === meId) chatLog.scrollTop = chatLog.scrollHeight;
    }

    function systemMessage(text) {
      chatLog.append(h("div", { class: "msg system" }, text));
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    function bumpUnread() {
      const hidden = activeTab !== "chat" || (getComputedStyle(sidebar).position === "fixed" && !sidebar.classList.contains("open"));
      if (!hidden) return;
      unreadCount += 1;
      unread.textContent = String(unreadCount);
      unread.classList.remove("hidden");
    }

    function doEmote(kind, target = null) {
      stage?.emote(kind === "drink" && target ? target : meId, kind);
      room?.emote(kind, target);
    }

    function openDrinks() {
      openBarMenu(backend, {
        onOrder: () => {
          doEmote("drink");
          room?.updateLook();
        },
      });
    }

    function openBooth() {
      openBets(backend, {
        meId,
        agents: () => agents,
        openBets: () => openBetsList,
        peer: (id) => peers.get(id),
        onAgents: subscribe(listeners.agents),
        onBets: subscribe(listeners.bets),
        onSettled: subscribe(listeners.settled),
        announce: (text) => {
          room?.game("bet", { text });
          systemMessage(`🎲 You ${text}`);
        },
      });
    }

    async function openDartsGame() {
      if (darts) return;
      const { openDarts } = await import("../games/darts.js");
      const perk = activeBuff(backend.profile)?.effect;
      if (perk === "steady") toast("🍸 Steady Hand: your aim barely wobbles", "gold", 2600);
      if (perk === "courage") toast("🍶 Liquid Courage: your last dart scores double", "gold", 2600);
      darts = openDarts({
        root: document.body,
        lobbyName: lobby.name,
        steady: perk === "steady",
        courage: perk === "courage",
        onFinish: async (score) => {
          try {
            await backend.submitScore("darts", lobby.id, score);
          } catch (err) {
            errorToast(err);
          }
          room?.game("darts", { score });
          systemMessage(`🎯 You threw ${score} at darts.`);
        },
        loadLeaderboard: () => backend.topScores("darts", lobby.id),
        onClose: () => {
          darts = null;
        },
      });
    }

    function hotspot(name) {
      if (name === "darts") openDartsGame();
      else if (name === "jukebox") openJukebox();
      else if (name === "bets") openBooth();
      else if (name === "bar") openDrinks();
    }

    function showProfile(p) {
      openProfile(backend, p, { friends: friends.friends, onEmote: doEmote, onSaved: () => room?.updateLook() });
    }

    function agentRow(a) {
      const row = h("div", { class: "agent-row" }, stateBadge(a.state), h("span", { class: "lbl" }, a.label || "agent"));
      if (a.turn_started_at && a.state !== "idle") row.append(h("span", { class: "timer", dataset: { since: a.turn_started_at } }, fmtClock((Date.now() - new Date(a.turn_started_at).getTime()) / 1000)));
      const pot = openBetsList.filter((b) => b.owner_id === a.ownerId && b.session_key === a.session_key && b.turn_no === a.turn_no).reduce((s, b) => s + b.amount, 0);
      if (pot) row.append(h("span", { class: "muted", title: "Chips riding on this job" }, `🪙${pot}`));
      if (bettable(a, meId)) row.append(h("button", { class: "btn small yellow", onclick: openBooth }, "Bet"));
      return row;
    }

    function renderHere(force = false) {
      const sig = JSON.stringify([
        [...peers.values()].map((p) => [p.id, p.handle, p.look?.body, p.look?.hat]),
        agents.map((a) => [a.ownerId, a.session_key, a.state, a.label, a.turn_no, bettable(a, meId)]),
        openBetsList.map((b) => [b.id, b.amount]),
      ]);
      if (!force && sig === hereSig) return;
      hereSig = sig;
      const list = [...peers.values()].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : a.handle.localeCompare(b.handle)));
      const rows = list.map((p) => {
        const theirs = agents.filter((a) => a.ownerId === p.id);
        const sub = theirs.length ? `${theirs.length} agent${theirs.length === 1 ? "" : "s"} · ${STATE_TEXT[theirs[0].state] || theirs[0].state}` : "no agents running";
        return h(
          "div",
          null,
          h(
            "div",
            { class: "person", style: { cursor: "pointer" }, onclick: () => showProfile(p) },
            portrait(p.look),
            h("div", { style: { minWidth: "0" } }, h("div", { class: "who" }, `@${p.handle}`, p.id === meId ? h("span", { class: "muted" }, " (you)") : null), h("div", { class: "sub" }, sub)),
            h("div", { class: "acts" }),
          ),
          theirs.map(agentRow),
        );
      });
      if (!agents.some((a) => a.ownerId === meId)) {
        rows.push(h(
          "div",
          { class: "empty mt" },
          h("p", null, "Your agents aren't here yet."),
          h("button", { class: "btn small primary", onclick: () => openLinkClaude(backend) }, backend.mode === "demo" ? "Simulate an agent" : "Link Claude Code"),
        ));
      }
      replace(panes.here, rows);
    }

    stage = new Stage(stageArea, {
      meId,
      onMove: (x, y) => room?.move(x, y),
      onHotspot: hotspot,
      onAvatarClick: (e) => showProfile({ id: e.id, handle: e.handle, look: e.look }),
      onDroneClick: (d) => {
        if (d.ownerId === meId) toast(`Your agent is ${STATE_TEXT[d.state] || d.state}${d.label ? ` · ${d.label}` : ""}`, "", 2600);
        else openBooth();
      },
      onMyAgentWaiting: (d) => agentNeedsYou(d.label),
    });

    room = backend.connect(lobby, { cryptoKey });
    room.on("peers", (list) => {
      peers.clear();
      list.forEach((p) => peers.set(p.id, p));
      stage.setPeers(list);
      hereCount.textContent = `${list.length} here`;
      if (known.size) {
        for (const p of list) if (!known.has(p.id) && p.id !== meId) systemMessage(`@${p.handle} walked in.`);
        for (const [id, handle] of known) if (!peers.has(id)) systemMessage(`@${handle} headed out.`);
      }
      known = new Map(list.map((p) => [p.id, p.handle]));
      renderHere();
      if (!placedMe && peers.has(meId)) {
        placedMe = true;
        const spot = LOUNGE[Math.floor(Math.random() * LOUNGE.length)];
        setTimeout(() => stage?.walkMe(spot.x, spot.y), 400);
      }
    });
    room.on("move", ({ id, x, y }) => stage.moveEntity(id, x, y));
    room.on("chat", (msg) => {
      addMessage(msg);
      stage.say(msg.sender_id, msg.text);
      if (msg.sender_id !== meId) bumpUnread();
    });
    room.on("emote", ({ id, kind, target }) => {
      stage.emote(kind === "drink" && target ? target : id, kind);
      const who = peers.get(id)?.handle;
      if (target === meId && who) toast(kind === "drink" ? `🍹 @${who} bought you a drink` : `👋 @${who} waved at you`, "pink", 3200);
    });
    room.on("game", ({ id, kind, data }) => {
      const who = peers.get(id)?.handle || "someone";
      if (kind === "darts" && Number.isFinite(data?.score)) systemMessage(`🎯 @${who} threw ${data.score} at darts.`);
      else if (kind === "bet" && typeof data?.text === "string") systemMessage(`🎲 @${who} ${data.text.slice(0, 120)}`);
    });
    room.on("agents", (list) => {
      agents = list;
      stage.setAgents(list);
      stage.setBetting(list.some((a) => bettable(a, meId)));
      renderHere();
      listeners.agents.forEach((fn) => fn(list));
    });
    room.on("bets", (list) => {
      openBetsList = list;
      renderHere();
      listeners.bets.forEach((fn) => fn(list));
    });
    room.on("settled", (b) => {
      const owner = b.owner_handle || peers.get(b.owner_id)?.handle || "?";
      if (b.status === "won") toast(`🎉 Your ${PICKS[b.pick]?.label} bet on @${owner} paid ${b.payout} chips!`, "gold", 5200);
      else if (b.status === "refunded") toast(`🎲 Your bet on @${owner} was refunded`, "", 4000);
      else toast(`💸 Your ${PICKS[b.pick]?.label} bet on @${owner} lost`, "", 4000);
      listeners.settled.forEach((fn) => fn(b));
    });
    room.on("status", (s) => {
      if (s === "offline") toast("Lost the connection to the bar. Reconnecting...", "error");
    });
    room.ready
      .then(async () => {
        const hist = await room.history();
        hist.forEach(addMessage);
        systemMessage(`You walked into ${lobby.name}.`);
        if (cryptoKey && hist.length && hist.every((m) => m.failed)) {
          toast("Your key doesn't open this bar's messages. Check the invite and re-enter it.", "error", 7000);
          keyring.forget(lobby.code);
        }
      })
      .catch((err) => errorToast(err));

    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      const emote = text.startsWith("/") && EMOTES.find(([k]) => k === text.slice(1).toLowerCase());
      chatInput.value = "";
      if (emote) {
        doEmote(emote[0]);
        return;
      }
      try {
        await room.say(text.slice(0, 500));
      } catch (err) {
        chatInput.value = text;
        errorToast(err);
      }
    });

    cleanup.push(backend.on("profile", () => room?.updateLook()));
    const ticker = setInterval(() => {
      renderHere();
      panes.here.querySelectorAll("[data-since]").forEach((el) => {
        el.textContent = fmtClock((Date.now() - new Date(el.dataset.since).getTime()) / 1000);
      });
    }, 1000);
    cleanup.push(() => clearInterval(ticker));
    stageArea.addEventListener("pointerdown", () => sidebar.classList.remove("open"));
  }

  return {
    destroy() {
      destroyed = true;
      darts?.close?.();
      cleanup.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
      room?.close();
      stage?.destroy();
      document.querySelectorAll(".menu").forEach((m) => m.remove());
    },
  };
}
