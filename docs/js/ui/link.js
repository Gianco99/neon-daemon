import config from "../../config.js";
import { h, replace, toast, errorToast, modal, copyRow, busy } from "../lib/dom.js";
import { groupCode } from "../lib/crypto.js";
import { fmtAgo, fmtClock } from "../lib/util.js";
import { settings } from "../lib/store.js";

function alertsSection() {
  const s = settings.get();
  const notify = h("input", { type: "checkbox", checked: !!s.alerts });
  const chime = h("input", { type: "checkbox", checked: !!s.chime });
  notify.addEventListener("change", async () => {
    if (notify.checked && "Notification" in window && Notification.permission !== "granted") {
      const res = await Notification.requestPermission().catch(() => "denied");
      if (res !== "granted") {
        notify.checked = false;
        toast("Your browser blocked notifications for this site.", "error");
      }
    }
    settings.set({ alerts: notify.checked });
  });
  chime.addEventListener("change", () => settings.set({ chime: chime.checked }));
  return h(
    "div",
    { class: "mt" },
    h("h3", null, "When your agent needs you"),
    h("label", { class: "row" }, notify, " Desktop notification when this tab is in the background"),
    h("label", { class: "row" }, chime, " Play a soft chime"),
  );
}

export function openLinkClaude(backend) {
  const m = modal({ title: "Link Claude Code" });
  const privacy = h(
    "p",
    { class: "hint" },
    "Privacy: only your agent's state leaves your machine (working, needs you, chilling), plus a label if you set one. Never prompts, code, file paths or tool inputs. The plugin spends zero tokens.",
  );

  if (backend.mode === "demo") {
    const toggle = h("button", { class: `btn ${backend.simAgent ? "cyan" : "primary"} block` });
    const label = () => {
      toggle.textContent = backend.simAgent ? "Stop the simulated agent" : "Simulate an agent";
    };
    label();
    toggle.addEventListener("click", () => {
      backend.setSimAgent(!backend.simAgent);
      label();
      toast(backend.simAgent ? "A demo agent clocked in. Watch the desks." : "Demo agent clocked out.", "pink");
    });
    m.body.append(
      h("p", null, "This is demo mode, so nothing connects to a real Claude Code yet. Once the site points at a Supabase project, this screen gives you a one-line command to link the plugin."),
      h("p", null, "Want to see how it feels? Spin up a fake agent: it'll take jobs at the desks, fly over when it 'needs you', and hit the bar when it's done."),
      toggle,
      alertsSection(),
      privacy,
    );
    return;
  }

  const repo = config.repo || "OWNER/REPO";
  const pairBox = h("div");
  const devicesBox = h("div", null, h("p", { class: "hint" }, "Loading devices..."));
  let timer = 0;
  const pair = h("button", { class: "btn primary block" }, "Get a pairing code");
  pair.addEventListener("click", busy(pair, async () => {
    pair.textContent = "Cutting a key...";
    try {
      const { code, expires_at } = await backend.createPairingCode();
      const countdown = h("span", { class: "timer" });
      const tick = () => {
        const left = (new Date(expires_at).getTime() - Date.now()) / 1000;
        countdown.textContent = left > 0 ? `code expires in ${fmtClock(left)}` : "expired, get a new one";
      };
      tick();
      clearInterval(timer);
      timer = setInterval(tick, 1000);
      replace(
        pairBox,
        h("p", null, "Paste this into Claude Code:"),
        copyRow(`/neon link ${groupCode(code)} ${config.supabaseUrl} ${config.supabaseKey}`, `/neon link ${groupCode(code)} …`),
        h("div", { class: "row" }, countdown, h("button", { class: "btn small ghost", onclick: loadDevices }, "I ran it ↻")),
      );
    } catch (err) {
      errorToast(err);
    }
  }));
  replace(pairBox, pair);

  async function loadDevices() {
    try {
      const list = await backend.devices();
      replace(
        devicesBox,
        list.length
          ? list.map((d) => h("div", { class: "history-row" },
            h("span", null, `🤖 ${d.name}`, h("span", { class: "muted" }, ` · ${d.last_seen ? `active ${fmtAgo(d.last_seen)}` : "never pinged"}`)),
            h("button", { class: "btn small ghost", onclick: async () => {
              try {
                await backend.revokeDevice(d.id);
                toast("Device unlinked", "pink");
                loadDevices();
              } catch (err) {
                errorToast(err);
              }
            } }, "Revoke")))
          : h("p", { class: "hint" }, "Nothing linked yet."),
      );
    } catch (err) {
      replace(devicesBox, h("p", { class: "error-text" }, "Couldn't load devices."));
    }
  }
  loadDevices();

  m.body.append(
    h(
      "ol",
      { class: "steps" },
      h("li", null, "Install the plugin in Claude Code (version 2.1.308 or newer):", copyRow(`/plugin install neon-daemon --marketplace ${repo}`)),
      h("li", null, "Get a one-time pairing code and run the command it gives you.", pairBox),
      h("li", null, "Done. Start a task and watch your drone head for the desks."),
    ),
    h("h3", null, "Handy commands"),
    h("p", { class: "hint mono" }, "/neon status · /neon label <text> · /neon tools on · /neon pause · /neon approve <code>"),
    h("h3", { class: "mt" }, "Linked devices"),
    devicesBox,
    alertsSection(),
    privacy,
  );
  const close = m.close;
  m.close = () => {
    clearInterval(timer);
    close();
  };
}
