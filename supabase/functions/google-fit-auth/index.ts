// =========================================================================
// google-fit-auth Edge Function
// Holds the Google OAuth client secret and the user's refresh token
// server-side — the only place either ever lives. The browser never sees
// a refresh token, only short-lived access tokens minted on demand. This
// is what lets a Google Fit link survive page reloads and follow the
// user across devices, instead of depending on one browser's in-memory
// state.
//
// Actions (POST body: { action, ...params }), auth via the caller's
// Supabase session (Authorization: Bearer <user JWT>):
//   exchange    { code }  -> first-time link: trades an OAuth
//                            authorization code for tokens, stores the
//                            refresh token, returns a usable access token.
//   refresh     {}        -> mints a fresh access token from the stored
//                            refresh token. No Google popup involved.
//   status      {}        -> { linked: boolean } — is this account linked
//                            at all, without minting a token.
//   disconnect  {}        -> revokes with Google (best-effort) and
//                            deletes the stored refresh token.
// =========================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function getRow(admin: ReturnType<typeof createClient>, userId: string) {
  const { data } = await admin
    .from("google_fit_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return json({ error: "Google Fit is not configured on the server (missing client secret)." }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // no body — fine for status/refresh/disconnect
  }
  const action = body.action;

  if (action === "status") {
    const row = await getRow(admin, user.id);
    return json({ linked: !!row });
  }

  if (action === "exchange") {
    const code = typeof body.code === "string" ? body.code : "";
    if (!code) return json({ error: "Missing authorization code" }, 400);

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: "postmessage",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return json({ error: tokenData.error_description || "Google token exchange failed" }, 400);
    }

    if (tokenData.refresh_token) {
      await admin.from("google_fit_tokens").upsert(
        { user_id: user.id, refresh_token: tokenData.refresh_token, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    } else {
      // No refresh token came back (rare — happens if Google decides the
      // existing grant already covers it despite prompt=consent). Keep
      // whatever refresh token we already have on file, if any.
      const existing = await getRow(admin, user.id);
      if (!existing) {
        return json({ error: "Google did not grant offline access — please try connecting again." }, 400);
      }
    }

    return json({ access_token: tokenData.access_token, expires_in: tokenData.expires_in, linked: true });
  }

  if (action === "refresh") {
    const row = await getRow(admin, user.id);
    if (!row) return json({ linked: false }, 404);

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: row.refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      if (tokenData.error === "invalid_grant") {
        // The user revoked access from their Google account directly —
        // the stored refresh token is dead, so drop it.
        await admin.from("google_fit_tokens").delete().eq("user_id", user.id);
        return json({ linked: false, revoked: true }, 401);
      }
      return json({ error: tokenData.error_description || "Google token refresh failed" }, 502);
    }

    return json({ access_token: tokenData.access_token, expires_in: tokenData.expires_in, linked: true });
  }

  if (action === "disconnect") {
    const row = await getRow(admin, user.id);
    if (row) {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(row.refresh_token)}`, { method: "POST" }).catch(() => {});
    }
    await admin.from("google_fit_tokens").delete().eq("user_id", user.id);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
