import { h, replace, toast, errorToast, modal, busy } from "../lib/dom.js";
import { fmtClock, fmtAgo, PICKS, BET_WINDOW_S } from "../lib/util.js";
import { portrait, stateBadge } from "./common.js";

function elapsedOf(agent) {
  return agent.turn_started_at ? (Date.now() - new Date(agent.turn_started_at).getTime()) / 1000 : 0;
}

export function bettable(agent, meId) {
  return agent.ownerId !== meId && (agent.state === "working" || agent.state === "waiting") && elapsedOf(agent) <= BET_WINDOW_S;
}

export function openBets(backend, ctx) {
  const m = modal({ title: "Bet booth", wide: true, onClose: () => cleanup() });
  const chipsLine = h("div", { class: "row" });
  const floor = h("div");
  const history = h("div");
  const cards = new Map();
  let closed = false;

  const renderChips = () => {
    const chips = backend.profile?.chips ?? 0;
    const top = h("button", { class: "btn small yellow" }, "Ask the bartender for chips");
    top.addEventListener("click", busy(top, async () => {
      try {
        const n = await backend.topUp();
        toast(`🪙 The bartender slides over 250 chips. You have ${n}.`, "gold");
      } catch (err) {
        errorToast(err);
      }
    }));
    replace(chipsLine, h("span", { class: "chips-count" }, `🪙 ${chips} chips`), chips < 100 ? top : null);
  };

  function makeCard(agent) {
    const owner = ctx.peer(agent.ownerId);
    const state = { pick: null, amount: 50 };
    const timer = h("span", { class: "timer" });
    const badge = h("span");
    const pot = h("span", { class: "muted" });
    const amount = h("input", { type: "range", min: 10, max: 500, step: 10, value: 50 });
    const amountLabel = h("b", { class: "mono", style: { minWidth: "64px", textAlign: "right" } }, "50");
    const place = h("button", { class: "btn small primary" }, "Place bet");
    const pickButtons = new Map();
    const pickGroup = (keys, cls) => h("div", { class: `bet-picks${cls}` }, keys.map((k) => {
      const b = h("button", { class: "bet-pick", type: "button" }, h("b", null, `${PICKS[k].label} ×${PICKS[k].odds}`), h("span", null, PICKS[k].hint));
      b.addEventListener("click", () => {
        state.pick = k;
        pickButtons.forEach((el, key) => el.classList.toggle("on", key === k));
      });
      pickButtons.set(k, b);
      return b;
    }));
    amount.addEventListener("input", () => {
      state.amount = Number(amount.value);
      amountLabel.textContent = String(state.amount);
    });
    place.addEventListener("click", busy(place, async () => {
      if (!state.pick) {
        toast("Pick an outcome first.", "error");
        return;
      }
      place.textContent = "Rolling...";
      try {
        await backend.placeBet(agent.ownerId, agent.session_key, state.pick, state.amount);
        toast(`🎲 ${state.amount} on ${PICKS[state.pick].label} for @${owner?.handle || "?"}'s agent`, "gold");
        ctx.announce?.(`bet ${state.amount} chips on @${owner?.handle || "?"}'s agent: ${PICKS[state.pick].label}`);
        loadHistory();
      } catch (err) {
        errorToast(err);
      }
    }));
    const permGroup = pickGroup(["permission", "clean"], " two");
    const el = h(
      "div",
      { class: "bet-agent" },
      h("div", { class: "top" }, portrait(owner?.look || agent.look), h("div", { class: "who" }, `@${owner?.handle || "?"}`, h("span", { class: "muted" }, ` · ${agent.label || "agent"}`)), badge, timer),
      pickGroup(["flash", "grind", "marathon"], ""),
      permGroup,
      h("div", { class: "bet-row" }, amount, amountLabel, place),
      h("div", { class: "row" }, pot),
    );
    const update = (a) => {
      const elapsed = elapsedOf(a);
      const open = bettable(a, ctx.meId);
      replace(badge, stateBadge(a.state));
      timer.textContent = open ? `closes in ${fmtClock(BET_WINDOW_S - elapsed)}` : `on the job ${fmtClock(elapsed)}`;
      place.disabled = !open;
      amount.disabled = !open;
      amount.max = String(Math.max(10, Math.min(1000, backend.profile?.chips ?? 0)));
      permGroup.style.display = a.asked_permission ? "none" : "";
      const bets = ctx.openBets().filter((b) => b.owner_id === a.ownerId && b.session_key === a.session_key && b.turn_no === a.turn_no);
      const total = bets.reduce((s, b) => s + b.amount, 0);
      pot.textContent = bets.length ? `Pot: ${total} chips across ${bets.length} bet${bets.length === 1 ? "" : "s"}` : open ? "No bets yet. Be first." : "Betting closed. Results land when the job ends.";
    };
    return { el, update };
  }

  function renderFloor() {
    const agents = ctx.agents().filter((a) => a.ownerId !== ctx.meId && (a.state === "working" || a.state === "waiting"));
    const keys = new Set(agents.map((a) => `${a.ownerId}:${a.session_key}:${a.turn_no}`));
    for (const [k] of cards) if (!keys.has(k)) cards.delete(k);
    for (const a of agents) {
      const k = `${a.ownerId}:${a.session_key}:${a.turn_no}`;
      if (!cards.has(k)) cards.set(k, makeCard(a));
      cards.get(k).update(a);
    }
    const sorted = agents.sort((a, b) => Number(bettable(b, ctx.meId)) - Number(bettable(a, ctx.meId)) || elapsedOf(a) - elapsedOf(b));
    const els = sorted.map((a) => cards.get(`${a.ownerId}:${a.session_key}:${a.turn_no}`).el);
    if (els.length !== floor.children.length || els.some((el, i) => floor.children[i] !== el)) {
      replace(floor, els.length ? els : h("div", { class: "empty" }, "No other agents on a job right now. When one starts, you have 60 seconds to bet."));
    }
  }

  async function loadHistory() {
    try {
      const bets = await backend.myBets();
      replace(
        history,
        bets.length
          ? bets.slice(0, 12).map((b) => h("div", { class: "history-row" },
            h("span", null, `@${b.owner_handle} · ${PICKS[b.pick]?.label || b.pick} · ${b.amount}`),
            h("span", { class: b.status === "won" ? "won" : b.status === "lost" ? "lost" : "muted" },
              b.status === "open" ? `riding · ${fmtAgo(b.created_at)}` : b.status === "won" ? `+${b.payout}` : b.status === "refunded" ? "refunded" : "lost")))
          : h("p", { class: "hint" }, "No bets yet."),
      );
    } catch {}
  }

  const offs = [ctx.onAgents?.(() => renderFloor()), ctx.onBets?.(() => renderFloor()), ctx.onSettled?.(() => loadHistory()), backend.on("profile", renderChips)];
  const tick = setInterval(() => !closed && renderFloor(), 1000);
  function cleanup() {
    closed = true;
    clearInterval(tick);
    offs.forEach((off) => off?.());
  }

  m.body.append(
    h("p", { class: "hint" }, "Bet chips on how long a friend's agent takes. You get 60 seconds from the start of a job. Time buckets pay 3×, permission bets pay 2×. Chips are just for fun."),
    chipsLine,
    h("h3", { class: "mt" }, "On the floor"),
    floor,
    h("h3", { class: "mt" }, "Your bets"),
    history,
  );
  renderChips();
  renderFloor();
  loadHistory();
}
