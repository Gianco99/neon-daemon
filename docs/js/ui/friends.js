import { h, replace, toast, errorToast, modal } from "../lib/dom.js";
import { fmtAgo, fmtClock } from "../lib/util.js";
import { portrait, stateBadge } from "./common.js";

const RESULT = {
  requested: (h) => `Request sent to @${h}`,
  accepted: (h) => `You and @${h} are friends now`,
  already: (h) => `You and @${h} are already friends`,
  pending: (h) => `Still waiting on @${h}`,
};

export function agentRows(agents) {
  return (agents || []).map((a) => {
    const since = a.turn_started_at && a.state !== "idle" ? h("span", { class: "timer", dataset: { since: a.turn_started_at } }, fmtClock((Date.now() - new Date(a.turn_started_at).getTime()) / 1000)) : null;
    return h("div", { class: "agent-row" }, stateBadge(a.state), h("span", { class: "lbl" }, a.label || "agent"), since);
  });
}

export function friendsPanel(backend, { onJoin, currentLobbyId = null } = {}) {
  const list = h("div", null, h("div", { class: "empty" }, "Looking for your crew..."));
  const input = h("input", { class: "input", placeholder: "@handle", autocomplete: "off", maxLength: 21 });
  const add = h("button", { class: "btn small cyan", type: "submit" }, "Add");
  const form = h("form", { class: "add-friend" }, input, add);
  let latest = [];

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const handle = input.value.trim().replace(/^@/, "").toLowerCase();
    if (!handle) return;
    try {
      const res = await backend.addFriend(handle);
      toast((RESULT[res] || RESULT.requested)(handle), "pink");
      input.value = "";
      refresh();
    } catch (err) {
      errorToast(err);
    }
  });

  const confirmRemove = (f) => {
    const m = modal({ title: `Unfriend @${f.handle}?` });
    m.body.append(
      h("p", null, "They won't be notified. You can always add them back."),
      h("div", { class: "row mt" },
        h("button", { class: "btn", onclick: async () => {
          try {
            await backend.removeFriend(f.id);
            m.close();
            refresh();
          } catch (err) {
            errorToast(err);
          }
        } }, "Unfriend"),
        h("button", { class: "btn ghost", onclick: () => m.close() }, "Keep")),
    );
  };

  function row(f) {
    const acts = h("div", { class: "acts" });
    let sub = f.status_text || "";
    if (f.relation === "incoming") {
      sub = "wants to be friends";
      acts.append(
        h("button", { class: "btn small mint", onclick: async () => { await backend.respondFriend(f.id, true).catch(errorToast); refresh(); } }, "Accept"),
        h("button", { class: "btn small ghost", onclick: async () => { await backend.respondFriend(f.id, false).catch(errorToast); refresh(); } }, "✕"),
      );
    } else if (f.relation === "outgoing") {
      sub = "request sent";
      acts.append(h("button", { class: "btn small ghost", title: "Cancel request", onclick: async () => { await backend.removeFriend(f.id).catch(errorToast); refresh(); } }, "✕"));
    } else {
      if (f.lobby) sub = `at ${f.lobby.name}${f.lobby.is_private ? " 🔒" : ""}`;
      else if (!f.online) sub = f.last_seen ? `seen ${fmtAgo(f.last_seen)}` : "offline";
      if (f.lobby && f.lobby.id !== currentLobbyId && onJoin) acts.append(h("button", { class: "btn small primary", onclick: () => onJoin(f.lobby) }, "Join"));
      acts.append(h("button", { class: "btn small ghost", title: "Unfriend", onclick: () => confirmRemove(f) }, "⋯"));
    }
    return h(
      "div",
      null,
      h(
        "div",
        { class: "person" },
        portrait(f.look),
        h("div", { style: { minWidth: "0" } },
          h("div", { class: "who" }, h("span", { class: `dot${f.online ? " on" : ""}` }), ` @${f.handle}`),
          h("div", { class: "sub" }, sub)),
        acts,
      ),
      f.relation === "friend" ? agentRows(f.agents) : null,
    );
  }

  function render(friends) {
    latest = friends;
    const incoming = friends.filter((f) => f.relation === "incoming");
    const mates = friends.filter((f) => f.relation === "friend");
    const outgoing = friends.filter((f) => f.relation === "outgoing");
    const out = [];
    if (incoming.length) out.push(h("div", { class: "group-title" }, `Requests · ${incoming.length}`), incoming.map(row));
    out.push(h("div", { class: "group-title" }, `Friends · ${mates.filter((f) => f.online).length} online`));
    out.push(mates.length ? mates.map(row) : h("div", { class: "empty" }, "No friends yet. Add someone by handle."));
    if (outgoing.length) out.push(h("div", { class: "group-title" }, "Pending"), outgoing.map(row));
    replace(list, out);
  }

  async function refresh() {
    try {
      render(await backend.friends());
    } catch (err) {
      replace(list, h("div", { class: "empty" }, "Couldn't load friends."));
    }
  }

  const stop = backend.watchFriends(render);
  const tick = setInterval(() => {
    list.querySelectorAll("[data-since]").forEach((el) => {
      el.textContent = fmtClock((Date.now() - new Date(el.dataset.since).getTime()) / 1000);
    });
  }, 1000);

  return {
    el: h("div", null, form, list),
    refresh,
    get friends() { return latest; },
    destroy() {
      stop();
      clearInterval(tick);
    },
  };
}
