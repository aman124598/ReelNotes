import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface StatusRequest {
  reelId?: number
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
    const { reelId }: StatusRequest = await req.json()
    if (!reelId) {
      return new Response(
        JSON.stringify({ error: "Missing reelId parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

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
    const { data, error } = await supabase
      .from("reels")
      .select("*")
      .eq("id", reelId)
      .eq("owner_id", userId)
      .single()

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Reel note not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ reel: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to read reel status" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
