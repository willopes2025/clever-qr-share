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
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { email, role, organizationName, inviterName }: InviteRequest = await req.json();

    if (!email || !organizationName) {
      throw new Error("Email and organization name are required");
    }

    console.log(`Sending team invite to ${email} for organization ${organizationName}`);

    // Get the app URL for the invite link
    const appUrl = Deno.env.get("APP_URL") || "https://fgbenetdksqnvwkgnips.lovableproject.com";

    const roleLabel = role === "admin" ? "Administrador" : "Membro";

    // Use fetch directly instead of Resend SDK to reduce bundle size
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Equipe <onboarding@resend.dev>",
        to: [email],
        subject: `Você foi convidado para ${organizationName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Você foi convidado!</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Olá! 👋
              </p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                <strong>${inviterName || "Um administrador"}</strong> convidou você para fazer parte da equipe <strong>${organizationName}</strong> como <strong>${roleLabel}</strong>.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 25px 0;">
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                  Para aceitar o convite:
                </p>
                <ol style="margin: 15px 0 0 0; padding-left: 20px; color: #374151;">
                  <li style="margin-bottom: 8px;">Crie uma conta com este email (${email})</li>
                  <li style="margin-bottom: 8px;">Faça login na plataforma</li>
                  <li>Você terá acesso automático à equipe</li>
                </ol>
              </div>
              
              <div style="text-align: center; margin-top: 25px;">
                <a href="${appUrl}/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Acessar Plataforma
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
                Se você não esperava este convite, pode ignorar este email.
              </p>
            </div>
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
              Este email foi enviado automaticamente. Por favor, não responda.
            </p>
          </body>
          </html>
        `,
      }),
    });

    const responseData = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(`Failed to send email: ${JSON.stringify(responseData)}`);
    }

    console.log("Email sent successfully:", responseData);

    return new Response(JSON.stringify({ success: true, emailResponse: responseData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-team-invite function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
