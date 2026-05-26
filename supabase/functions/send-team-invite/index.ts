import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  role: string;
  organizationName: string;
  inviterName: string;
  inviteId?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Authorization header required");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { email, role, organizationName, inviterName, inviteId }: InviteRequest = await req.json();
    if (!email || !organizationName) {
      throw new Error("Email and organization name are required");
    }

    const appUrl = Deno.env.get("APP_URL") || "https://zap.wideic.com";
    const roleLabel = role === "admin" ? "Administrador" : "Membro";

    console.log(`Enqueuing team invite to ${email} for ${organizationName}`);

    const { data, error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "team-invite",
        recipientEmail: email,
        idempotencyKey: `team-invite-${inviteId ?? email}-${organizationName}`,
        templateData: {
          organizationName,
          inviterName: inviterName || "Um administrador",
          roleLabel,
          recipientEmail: email,
          appUrl,
        },
      },
    });

    if (error) throw new Error(`Failed to enqueue email: ${error.message}`);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-team-invite function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
