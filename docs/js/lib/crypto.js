export const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function randomString(length, alphabet = ALPHABET) {
  const out = [];
  const limit = 256 - (256 % alphabet.length);
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < limit && out.length < length) out.push(alphabet[b % alphabet.length]);
    }
  }
  return out.join("");
}

export function randomHex(bytes = 32) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeCode(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function groupCode(code, size = 4) {
  const clean = normalizeCode(code);
  return clean.match(new RegExp(`.{1,${size}}`, "g"))?.join("-") ?? "";
}

export function lobbyCodeLabel(code) {
  return groupCode(code, 3);
}

export function newLobbyKey() {
  return groupCode(randomString(20), 4);
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function keyProof(key) {
  return sha256Hex(`neon-daemon/auth/v1/${normalizeCode(key)}`);
}

export async function chatKey(key, lobbyId) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(normalizeCode(key)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(`neon-daemon/chat/v1/${lobbyId}`), iterations: 210000 },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function seal(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(data))}`;
}

export async function unseal(key, payload) {
  const [version, iv, data] = String(payload).split(".");
  if (version !== "v1" || !iv || !data) throw new Error("not a sealed message");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(data));
  return decoder.decode(plain);
}

export function parseInvite(text) {
  const raw = String(text || "").trim();
  const link = raw.match(/#\/join\/([A-Za-z0-9-]+)(?:\/([A-Za-z0-9-]+))?/);
  if (link) return { code: normalizeCode(link[1]), key: link[2] ? groupCode(link[2]) : "" };
  const parts = raw.split(/[\s:#/]+/).filter(Boolean);
  if (!parts.length) return { code: "", key: "" };
  const code = normalizeCode(parts[0]);
  const key = parts.length > 1 ? groupCode(parts.slice(1).join("")) : "";
  return { code, key };
}
