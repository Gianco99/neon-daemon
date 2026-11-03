import { h, toast, errorToast, modal } from "../lib/dom.js";
import { DRINKS } from "../looks.js";
import { portrait } from "./common.js";
import { openCustomize } from "./customize.js";

export function openProfile(backend, peer, { friends = [], onEmote, onSaved } = {}) {
  const isMe = peer.id === backend.user?.id;
  const m = modal({ title: isMe ? "That's you" : `@${peer.handle}` });
  const rel = friends.find((f) => f.id === peer.id)?.relation;
  const card = h(
    "div",
    { class: "profile-card" },
    portrait(peer.look, { size: 40, full: true }),
    h(
      "div",
      null,
      h("div", { class: "handle" }, `@${peer.handle}`),
      h("div", { class: "muted" }, `Drinks: ${DRINKS[peer.look?.drink]?.name || "water"}`),
      rel === "friend" ? h("span", { class: "badge mint" }, "friend") : rel === "outgoing" ? h("span", { class: "badge yellow" }, "request sent") : null,
    ),
  );
  const actions = h("div", { class: "row" });
  if (isMe) {
    actions.append(h("button", { class: "btn primary", onclick: () => { m.close(); openCustomize(backend, { onSaved }); } }, "🎨 Customize"));
  } else {
    actions.append(
      h("button", { class: "btn cyan", onclick: () => { onEmote?.("wave", peer.id); m.close(); } }, "👋 Wave"),
      h("button", { class: "btn yellow", onclick: () => {
        onEmote?.("drink", peer.id);
        toast(`🍹 You sent @${peer.handle} a ${DRINKS[peer.look?.drink]?.name || "drink"}`, "gold");
        m.close();
      } }, "🍹 Send a drink"),
    );
    if (!rel || rel === "incoming") {
      actions.append(h("button", { class: "btn primary", onclick: async () => {
        try {
          const res = await backend.addFriend(peer.handle);
          toast(res === "accepted" ? `You and @${peer.handle} are friends now` : `Request sent to @${peer.handle}`, "pink");
          m.close();
        } catch (err) {
          errorToast(err);
        }
      } }, rel === "incoming" ? "Accept friend request" : "＋ Add friend"));
    }
  }
  m.body.append(card, actions);
}
