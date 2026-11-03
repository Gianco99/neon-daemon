import config from "../../config.js";
import { h } from "../lib/dom.js";
import { renderPortrait } from "../scene/sprites.js";

export function navigate(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = hash;
}

export function brand(onclick) {
  const [first, ...rest] = config.appName.split(" ");
  return h(
    "div",
    { class: "brand", onclick, title: config.appName, role: onclick ? "link" : null },
    h("span", { class: "script" }, first),
    h("span", { class: "block" }, rest.join(" ")),
  );
}

export function portrait(look, { size = 24, full = false } = {}) {
  const c = document.createElement("canvas");
  renderPortrait(c, look, { size, full });
  return c;
}

export function stateBadge(state) {
  const text = { working: "working", waiting: "needs you", idle: "chilling", offline: "offline" }[state] || state;
  return h("span", { class: `state ${state}` }, text);
}

export function siteUrl() {
  return location.origin + location.pathname;
}

export function inviteLink(code, key) {
  return `${siteUrl()}#/join/${code}${key ? `/${key}` : ""}`;
}

export function menuPopover(anchor, items) {
  document.querySelectorAll(".menu").forEach((m) => m.remove());
  const menu = h(
    "div",
    { class: "panel menu", role: "menu" },
    items.map((it) => h("button", { role: "menuitem", onclick: () => { menu.remove(); it.run(); } }, it.icon ? `${it.icon}  ` : "", it.label)),
  );
  const r = anchor.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.top = `${r.bottom + 8}px`;
  menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  document.body.append(menu);
  const close = (e) => {
    if (!menu.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) {
      menu.remove();
      document.removeEventListener("pointerdown", close, true);
    }
  };
  setTimeout(() => document.addEventListener("pointerdown", close, true), 0);
  return menu;
}

export function mePill(backend, items) {
  const canvas = document.createElement("canvas");
  const name = h("span");
  const pill = h("button", { class: "me-pill", "aria-haspopup": "menu", title: "Your daemon" }, canvas, name);
  const chips = h("span", { class: "chips-count", title: "Bar chips" });
  const update = () => {
    const p = backend.profile;
    if (!p) return;
    renderPortrait(canvas, p.look, { size: 24 });
    name.textContent = `@${p.handle}`;
    chips.textContent = `🪙 ${p.chips ?? 0}`;
  };
  update();
  const off = backend.on("profile", update);
  pill.addEventListener("click", () => menuPopover(pill, items()));
  return { pill, chips, destroy: off };
}
