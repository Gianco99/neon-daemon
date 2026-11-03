import { h, toast, errorToast, modal, busy } from "../lib/dom.js";
import { drawDaemon, drawDrone } from "../scene/sprites.js";
import { BODY_COLORS, VISOR_COLORS, EYE_COLORS, OUTFIT_COLORS, EYES, HATS, OUTFITS, ACCESSORIES, DRINKS, NAMES, randomLook } from "../looks.js";

function swatches(colors, get, set) {
  const wrap = h("div", { class: "swatches" });
  const render = () => {
    wrap.replaceChildren(...colors.map((c) => h("button", {
      class: `swatch${get() === c ? " on" : ""}`, type: "button", title: c, "aria-label": c,
      style: { background: c }, onclick: () => { set(c); render(); },
    })));
  };
  render();
  return { el: wrap, render };
}

function pills(options, labels, get, set) {
  const wrap = h("div", { class: "pills" });
  const render = () => {
    wrap.replaceChildren(...options.map((o) => h("button", {
      class: `pill${get() === o ? " on" : ""}`, type: "button", onclick: () => { set(o); render(); },
    }, labels[o] || o)));
  };
  render();
  return { el: wrap, render };
}

function group(label, control) {
  return h("div", { class: "opt-group" }, h("div", { class: "label" }, label), control.el);
}

export function openCustomize(backend, { onSaved } = {}) {
  const p = backend.profile;
  if (!p) return;
  let look = { ...p.look };
  let action = "idle";
  let raf = 0;
  const m = modal({ title: "Customize your daemon", wide: true, onClose: () => cancelAnimationFrame(raf) });

  const canvas = h("canvas", { width: 46, height: 46, "aria-label": "Preview" });
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const start = performance.now();
  const draw = (now) => {
    raf = requestAnimationFrame(draw);
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, 46, 46);
    drawDaemon(ctx, 19, 42, look, { t, action, facing: 1 });
    drawDrone(ctx, 36, 40, look, { t, state: "idle", facing: -1, seed: 2 });
  };
  raf = requestAnimationFrame(draw);

  const actionPills = pills(["idle", "walk", "wave", "sip", "dance"], { idle: "Idle", walk: "Walk", wave: "Wave", sip: "Sip", dance: "Dance" }, () => action, (v) => { action = v; });
  const controls = [];
  const bind = (key) => [() => look[key], (v) => { look = { ...look, [key]: v }; }];
  const add = (label, control) => {
    controls.push(control);
    return group(label, control);
  };

  const name = h("input", { class: "input", maxLength: 32, value: p.display_name || "", placeholder: "Display name" });
  const status = h("input", { class: "input", maxLength: 80, value: p.status_text || "", placeholder: "What are your agents up to?" });
  const handle = h("input", { class: "input", maxLength: 20, value: p.handle, autocomplete: "off" });
  handle.addEventListener("input", () => { handle.value = handle.value.toLowerCase().replace(/[^a-z0-9_]/g, ""); });

  const save = h("button", { class: "btn primary", type: "button" }, "Save");
  save.addEventListener("click", busy(save, async () => {
    save.textContent = "Saving...";
    try {
      const patch = { look, display_name: name.value.trim(), status_text: status.value.trim() };
      if (handle.value !== p.handle) patch.handle = handle.value;
      await backend.updateProfile(patch);
      toast("Looking sharp ✨", "pink");
      onSaved?.();
      m.close();
    } catch (err) {
      errorToast(err);
    }
  }));
  const shuffle = h("button", { class: "btn cyan", type: "button", onclick: () => { look = randomLook(); controls.forEach((c) => c.render()); } }, "🎲 Randomize");

  m.body.append(
    h(
      "div",
      { class: "customize" },
      h("div", { class: "preview-box" }, canvas, actionPills.el, h("div", { class: "row" }, shuffle, save)),
      h(
        "div",
        null,
        add("Chassis", swatches(BODY_COLORS, ...bind("body"))),
        add("Visor", swatches(VISOR_COLORS, ...bind("visor"))),
        add("Eye glow", swatches(EYE_COLORS, ...bind("eyeColor"))),
        add("Eyes", pills(EYES, NAMES, ...bind("eyes"))),
        add("Hat", pills(HATS, NAMES, ...bind("hat"))),
        add("Fit", pills(OUTFITS, NAMES, ...bind("outfit"))),
        add("Fit color", swatches(OUTFIT_COLORS, ...bind("outfitColor"))),
        add("Accessory", pills(ACCESSORIES, NAMES, ...bind("accessory"))),
        add("Usual drink", pills(Object.keys(DRINKS), Object.fromEntries(Object.entries(DRINKS).map(([k, d]) => [k, d.name])), ...bind("drink"))),
        h("div", { class: "field" }, h("label", null, "Handle"), handle),
        h("div", { class: "field" }, h("label", null, "Display name"), name),
        h("div", { class: "field" }, h("label", null, "Status"), status),
      ),
    ),
  );
}
