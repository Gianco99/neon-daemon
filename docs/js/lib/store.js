import { normalizeCode } from "./crypto.js";

const PREFIX = "nd.";

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}

export const keyring = {
  get(code) {
    return load("keys", {})[normalizeCode(code)] || "";
  },
  set(code, key) {
    const keys = load("keys", {});
    keys[normalizeCode(code)] = key;
    save("keys", keys);
  },
  forget(code) {
    const keys = load("keys", {});
    delete keys[normalizeCode(code)];
    save("keys", keys);
  },
};

export const settings = {
  get() {
    return { volume: 0.5, alerts: false, ...load("settings", {}) };
  },
  set(patch) {
    save("settings", { ...settings.get(), ...patch });
  },
};
