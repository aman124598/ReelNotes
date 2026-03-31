import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface EnqueueRequest {
  url?: string
  reelId?: number
  retry?: boolean
}

interface AuthenticatedUserResult {
  userId: string | null
  authError: string | null
}

const INSTAGRAM_PATTERNS = [
  /instagram\.com\/reel\/[A-Za-z0-9_-]+/i,
  /instagram\.com\/p\/[A-Za-z0-9_-]+/i,
  /instagram\.com\/tv\/[A-Za-z0-9_-]+/i,
]

function isValidInstagramUrl(url: string): boolean {
  return INSTAGRAM_PATTERNS.some((pattern) => pattern.test(url))
}

async function triggerWorkerRunOnce(): Promise<void> {
  const workerBaseUrl = Deno.env.get("WORKER_BASE_URL")?.trim()
  if (!workerBaseUrl) return

  const workerSecret = Deno.env.get("WORKER_SECRET")?.trim()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (workerSecret) {
    headers.Authorization = `Bearer ${workerSecret}`
  }

  try {
    const endpoint = `${workerBaseUrl.replace(/\/$/, "")}/worker/run-once`
    await fetch(endpoint, {
      method: "POST",
      headers,
    })
  } catch (_error) {
    // Worker trigger is best-effort; queueing already succeeded.
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
}

async function getAuthenticatedUser(req: Request, supabaseUrl: string, anonKey: string): Promise<AuthenticatedUserResult> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return { userId: null, authError: "Missing Authorization header" }
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  })

  const { data, error } = await userClient.auth.getUser()
  if (error || !data?.user?.id) {
    return { userId: null, authError: error?.message || "Invalid JWT" }
  }

  return { userId: data.user.id, authError: null }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    let payload: EnqueueRequest
    try {
      payload = await req.json()
    } catch (_jsonError) {
      return jsonResponse({ error: "Invalid JSON body" }, 400)
    }

    const { url, reelId, retry } = payload
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const dbKey = serviceRoleKey || anonKey

    if (!supabaseUrl || !dbKey || !anonKey) {
      return jsonResponse({ error: "Missing Supabase runtime configuration (SUPABASE_URL / SUPABASE_ANON_KEY / key)" }, 500)
    }

    const { userId, authError } = await getAuthenticatedUser(req, supabaseUrl, anonKey)
    if (!userId) {
      return jsonResponse({ error: authError || "Invalid JWT" }, 401)
    }

    const supabase = createClient(supabaseUrl, dbKey)

    if (retry && reelId) {
      const { data: reel, error: reelError } = await supabase
        .from("reels")
        .select("id")
        .eq("id", reelId)
        .eq("owner_id", userId)
        .single()

      if (reelError || !reel) {
        return jsonResponse({ error: "Reel note not found" }, 404)
      }

      const { error: updateError } = await supabase
        .from("reels")
        .update({ status: "queued", processing_error: null })
        .eq("id", reelId)
        .eq("owner_id", userId)

      if (updateError) {
        return jsonResponse({ error: updateError.message }, 500)
      }

      const { data: existingActiveJob, error: existingJobError } = await supabase
        .from("reel_jobs")
        .select("id")
        .eq("reel_id", reelId)
        .in("status", ["queued", "processing"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()

      if (existingJobError) {
        return jsonResponse({ error: existingJobError.message }, 500)
      }

      if (existingActiveJob) {
        await triggerWorkerRunOnce()
        return jsonResponse({ reelId, status: "queued" }, 200)
      }

      const { error: jobError } = await supabase
        .from("reel_jobs")
        .insert({ reel_id: reelId, status: "queued", attempt_count: 0 })

      if (jobError) {
        return jsonResponse({ error: jobError.message }, 500)
      }

      await triggerWorkerRunOnce()

      return jsonResponse({ reelId, status: "queued" }, 200)
    }

    if (!url || !isValidInstagramUrl(url)) {
      return jsonResponse({ error: "Please provide a valid public Instagram reel/post URL" }, 400)
    }

    const { data: newReel, error: reelInsertError } = await supabase
      .from("reels")
      .insert({
        owner_id: userId,
        url,
        title: "Processing Reel",
        content_type: "Recipe",
        structured_text: "Processing speech and extracting recipe notes...",
        status: "queued",
      })
      .select("id, status")
      .single()

    if (reelInsertError || !newReel) {
      return jsonResponse({ error: reelInsertError?.message || "Failed to create reel note" }, 500)
    }

    const { error: jobError } = await supabase
      .from("reel_jobs")
      .insert({ reel_id: newReel.id, status: "queued", attempt_count: 0 })

    if (jobError) {
      await supabase.from("reels").delete().eq("id", newReel.id)
      return jsonResponse({ error: jobError.message }, 500)
    }

    await triggerWorkerRunOnce()

    return jsonResponse({ reelId: newReel.id, status: newReel.status }, 200)
  } catch (error) {
    return jsonResponse({ error: error.message || "Failed to enqueue reel" }, 500)
  }
})
