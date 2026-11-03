import config from "../../config.js";

export function isLive() {
  return !!(config.supabaseUrl && config.supabaseKey) && !new URLSearchParams(location.search).has("demo");
}

export async function createBackend() {
  if (isLive()) {
    const { createLiveBackend } = await import("./live.js");
    return createLiveBackend();
  }
  const { createDemoBackend } = await import("./demo.js");
  return createDemoBackend();
}
