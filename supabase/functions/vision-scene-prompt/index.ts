import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight - MUST use status 200 and 'ok' body like other working functions
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid auth token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    const { data: profile } = await supabase
      .from("user_vision_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    const { data: boards } = await supabase
      .from("vision_boards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const latestBoard = boards && boards[0];
    const visionText = profile?.vision_text || latestBoard?.prompt || "";
    const financialTarget = profile?.financial_target;
    const financialLabel = profile?.financial_target_label || "";
    const domain = profile?.domain || "";

    let scenePrompt = "";

    if (visionText) {
      scenePrompt = visionText;
    } else {
      switch (domain) {
        case 'RETIREMENT':
          scenePrompt = "A serene retirement scene with warm lighting, relaxed atmosphere, and a sense of accomplishment and freedom.";
          break;
        case 'CAREER':
          scenePrompt = "A professional, successful scene showing career achievement, leadership, and professional satisfaction.";
          break;
        case 'TRAVEL':
          scenePrompt = "An adventurous travel scene with exotic locations, cultural experiences, and freedom to explore.";
          break;
        case 'HEALTH':
          scenePrompt = "A vibrant wellness scene showing health, vitality, and balanced living.";
          break;
        default:
          scenePrompt = "A joyful scene representing your core life vision with warmth, success, and fulfillment.";
      }
    }

    if (financialTarget && financialLabel) {
      scenePrompt += ` Visually represent the goal of ${financialLabel} (target: $${financialTarget.toLocaleString()}).`;
    }

    const goalText = financialLabel || (visionText ? visionText.slice(0, 50) : "");

    let headerText = "My Vision Board";
    if (domain === 'RETIREMENT') headerText = "My Retirement Vision";
    else if (domain === 'CAREER') headerText = "My Career Vision";
    else if (domain === 'TRAVEL') headerText = "My Adventure Vision";
    else if (domain === 'HEALTH') headerText = "My Wellness Vision";

    return new Response(
      JSON.stringify({ success: true, scenePrompt, goalText, headerText, requestId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(`[${requestId}] Error:`, err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error", requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
