import { h, toast, errorToast, modal, busy } from "../lib/dom.js";
import { drawDaemon, drawDrone } from "../scene/sprites.js";
import { itemsOf, owns, lockedParts, randomOwnedLook } from "../looks.js";

const SECTIONS = [
  ["You", [["body", "Chassis", "swatch"], ["visor", "Visor", "swatch"], ["eyeColor", "Eye glow", "swatch"], ["eyes", "Eyes", "pill"], ["hat", "Hat", "pill"], ["outfit", "Fit", "pill"], ["outfitColor", "Fit color", "swatch"], ["accessory", "Accessory", "pill"]]],
  ["Your drone", [["droneBody", "Drone chassis", "swatch"], ["droneStyle", "Drone style", "pill"]]],
];

export function openCustomize(backend, { onSaved } = {}) {
  const p = backend.profile;
  if (!p) return;
  let look = { ...p.look };
  let unlocks = new Set();
  let action = "idle";
  let raf = 0;
  const m = modal({ title: "Wardrobe", wide: true, onClose: () => cancelAnimationFrame(raf) });

  const canvas = h("canvas", { width: 46, height: 46, "aria-label": "Preview" });
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const start = performance.now();
  const draw = (now) => {
    raf = requestAnimationFrame(draw);
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, 46, 46);
    drawDaemon(ctx, 18, 42, look, { t, action, facing: 1 });
    drawDrone(ctx, 36, 40, look, { t, state: "idle", facing: -1, seed: 2 });
  };
  raf = requestAnimationFrame(draw);

  const controls = [];
  const chips = h("div", { class: "chips-count" });
  const status = h("p", { class: "hint" });
  const save = h("button", { class: "btn primary", type: "button" }, "Save");

  function refresh() {
    controls.forEach((c) => c());
    const locked = lockedParts(look, unlocks);
    const cost = locked.reduce((s, item) => s + item.price, 0);
    const have = backend.profile?.chips ?? 0;
    chips.textContent = `🪙 ${have}`;
    if (!locked.length) {
      save.textContent = "Save";
      save.disabled = false;
      status.textContent = "Everything you're wearing is yours.";
    } else {
      save.textContent = `Unlock ${locked.length} for 🪙 ${cost} & save`;
      save.disabled = cost > have;
      status.textContent = cost > have
        ? `You're trying on ${locked.map((i) => i.name).join(", ")}. You need ${cost - have} more chips.`
        : `Trying on ${locked.map((i) => i.name).join(", ")}.`;
    }
  }

  function option(kind, item, kindOfControl) {
    const mine = owns(unlocks, kind, item.value);
    const on = look[kind] === item.value;
    const tip = `${item.name}${mine ? "" : ` · 🔒 ${item.price}`}`;
    if (kindOfControl === "swatch") {
      return h("button", {
        class: `swatch${on ? " on" : ""}${mine ? "" : " locked"}`, type: "button", title: tip, "aria-label": tip,
        style: { background: item.value }, onclick: () => { look = { ...look, [kind]: item.value }; refresh(); },
      }, mine ? null : "🔒");
    }
    return h("button", {
      class: `pill${on ? " on" : ""}${mine ? "" : " locked"}`, type: "button", title: tip,
      onclick: () => { look = { ...look, [kind]: item.value }; refresh(); },
    }, item.name, mine ? null : h("span", { class: "price" }, ` 🔒${item.price}`));
  }

  function group(kind, label, kindOfControl) {
    const wrap = h("div", { class: kindOfControl === "swatch" ? "swatches" : "pills" });
    const render = () => wrap.replaceChildren(...itemsOf(kind).map((item) => option(kind, item, kindOfControl)));
    controls.push(render);
    return h("div", { class: "opt-group" }, h("div", { class: "label" }, label), wrap);
  }

  const actions = ["idle", "walk", "wave", "sip", "dance"];
  const actionRow = h("div", { class: "pills" });
  const renderActions = () => actionRow.replaceChildren(...actions.map((a) => h("button", {
    class: `pill${action === a ? " on" : ""}`, type: "button", onclick: () => { action = a; renderActions(); },
  }, a[0].toUpperCase() + a.slice(1))));
  renderActions();

  const name = h("input", { class: "input", maxLength: 32, value: p.display_name || "", placeholder: "Display name" });
  const statusText = h("input", { class: "input", maxLength: 80, value: p.status_text || "", placeholder: "What are your agents up to?" });
  const handle = h("input", { class: "input", maxLength: 20, value: p.handle, autocomplete: "off" });
  handle.addEventListener("input", () => { handle.value = handle.value.toLowerCase().replace(/[^a-z0-9_]/g, ""); });

  save.addEventListener("click", busy(save, async () => {
    try {
      const locked = lockedParts(look, unlocks);
      for (const item of locked) {
        save.textContent = `Unlocking ${item.name}...`;
        await backend.buyItem(item.kind, item.value);
        unlocks.add(`${item.kind}:${item.value}`);
      }
      save.textContent = "Saving...";
      const patch = { look, display_name: name.value.trim(), status_text: statusText.value.trim() };
      if (handle.value !== p.handle) patch.handle = handle.value;
      await backend.updateProfile(patch);
      toast(locked.length ? `Unlocked ${locked.map((i) => i.name).join(", ")} ✨` : "Looking sharp ✨", "pink");
      onSaved?.();
      m.close();
    } catch (err) {
      errorToast(err);
      refresh();
    }
  }));

  const shuffle = h("button", { class: "btn cyan", type: "button", onclick: () => { look = randomOwnedLook(unlocks); refresh(); } }, "🎲 Shuffle mine");

  m.body.append(
    h(
      "div",
      { class: "customize" },
      h("div", { class: "preview-box" }, canvas, actionRow, chips, h("div", { class: "row" }, shuffle, save), status,
        h("p", { class: "hint center" }, "Tap anything to try it on. Locked items unlock with chips you earn in the bar.")),
      h(
        "div",
        null,
        SECTIONS.map(([title, groups]) => [h("h3", { class: "mt" }, title), groups.map(([kind, label, type]) => group(kind, label, type))]),
        h("h3", { class: "mt" }, "Profile"),
        h("div", { class: "field" }, h("label", null, "Handle"), handle),
        h("div", { class: "field" }, h("label", null, "Display name"), name),
        h("div", { class: "field" }, h("label", null, "Status"), statusText),
      ),
    ),
  );
  refresh();
  backend.unlocks().then((set) => {
    unlocks = set;
    refresh();
  }).catch(() => null);
}
