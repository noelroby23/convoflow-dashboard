// supabase/functions/cf-recording/index.ts
//
// Mints a playable URL for one call recording.
//
// WHY THIS EXISTS AT ALL
// ----------------------
// cf.call.recording_url is VAPI's raw R2 object path:
//   https://<acct>.r2.cloudflarestorage.com/hipaa-recordings/<call>-…-mono.wav
// That is the S3 API endpoint, and fetched from a browser it returns
//   400 <Error><Code>InvalidArgument</Code><Message>Authorization</Message>
// Measured on a real recording 2026-08-11. So the "play" link the Lead Desk
// has shown next to every call has never played anything — a dead link that
// looks exactly like a working one.
//
// The URL that DOES play is minted on demand by VAPI:
//   GET https://api.vapi.ai/call/{id} -> artifact.presignedMonoUrl
// It is signed (X-Amz-Expires=1800), it serves 206 Partial Content with
// Accept-Ranges, and it carries Access-Control-Allow-Origin: * — so once the
// browser has it, an <audio> tag can play and seek it directly. What the
// browser cannot have is the VAPI key needed to mint it (§3 rule 9, and Vite
// inlines anything it is given into the bundle). Hence a server-side hop.
//
// TWO GATES, BOTH NECESSARY
// -------------------------
// 1. IS THE CALLER A HUMAN WHO IS LOGGED IN? The publishable key ships in the
//    browser bundle and is public by design, so "has an apikey" proves nothing.
//    auth.getUser() on the caller's token is what separates a signed-in team
//    member from anyone who read the JavaScript.
//
// 2. IS THIS CALL OURS? 🔑 The VAPI org is shared with other clients (§2, and
//    §7 item 83 — a phone number turned out to belong to Samana precisely
//    because ownership is invisible in the VAPI API). An unscoped proxy holding
//    our key would let any logged-in user stream any call in the org. So the
//    call id is resolved against cf.call first, via cf_call_recording_ref,
//    called with the CALLER's token so gate 1 is enforced by Postgres too.
//
// The presigned URL is a capability for 30 minutes — the same treatment §7
// item 54 gives monitor.listenUrl. It is never stored.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405)

  // ---- input ------------------------------------------------------------
  let callId = ""
  let stereo = false
  try {
    const body = await req.json()
    callId = String(body?.call_id ?? "").trim()
    stereo = body?.stereo === true
  } catch {
    return json({ error: "expected a JSON body with call_id" }, 400)
  }
  if (!callId) return json({ error: "call_id is required" }, 400)

  // ---- gate 1: a signed-in dashboard user, not just the public key -------
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json({ error: "missing authorization header" }, 401)

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return json({ error: "invalid or expired session" }, 401)
  }

  // ---- gate 2: is this call ours? ---------------------------------------
  // Runs as `authenticated` under the caller's token, so a user who somehow
  // reached this far without a valid session still gets 42501 from Postgres.
  const { data: ref, error: refError } = await supabase
    .rpc("cf_call_recording_ref", { p: { call_id: callId } })

  if (refError) {
    return json({ error: "could not resolve the call", detail: refError.message }, 500)
  }
  if (!ref?.ok) {
    // Deliberately the same answer for "no such call" and "another client's
    // call": this endpoint must not be usable to probe the shared VAPI org.
    return json({ error: "not a ConvoFlow call" }, 404)
  }
  if (!ref.has_recording) {
    return json({
      error: "no recording was made for this call",
      reason: "no_recording",
      at: ref.at,
    }, 404)
  }

  // ---- mint the presigned URL -------------------------------------------
  const vapiKey = Deno.env.get("VAPI_KEY")
  if (!vapiKey) return json({ error: "VAPI_KEY is not configured" }, 500)

  let vapiRes: Response
  try {
    vapiRes = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
      headers: { Authorization: `Bearer ${vapiKey}` },
    })
  } catch (e) {
    return json({ error: "could not reach VAPI", detail: String(e) }, 502)
  }

  if (!vapiRes.ok) {
    // VAPI keeps call audio 14 days (§7 items 8 and 105). cf.call keeps the
    // transcript and summary for ever, so say which one is gone rather than
    // reporting a generic failure — "expired" and "broken" need different
    // reactions from whoever is reading.
    //
    // ⚠️ Retention is a 400, NOT a 404, and the only thing that distinguishes
    // it from any other bad request is the message text:
    //   {"message":"Your subscription plan only covers the last 14 days of
    //    call history. This call exceeds your retention window.", ...}
    // Measured against a 17-day-old call 2026-08-11. Matching on the status
    // alone reported every expired recording as a server fault, which reads as
    // "the dashboard is broken" rather than "this audio is gone".
    const body = await vapiRes.text()
    const expired = vapiRes.status === 404 ||
      /retention|only covers the last/i.test(body)

    if (expired) {
      return json({
        error: "the audio has expired",
        reason: "expired",
        age_days: ref.age_days,
        detail: "VAPI keeps recordings for 14 days. The transcript and summary below are kept for ever.",
      }, 410)
    }
    return json({
      error: `VAPI returned ${vapiRes.status}`,
      reason: "vapi_error",
      detail: body.slice(0, 300),
    }, 502)
  }

  const call = await vapiRes.json()
  const artifact = call?.artifact ?? {}
  const url = stereo
    ? (artifact.presignedStereoUrl ?? artifact.presignedMonoUrl)
    : (artifact.presignedMonoUrl ?? artifact.presignedStereoUrl)

  if (!url) {
    // Never fall back to artifact.recordingUrl. That is the unsigned R2 path —
    // the browser gets a 400 and the player fails in a way that reads as a
    // broken recording rather than a missing signature. An honest error beats
    // a link that cannot work.
    return json({
      error: "VAPI returned no playable recording for this call",
      reason: "no_presigned_url",
      age_days: ref.age_days,
    }, 502)
  }

  return json({
    ok: true,
    url,
    expires_at: artifact.presignedUrlsExpiresAt ?? null,
    stereo_available: Boolean(artifact.presignedStereoUrl),
    secs: ref.secs,
    at: ref.at,
  })
})
