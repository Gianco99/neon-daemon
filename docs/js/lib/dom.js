const PROPS = new Set(["value", "checked", "disabled", "selected", "hidden", "htmlFor", "tabIndex", "min", "max", "step", "maxLength", "autocomplete", "placeholder", "type", "name", "required"]);

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
      else if (key === "dataset") Object.assign(el.dataset, value);
      else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (PROPS.has(key)) el[key] = value;
      else el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const child of [children].flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

export function replace(el, ...children) {
  clear(el);
  return append(el, children);
}

export function toast(text, kind = "", ms = 3800) {
  const root = document.getElementById("toasts");
  if (!root) return;
  while (root.children.length > 3) root.firstChild.remove();
  const el = h("div", { class: `toast ${kind}` }, text);
  root.append(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s, transform 0.3s";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 320);
  }, ms);
}

export function errorToast(err) {
  toast(errorMessage(err), "error", 5200);
}

export function errorMessage(err) {
  const raw = (err && (err.message || err.error_description || err.msg)) || String(err || "Something went wrong");
  if (/duplicate key.*handle/i.test(raw)) return "That handle is taken.";
  if (/handle_check|profiles_handle_check/i.test(raw)) return "Handles are 3 to 20 letters, numbers or underscores.";
  if (/Failed to fetch|NetworkError/i.test(raw)) return "Can't reach the bar right now. Check your connection.";
  if (/Invalid login credentials/i.test(raw)) return "Wrong email or password.";
  if (/Email not confirmed/i.test(raw)) return "Confirm your email first. Check your inbox.";
  return raw;
}

const openModals = [];

export function modal({ title, wide = false, onClose } = {}) {
  const root = document.getElementById("modals");
  const body = h("div");
  const heading = h("h2", null, title);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    const i = openModals.indexOf(api);
    if (i >= 0) openModals.splice(i, 1);
    onClose?.();
  };
  const dialog = h(
    "div",
    { class: `panel modal${wide ? " wide" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "modal-head" }, heading, h("button", { class: "btn small ghost", "aria-label": "Close", onclick: close }, "✕")),
    body,
  );
  const backdrop = h("div", { class: "modal-backdrop", onmousedown: (e) => { if (e.target === backdrop) close(); } }, dialog);
  root.append(backdrop);
  const api = { body, close, dialog, setTitle: (t) => { heading.textContent = t; } };
  openModals.push(api);
  return api;
}

export function closeAllModals() {
  [...openModals].forEach((m) => m.close());
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && openModals.length && !document.querySelector(".dz-overlay")) {
    openModals[openModals.length - 1].close();
  }
});

export async function copyText(text, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h("textarea", { style: { position: "fixed", opacity: "0" } }, text);
    document.body.append(ta);
    ta.select();
    try { document.execCommand("copy"); } catch {}
    ta.remove();
  }
  toast(label, "", 1800);
}

export function copyRow(text, display) {
  return h(
    "div",
    { class: "cmd" },
    h("code", null, display ?? text),
    h("button", { class: "btn small cyan", onclick: () => copyText(text) }, "Copy"),
  );
}

export function busy(button, fn) {
  return async (...args) => {
    if (button.disabled) return;
    const label = button.textContent;
    button.disabled = true;
    try {
      return await fn(...args);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  };
}
