import { h, modal } from "../lib/dom.js";
import { settings } from "../lib/store.js";

let jukebox = null;
let loading = null;
let lastTrack = null;

export async function getJukebox() {
  if (jukebox) return jukebox;
  if (!loading) {
    loading = import("../audio/jukebox.js").then(({ createJukebox }) => {
      jukebox = createJukebox();
      jukebox.setVolume(settings.get().volume);
      jukebox.onChange(({ current }) => {
        if (current) lastTrack = current;
      });
      return jukebox;
    });
  }
  return loading;
}

export async function togglePlay() {
  const jb = await getJukebox();
  if (jb.playing) jb.stop();
  else jb.play(lastTrack || jb.current || jb.tracks[0].id);
  return jb.playing;
}

export function musicButton() {
  const btn = h("button", { class: "btn icon cyan", title: "Play music", "aria-label": "Play music" }, "▶");
  let off = null;
  const sync = (playing) => {
    btn.textContent = playing ? "⏸" : "▶";
    btn.title = playing ? "Pause music" : "Play music";
    btn.setAttribute("aria-label", btn.title);
  };
  btn.addEventListener("click", async () => {
    const jb = await getJukebox();
    if (!off) off = jb.onChange(({ playing }) => sync(playing));
    await togglePlay();
    sync(jb.playing);
  });
  if (jukebox) {
    sync(jukebox.playing);
    off = jukebox.onChange(({ playing }) => sync(playing));
  }
  return { el: btn, destroy: () => off?.() };
}

export async function openJukebox() {
  const jb = await getJukebox();
  const list = h("div");
  const pause = h("button", { class: "btn primary block" });
  const m = modal({ title: "Jukebox", onClose: () => off() });
  const volume = h("input", { type: "range", min: 0, max: 1, step: 0.05, value: settings.get().volume, style: { width: "100%" } });
  volume.addEventListener("input", () => {
    const v = Number(volume.value);
    jb.setVolume(v);
    settings.set({ volume: v });
  });
  pause.addEventListener("click", () => togglePlay());
  const render = () => {
    pause.textContent = jb.playing ? "⏸ Pause" : `▶ ${lastTrack ? "Resume" : "Play"}`;
    list.replaceChildren(...jb.tracks.map((t) => {
      const on = jb.playing && jb.current === t.id;
      return h(
        "div",
        { class: "history-row" },
        h("span", null, on ? "♫ " : "", h("b", { style: { color: on ? "#ff2e97" : "#fff" } }, t.title), h("span", { class: "muted" }, ` · ${t.bpm} bpm`)),
        h("button", { class: `btn small ${on ? "ghost" : "cyan"}`, onclick: () => (on ? jb.stop() : jb.play(t.id)) }, on ? "Pause" : "Play"),
      );
    }));
  };
  const off = jb.onChange(render);
  render();
  m.body.append(
    pause,
    h("p", { class: "hint" }, "Original synthwave and acid jazz, generated live in your browser. Only you hear it."),
    list,
    h("div", { class: "field mt" }, h("label", null, "Volume"), volume),
  );
}
