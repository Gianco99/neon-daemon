import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);

  const { token, code } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || typeof code !== "string") {
    return reply({ error: "token and code are required" }, 400);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  if (!serviceKey) return reply({ error: "function is missing its service key" }, 500);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: resolved, error: resolveError } = await admin.rpc("resolve_login_request", {
    p_token: token,
    p_code: code,
  });
  if (resolveError) return reply({ error: resolveError.message }, 403);

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(resolved.user_id);
  const email = userData?.user?.email;
  if (userError || !email) return reply({ error: "this account has no email to sign in with" }, 400);

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link?.properties?.hashed_token) {
    return reply({ error: linkError?.message ?? "could not mint a sign-in token" }, 500);
  }

  const { error: completeError } = await admin.rpc("complete_login_request", {
    p_id: resolved.request_id,
    p_token_hash: link.properties.hashed_token,
  });
  if (completeError) return reply({ error: completeError.message }, 500);

  return reply({ ok: true, handle: resolved.handle });
});
