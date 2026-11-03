import { h, replace, toast, errorToast, modal, busy } from "../lib/dom.js";
import { DRINKS, activeBuff } from "../looks.js";
import { fmtClock } from "../lib/util.js";

export function buffChip(backend, onclick) {
  const el = h("button", { class: "badge yellow hidden", title: "Active drink", onclick });
  const tick = () => {
    const buff = activeBuff(backend.profile);
    el.classList.toggle("hidden", !buff);
    if (buff) el.textContent = `${buff.emoji} ${buff.title} ${fmtClock((new Date(buff.until).getTime() - Date.now()) / 1000)}`;
  };
  tick();
  const timer = setInterval(tick, 1000);
  const off = backend.on("profile", tick);
  return { el, destroy: () => { clearInterval(timer); off(); } };
}

export function openBarMenu(backend, { onOrder } = {}) {
  const m = modal({ title: "The bar", wide: true, onClose: () => off() });
  const list = h("div", { class: "drink-list" });
  const header = h("div", { class: "row" });
  const render = () => {
    const chips = backend.profile?.chips ?? 0;
    const buff = activeBuff(backend.profile);
    replace(
      header,
      h("span", { class: "chips-count" }, `🪙 ${chips}`),
      buff ? h("span", { class: "badge yellow" }, `${buff.emoji} ${buff.title} active`) : h("span", { class: "muted" }, "One drink at a time. A new one replaces the last."),
    );
    replace(list, Object.entries(DRINKS).map(([id, d]) => {
      const order = h("button", { class: "btn small primary", disabled: chips < d.price }, `Order · 🪙${d.price}`);
      order.addEventListener("click", busy(order, async () => {
        try {
          await backend.orderDrink(id);
          toast(`${d.emoji} ${d.name}: ${d.title} for ${d.minutes} min`, "gold", 4200);
          onOrder?.(id);
          m.close();
        } catch (err) {
          errorToast(err);
        }
      }));
      return h(
        "div",
        { class: `drink-card${buff?.id === id ? " on" : ""}` },
        h("div", { class: "drink-emoji", style: { textShadow: `0 0 14px ${d.color}` } }, d.emoji),
        h("div", { style: { minWidth: "0" } },
          h("div", { class: "drink-name" }, d.name, h("span", { class: "muted" }, ` · ${d.minutes} min`)),
          h("div", null, h("b", { style: { color: d.color } }, `${d.title}: `), d.text)),
        order,
      );
    }));
  };
  const off = backend.on("profile", render);
  m.body.append(header, list, h("p", { class: "hint" }, "Drinks give you a glow everyone in the bar can see, plus a perk while they last."));
  render();
}
