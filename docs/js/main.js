import config from "../config.js";
import { createBackend } from "./backend/index.js";
import { h, toast, errorMessage, closeAllModals } from "./lib/dom.js";
import { keyring } from "./lib/store.js";
import { normalizeCode, groupCode } from "./lib/crypto.js";
import { renderLanding } from "./ui/landing.js";
import { renderLobbies } from "./ui/lobbies.js";
import { renderBar } from "./ui/bar.js";

const app = document.getElementById("app");
let backend = null;
let screen = null;
let screenKey = "";

function show(key, factory) {
  if (key === screenKey && screen) return;
  try {
    screen?.destroy?.();
  } catch {}
  closeAllModals();
  document.querySelectorAll(".menu").forEach((m) => m.remove());
  screenKey = key;
  screen = factory();
}

function route() {
  const [view, a, b] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (view === "join" && a) {
    const code = normalizeCode(a);
    if (b) keyring.set(code, groupCode(b));
    history.replaceState(null, "", `${location.pathname}${location.search}#/bar/${code}`);
    route();
    return;
  }
  if (!backend.user) {
    show("landing", () => renderLanding(app, backend));
    return;
  }
  if (view === "bar" && a) {
    const code = normalizeCode(a);
    show(`bar:${code}`, () => renderBar(app, backend, { code }));
    return;
  }
  show("lobbies", () => renderLobbies(app, backend));
}

async function boot() {
  document.title = config.appName;
  try {
    backend = await createBackend();
    await backend.init();
  } catch (err) {
    app.replaceChildren(
      h(
        "div",
        { class: "screen", style: { display: "grid", placeItems: "center", padding: "24px" } },
        h(
          "div",
          { class: "panel panel-pad", style: { maxWidth: "520px" } },
          h("h2", null, "The lights are off"),
          h("p", null, `Couldn't reach the bar's backend: ${errorMessage(err)}`),
          h("a", { class: "btn cyan", href: `?demo${location.hash}` }, "Open the demo instead"),
        ),
      ),
    );
    return;
  }
  if (backend.mode === "demo") document.body.append(h("div", { class: "demo-ribbon" }, "DEMO MODE"));
  document.body.append(h("div", { class: "version-tag" }, `v${config.version || "0.1.0"}`));
  backend.on("auth", () => {
    screenKey = "";
    route();
  });
  backend.on("notice", (text) => toast(text, "pink"));
  window.addEventListener("hashchange", route);
  route();
}

boot();
