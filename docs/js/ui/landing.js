import config from "../../config.js";
import { h, replace, errorMessage, busy } from "../lib/dom.js";
import { mountBackdrop } from "../scene/backdrop.js";
import { fmtClock } from "../lib/util.js";
import { groupCode } from "../lib/crypto.js";

function feature(title, text) {
  return h("div", { class: "feature" }, h("b", null, title), h("span", null, text));
}

function field(label, input, hint) {
  return h("div", { class: "field" }, h("label", null, label), input, hint ? h("p", { class: "hint" }, hint) : null);
}

function signInForm(backend) {
  const email = h("input", { class: "input", type: "email", autocomplete: "email", placeholder: "you@domain.com", required: true });
  const password = h("input", { class: "input", type: "password", autocomplete: "current-password", placeholder: "••••••••", required: true });
  const error = h("p", { class: "error-text" });
  const submit = h("button", { class: "btn primary block", type: "submit" }, "Walk in");
  const form = h("form", null, field("Email", email), field("Password", password), error, submit);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    busy(submit, async () => {
      error.textContent = "";
      submit.textContent = "Checking the list...";
      try {
        await backend.signIn({ email: email.value.trim(), password: password.value });
      } catch (err) {
        error.textContent = errorMessage(err);
      }
    })();
  });
  return form;
}

function registerForm(backend) {
  const handle = h("input", { class: "input", autocomplete: "username", placeholder: "neon_rider", maxLength: 20, required: true });
  const handleHint = h("p", { class: "hint" }, "3 to 20 letters, numbers or underscores. This is your name in the bar.");
  const email = h("input", { class: "input", type: "email", autocomplete: "email", placeholder: "you@domain.com", required: true });
  const password = h("input", { class: "input", type: "password", autocomplete: "new-password", placeholder: "at least 8 characters", required: true });
  const error = h("p", { class: "error-text" });
  const submit = h("button", { class: "btn primary block", type: "submit" }, "Open a tab");
  const form = h(
    "form",
    null,
    h("div", { class: "field" }, h("label", null, "Handle"), handle, handleHint),
    field("Email", email),
    field("Password", password),
    error,
    submit,
  );
  let timer = 0;
  handle.addEventListener("input", () => {
    handle.value = handle.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    clearTimeout(timer);
    const value = handle.value;
    if (value.length < 3) {
      handleHint.textContent = "3 to 20 letters, numbers or underscores. This is your name in the bar.";
      handleHint.className = "hint";
      return;
    }
    timer = setTimeout(async () => {
      try {
        const ok = await backend.handleAvailable(value);
        if (handle.value !== value) return;
        handleHint.textContent = ok ? `@${value} is free` : `@${value} is taken`;
        handleHint.className = ok ? "hint ok-text" : "hint error-text";
      } catch {}
    }, 350);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    busy(submit, async () => {
      error.textContent = "";
      if (!/^[a-z0-9_]{3,20}$/.test(handle.value)) {
        error.textContent = "Pick a handle: 3 to 20 letters, numbers or underscores.";
        return;
      }
      if (password.value.length < 8) {
        error.textContent = "Use at least 8 characters for your password.";
        return;
      }
      submit.textContent = "Printing your wristband...";
      try {
        const { confirm } = await backend.signUp({ email: email.value.trim(), password: password.value, handle: handle.value });
        if (confirm) {
          replace(form, h("p", { class: "ok-text" }, "Almost in. Check your email and tap the confirmation link, then sign in."));
        }
      } catch (err) {
        error.textContent = errorMessage(err);
      }
    })();
  });
  return form;
}

function claudeForm(backend) {
  const box = h("div");
  let pending = null;
  let timer = 0;
  const start = h("button", { class: "btn primary block" }, "Get a sign-in code");
  const intro = h(
    "div",
    null,
    h("p", null, "Already linked Claude Code to your account? Sign in from there. No password needed."),
    h("ol", { class: "steps" }, h("li", null, "Get a code here."), h("li", null, "Run the command it shows in Claude Code."), h("li", null, "Approve it there. This page logs you in.")),
    start,
  );
  replace(box, intro);
  start.addEventListener("click", busy(start, async () => {
    start.textContent = "Mixing...";
    try {
      pending = await backend.startClaudeLogin();
    } catch (err) {
      replace(box, intro, h("p", { class: "error-text" }, errorMessage(err)));
      return;
    }
    const code = groupCode(pending.code);
    const countdown = h("span", { class: "timer" });
    const status = h("p", { class: "hint" }, "Waiting for Claude Code...");
    const tick = () => {
      const left = (new Date(pending.expiresAt).getTime() - Date.now()) / 1000;
      countdown.textContent = left > 0 ? `expires in ${fmtClock(left)}` : "expired";
    };
    tick();
    timer = setInterval(tick, 1000);
    const children = [
      h("p", null, "In Claude Code, run:"),
      h("div", { class: "cmd" }, h("code", null, `/neon approve ${code}`)),
      h("span", { class: "big-code" }, code),
      h("div", { class: "row" }, countdown),
      status,
      h("p", { class: "hint" }, "Only approve a code you see on your own screen. Never approve one someone sent you."),
    ];
    if (backend.mode === "demo") {
      children.push(h("button", { class: "btn cyan block mt", onclick: () => backend.demoApprove() }, "Demo: pretend I approved it"));
    }
    replace(box, ...children);
    try {
      await pending.done;
    } catch (err) {
      status.textContent = errorMessage(err);
      status.className = "error-text";
    } finally {
      clearInterval(timer);
    }
  }));
  return { el: box, destroy: () => { clearInterval(timer); pending?.cancel(); } };
}

function authCard(backend) {
  const tabs = ["Sign in", "Register"];
  if (config.claudeLogin) tabs.push("Claude Code");
  const body = h("div");
  let active = backend.mode === "demo" ? 1 : 0;
  let claude = null;
  const tabEls = tabs.map((label, i) => h("button", { class: "tab", type: "button", onclick: () => show(i) }, label));
  function show(i) {
    active = i;
    tabEls.forEach((t, j) => t.classList.toggle("active", j === i));
    claude?.destroy();
    claude = null;
    if (tabs[i] === "Sign in") replace(body, signInForm(backend));
    else if (tabs[i] === "Register") replace(body, registerForm(backend));
    else {
      claude = claudeForm(backend);
      replace(body, claude.el);
    }
  }
  const extras = [];
  if (config.githubLogin && backend.mode === "live") {
    extras.push(h("div", { class: "or" }, "OR"), h("button", { class: "btn cyan block", onclick: () => backend.signInWithGitHub().catch(() => null) }, "Continue with GitHub"));
  }
  if (backend.mode === "demo") {
    const guest = h("button", { class: "btn yellow block" }, "Just look around");
    guest.addEventListener("click", busy(guest, () => backend.guest()));
    extras.push(
      h("div", { class: "or" }, "DEMO"),
      guest,
      h("p", { class: "hint center" }, "Demo mode: accounts, bars and chat live only in this browser. Open a second tab to see yourself from the other side."),
    );
  }
  const el = h("div", { class: "panel auth-card" }, h("div", { class: "tabs", role: "tablist" }, tabEls), body, extras);
  show(active);
  return { el, destroy: () => claude?.destroy() };
}

export function renderLanding(app, backend) {
  const screen = h("div", { class: "screen" });
  const backdrop = mountBackdrop(screen);
  const [first, ...rest] = config.appName.split(" ");
  const card = authCard(backend);
  screen.append(
    h(
      "main",
      { class: "landing" },
      h(
        "section",
        null,
        h("h1", { class: "hero-title" }, h("span", { class: "script flicker" }, first), h("span", { class: "block" }, rest.join(" "))),
        h("p", { class: "hero-tag" }, "Your agents clock in. You clock out."),
        h(
          "p",
          { class: "hero-sub" },
          "A neon bar for people who code with Claude. Your agents show up as little drones: they work the desks, fly over when they need you, and grab a drink when the job is done. You hang out with friends in the meantime.",
        ),
        h(
          "div",
          { class: "features" },
          feature("Live agents", "Link Claude Code and your agent's state shows up in the bar. Zero tokens spent."),
          feature("Private bars", "Lobbies locked with a key. Chat is end-to-end encrypted in your browser."),
          feature("Games", "Darts, a jukebox, and a booth for betting on your friends' agents."),
        ),
      ),
      card.el,
    ),
  );
  app.replaceChildren(screen);
  return {
    destroy() {
      backdrop.destroy();
      card.destroy();
    },
  };
}
