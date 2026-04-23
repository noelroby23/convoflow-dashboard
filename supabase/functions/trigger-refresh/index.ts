// supabase/functions/trigger-refresh/index.ts
// Proxies the dashboard Refresh button to the n8n WF5 webhook.
// Keeps the shared secret server-side. Requires an authenticated dashboard user.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const VALID_TARGETS = ["all", "meta_ads", "ghl_reconciliation", "alerts"] as const
type Target = typeof VALID_TARGETS[number]

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405)
  }

  // 1. Verify the caller is an authenticated dashboard user
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return json({ error: "missing authorization header" }, 401)
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return json({ error: "invalid or expired session" }, 401)
  }

  // 2. Parse and validate target
  let body: { target?: string } = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: "invalid json body" }, 400)
  }

  const target = (body.target ?? "all").toLowerCase() as Target
  if (!VALID_TARGETS.includes(target)) {
    return json({ error: `invalid target; must be one of ${VALID_TARGETS.join(", ")}` }, 400)
  }

  // 3. Forward to the n8n webhook with the server-side secret
  const webhookUrl = Deno.env.get("N8N_REFRESH_WEBHOOK_URL")
  const sharedSecret = Deno.env.get("N8N_REFRESH_SECRET")
  if (!webhookUrl || !sharedSecret) {
    return json({ error: "refresh webhook not configured on server" }, 500)
  }

  try {
    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: sharedSecret, target }),
    })

    const n8nData = await n8nRes.json().catch(() => ({}))

    // Log who triggered this (useful audit trail)
    console.log(JSON.stringify({
      event: "manual_refresh_triggered",
      user_id: user.id,
      user_email: user.email,
      target,
      n8n_status: n8nRes.status,
      n8n_response: n8nData,
    }))

    return json(n8nData, n8nRes.status)
  } catch (e) {
    console.error("n8n webhook call failed", e)
    return json({ error: "failed to reach refresh pipeline", detail: String(e) }, 502)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}
