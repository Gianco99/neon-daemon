import config from "../../config.js";
import { toast } from "../lib/dom.js";
import { settings } from "../lib/store.js";

let flashTimer = 0;
let audioCtx = null;

function chime() {
  try {
    audioCtx = audioCtx || new AudioContext();
    const now = audioCtx.currentTime;
    [660, 990].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.5);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.55);
    });
  } catch {}
}

function flashTitle() {
  clearInterval(flashTimer);
  const original = config.appName;
  let on = false;
  let n = 0;
  flashTimer = setInterval(() => {
    on = !on;
    document.title = on ? "🔔 Your agent needs you" : original;
    if (++n > 12 || (!document.hidden && n > 3)) {
      clearInterval(flashTimer);
      document.title = original;
    }
  }, 900);
}

export function agentNeedsYou(label) {
  toast(`🔔 Your agent needs you${label ? ` · ${label}` : ""}. Hop back into Claude Code.`, "pink", 6500);
  flashTitle();
  const s = settings.get();
  if (s.chime) chime();
  if (s.alerts && document.hidden && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(config.appName, { body: `Your agent${label ? ` (${label})` : ""} needs you in Claude Code.`, tag: "agent-waiting" });
    } catch {}
  }
}
