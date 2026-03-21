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

async function getAuthenticatedUserId(req: Request, supabaseUrl: string, anonKey: string): Promise<string | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return null

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  })

  const { data, error } = await userClient.auth.getUser()
  if (error || !data?.user?.id) {
    return null
  }

  return data.user.id
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { url, reelId, retry }: EnqueueRequest = await req.json()
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const dbKey = serviceRoleKey || anonKey

    if (!supabaseUrl || !dbKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase runtime configuration (SUPABASE_URL / SUPABASE_ANON_KEY / key)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const userId = await getAuthenticatedUserId(req, supabaseUrl, anonKey)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
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
        return new Response(
          JSON.stringify({ error: "Reel note not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const { error: updateError } = await supabase
        .from("reels")
        .update({ status: "queued", processing_error: null })
        .eq("id", reelId)
        .eq("owner_id", userId)

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
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
        return new Response(
          JSON.stringify({ error: existingJobError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      if (existingActiveJob) {
        await triggerWorkerRunOnce()
        return new Response(
          JSON.stringify({ reelId, status: "queued" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const { error: jobError } = await supabase
        .from("reel_jobs")
        .insert({ reel_id: reelId, status: "queued", attempt_count: 0 })

      if (jobError) {
        return new Response(
          JSON.stringify({ error: jobError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      await triggerWorkerRunOnce()

      return new Response(
        JSON.stringify({ reelId, status: "queued" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!url || !isValidInstagramUrl(url)) {
      return new Response(
        JSON.stringify({ error: "Please provide a valid public Instagram reel/post URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
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
      return new Response(
        JSON.stringify({ error: reelInsertError?.message || "Failed to create reel note" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { error: jobError } = await supabase
      .from("reel_jobs")
      .insert({ reel_id: newReel.id, status: "queued", attempt_count: 0 })

    if (jobError) {
      await supabase.from("reels").delete().eq("id", newReel.id)
      return new Response(
        JSON.stringify({ error: jobError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    await triggerWorkerRunOnce()

    return new Response(
      JSON.stringify({ reelId: newReel.id, status: newReel.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to enqueue reel" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
