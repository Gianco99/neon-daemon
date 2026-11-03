import { h, replace, toast, errorToast, errorMessage, modal, copyRow, busy } from "../lib/dom.js";
import { newLobbyKey, keyProof, parseInvite, lobbyCodeLabel, groupCode } from "../lib/crypto.js";
import { keyring } from "../lib/store.js";
import { mountBackdrop } from "../scene/backdrop.js";
import { brand, navigate, mePill, inviteLink } from "./common.js";
import { friendsPanel } from "./friends.js";
import { openCustomize } from "./customize.js";
import { openLinkClaude } from "./link.js";

export function userMenu(backend) {
  return () => [
    { icon: "🎨", label: "Customize your daemon", run: () => openCustomize(backend) },
    { icon: "🔗", label: "Link Claude Code", run: () => openLinkClaude(backend) },
    { icon: "🍸", label: "Bars", run: () => navigate("#/") },
    { icon: "🚪", label: "Sign out", run: () => backend.signOut() },
  ];
}

export function showInvite(lobby, key) {
  const m = modal({ title: lobby.is_private ? "Your private bar is open" : "Your bar is open" });
  const link = inviteLink(lobby.code, key);
  const parts = [
    h("p", null, lobby.is_private
      ? "Share the invite link with friends. The key in it unlocks the door and encrypts the chat. It never reaches the server, so keep it somewhere safe."
      : "Anyone can find this bar in the public list, or join with the code."),
    h("div", { class: "field" }, h("label", null, "Invite link"), copyRow(link)),
    h("div", { class: "field" }, h("label", null, "Code"), copyRow(lobby.code, lobbyCodeLabel(lobby.code))),
  ];
  if (key) parts.push(h("div", { class: "field" }, h("label", null, "Key"), copyRow(key)));
  parts.push(h("button", { class: "btn primary block mt", onclick: () => { m.close(); navigate(`#/bar/${lobby.code}`); } }, "Walk in"));
  m.body.append(...parts);
}

export function askForKey(lobbyName, code) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({ title: "This bar has a lock", onClose: () => { if (!done) resolve(null); } });
    const input = h("input", { class: "input mono-code", placeholder: "XXXX-XXXX-XXXX-XXXX-XXXX", autocomplete: "off" });
    const go = h("button", { class: "btn primary block mt", type: "submit" }, "Unlock");
    const form = h("form", null,
      h("p", null, `${lobbyName || lobbyCodeLabel(code)} is private. Paste the key from your invite. It stays in this browser.`),
      input, go);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const key = groupCode(input.value);
      if (key.replace(/-/g, "").length < 20) {
        toast("That key looks too short.", "error");
        return;
      }
      done = true;
      m.close();
      resolve(key);
    });
    m.body.append(form);
    setTimeout(() => input.focus(), 50);
  });
}

function lobbyCard(lobby, { onEnter, onLeave }) {
  const meta = h(
    "div",
    { class: "meta" },
    h("span", { class: "chip", title: "Copy code", onclick: (e) => { e.stopPropagation(); navigator.clipboard?.writeText(lobby.code); toast("Code copied", "", 1600); } }, lobbyCodeLabel(lobby.code)),
    lobby.is_private ? h("span", { class: "badge pink", title: "Key required, chat end-to-end encrypted" }, "🔒 private") : h("span", { class: "badge cyan" }, "public"),
    h("span", null, h("span", { class: `dot${lobby.here ? " on" : ""}` }), ` ${lobby.here || 0} here`),
    h("span", null, `${lobby.members} member${lobby.members === 1 ? "" : "s"}`),
    lobby.owner_handle ? h("span", null, `by @${lobby.owner_handle}`) : null,
  );
  const actions = h("div", { class: "row" }, h("button", { class: "btn small primary", onclick: () => onEnter(lobby) }, "Enter"));
  if (onLeave) actions.append(h("button", { class: "btn small ghost", title: lobby.role === "owner" ? "Close or leave" : "Leave", onclick: () => onLeave(lobby) }, "✕"));
  return h(
    "div",
    { class: "lobby-card" },
    h("div", { class: "sign" }, (lobby.name || "?").trim().charAt(0).toUpperCase()),
    h("div", { style: { minWidth: "0" } }, h("div", { class: "name" }, lobby.name), meta),
    actions,
  );
}

export function renderLobbies(app, backend) {
  const screen = h("div", { class: "screen" });
  const backdrop = mountBackdrop(screen, { dim: true });
  const me = mePill(backend, userMenu(backend));
  const header = h("header", { class: "app-header" }, brand(() => navigate("#/")), h("div", { class: "spacer" }), me.chips, me.pill);
  const publicList = h("div", { class: "lobby-list" }, h("div", { class: "empty" }, "Finding open bars..."));
  const mineList = h("div", { class: "lobby-list" });
  const friends = friendsPanel(backend, { onJoin: (lobby) => navigate(`#/bar/${lobby.code}`) });

  const enter = async (lobby) => {
    if (lobby.is_private && !keyring.get(lobby.code)) {
      const key = await askForKey(lobby.name, lobby.code);
      if (!key) return;
      keyring.set(lobby.code, key);
    }
    navigate(`#/bar/${lobby.code}`);
  };

  const leave = (lobby) => {
    const m = modal({ title: `Leave ${lobby.name}?` });
    const owner = lobby.role === "owner";
    m.body.append(
      h("p", null, owner ? "You own this bar. Leaving hands it to the longest-standing member, or closes it if you're the last one." : "You can rejoin later with the code (and the key, if it's private)."),
      h("div", { class: "row mt" },
        h("button", { class: "btn", onclick: async () => {
          try {
            await backend.leaveLobby(lobby.id);
            keyring.forget(lobby.code);
            m.close();
            refresh();
          } catch (err) {
            errorToast(err);
          }
        } }, "Leave"),
        owner ? h("button", { class: "btn cyan", onclick: async () => {
          try {
            await backend.deleteLobby(lobby.id);
            keyring.forget(lobby.code);
            m.close();
            refresh();
          } catch (err) {
            errorToast(err);
          }
        } }, "Close it for everyone") : null,
        h("button", { class: "btn ghost", onclick: () => m.close() }, "Stay")),
    );
  };

  async function refresh() {
    try {
      const [pub, mine] = await Promise.all([backend.publicLobbies(), backend.myLobbies()]);
      replace(publicList, pub.length ? pub.map((l) => lobbyCard(l, { onEnter: enter })) : h("div", { class: "empty" }, "No public bars yet. Open the first one."));
      replace(mineList, mine.length ? mine.map((l) => lobbyCard(l, { onEnter: enter, onLeave: leave })) : h("div", { class: "empty" }, "You haven't joined any bars yet."));
    } catch (err) {
      replace(publicList, h("div", { class: "empty" }, errorMessage(err)));
    }
  }

  const inviteInput = h("input", { class: "input mono-code", placeholder: "CODE  or  CODE KEY  or invite link", autocomplete: "off" });
  const joinBtn = h("button", { class: "btn cyan", type: "submit" }, "Join");
  const joinForm = h("form", { class: "row" }, h("div", { class: "grow" }, inviteInput), joinBtn);
  joinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const { code, key } = parseInvite(inviteInput.value);
    if (code.length !== 6) {
      toast("Codes are 6 characters, like ABC-123.", "error");
      return;
    }
    if (key) keyring.set(code, key);
    navigate(`#/bar/${code}`);
  });

  let isPrivate = false;
  const pubBtn = h("button", { class: "btn small on", type: "button" }, "🌴 Public");
  const privBtn = h("button", { class: "btn small", type: "button" }, "🔒 Private");
  const setPrivacy = (p) => {
    isPrivate = p;
    pubBtn.classList.toggle("on", !p);
    privBtn.classList.toggle("on", p);
    privacyHint.textContent = p
      ? "Unlisted. Friends need the invite key, and chat is end-to-end encrypted with it."
      : "Listed for everyone. Anyone can walk in.";
  };
  pubBtn.addEventListener("click", () => setPrivacy(false));
  privBtn.addEventListener("click", () => setPrivacy(true));
  const privacyHint = h("p", { class: "hint" });
  const nameInput = h("input", { class: "input", placeholder: "Midnight Debug Club", maxLength: 40, autocomplete: "off" });
  const createBtn = h("button", { class: "btn primary block", type: "submit" }, "Open the bar");
  const createForm = h("form", null, h("div", { class: "field" }, h("label", null, "Name"), nameInput), h("div", { class: "toggle-row" }, pubBtn, privBtn), privacyHint, h("div", { class: "mt" }, createBtn));
  setPrivacy(false);
  createForm.addEventListener("submit", (e) => {
    e.preventDefault();
    busy(createBtn, async () => {
      const name = nameInput.value.trim();
      if (!name) {
        toast("Give your bar a name.", "error");
        return;
      }
      createBtn.textContent = "Hanging the neon...";
      try {
        const key = isPrivate ? newLobbyKey() : "";
        const lobby = await backend.createLobby({ name, isPrivate, proof: isPrivate ? await keyProof(key) : null });
        if (key) keyring.set(lobby.code, key);
        nameInput.value = "";
        refresh();
        showInvite(lobby, key);
      } catch (err) {
        errorToast(err);
      }
    })();
  });

  screen.append(
    header,
    h(
      "main",
      { class: "lobbies" },
      h(
        "div",
        { class: "col" },
        h("section", { class: "panel panel-pad" },
          h("div", { class: "section-title" }, h("h2", null, "Open bars"), h("div", { class: "spacer" }), h("button", { class: "btn small cyan", onclick: refresh }, "↻ Refresh")),
          publicList),
        h("section", { class: "panel panel-pad" }, h("h2", null, "Your bars"), mineList),
      ),
      h(
        "div",
        { class: "col" },
        h("section", { class: "panel panel-pad" }, h("h2", null, "Join with an invite"), joinForm, h("p", { class: "hint" }, "Private bars need the key from the invite.")),
        h("section", { class: "panel panel-pad" }, h("h2", null, "Open your own bar"), createForm),
        h("section", { class: "panel panel-pad" }, h("h2", null, "Friends"), friends.el),
      ),
    ),
  );
  app.replaceChildren(screen);
  refresh();
  const timer = setInterval(refresh, 20000);
  return {
    destroy() {
      clearInterval(timer);
      backdrop.destroy();
      me.destroy();
      friends.destroy();
      document.querySelectorAll(".menu").forEach((m) => m.remove());
    },
  };
}
