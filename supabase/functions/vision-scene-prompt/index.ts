import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Vision Scene Prompt Generator
 *
 * Builds a rich scene prompt from the user's onboarding vision profile.
 * Called by VisionBoard to pre-fill prompt fields with personalized content.
 *
 * Returns:
 * - scenePrompt: A descriptive prompt for image generation
 * - goalText: Suggested goal text for the vision board
 * - headerText: Suggested title/header for the vision board
 */
serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] Vision scene prompt request received`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log(`[${requestId}] Missing Authorization header`);
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.log(`[${requestId}] Invalid auth token:`, authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid auth token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const userId = user.id;
    console.log(`[${requestId}] User authenticated: ${userId.slice(0, 8)}...`);

    // Fetch vision profile
    const { data: profile, error: profileError } = await supabase
      .from("user_vision_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error(`[${requestId}] Profile fetch error:`, profileError);
    }

    // Fetch latest or favorite vision board (optional enhancement)
    const { data: boards, error: boardsError } = await supabase
      .from("vision_boards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (boardsError) {
      console.warn(`[${requestId}] Vision boards fetch error:`, boardsError);
    }

    const latestBoard = boards && boards[0];

    // Extract data from profile and boards
    const visionText: string = profile?.vision_text || latestBoard?.prompt || "";
    const financialTarget = profile?.financial_target;
    const financialLabel: string = profile?.financial_target_label || "";
    const primaryUrl: string = profile?.primary_vision_url || latestBoard?.image_url || "";
    const domain: string = profile?.domain || "";

    console.log(`[${requestId}] Building scene prompt. HasVision: ${!!visionText}, HasTarget: ${!!financialTarget}, Domain: ${domain || 'none'}`);

    // Build scene prompt based on available data
    let scenePrompt = "";

    if (visionText) {
      scenePrompt = visionText;
    } else {
      // Default scene prompt based on domain or generic
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

    // Enhance with primary vision context
    if (primaryUrl) {
      scenePrompt += " The scene should feel like a natural evolution of your primary vision board image.";
    }

    // Add financial context if available
    if (financialTarget && financialLabel) {
      scenePrompt += ` Visually represent the goal of ${financialLabel} (target: $${financialTarget.toLocaleString()}).`;
    } else if (financialLabel) {
      scenePrompt += ` Visually represent the goal: ${financialLabel}.`;
    }

    // Build suggested goal and header text
    const goalText = financialLabel || (visionText ? visionText.slice(0, 50) : "");

    let headerText = "My Vision Board";
    if (domain === 'RETIREMENT') {
      headerText = "My Retirement Vision";
    } else if (domain === 'CAREER') {
      headerText = "My Career Vision";
    } else if (domain === 'TRAVEL') {
      headerText = "My Adventure Vision";
    } else if (domain === 'HEALTH') {
      headerText = "My Wellness Vision";
    }

    console.log(`[${requestId}] Scene prompt generated successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        scenePrompt,
        goalText,
        headerText,
        requestId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (err: any) {
    console.error(`[${requestId}] Vision scene prompt error:`, err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal error generating scene prompt",
        requestId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
