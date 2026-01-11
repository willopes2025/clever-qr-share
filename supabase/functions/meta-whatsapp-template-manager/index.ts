import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API_VERSION = "v18.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, templateId, templateData } = await req.json();
    console.log(`[meta-template-manager] Action: ${action}, User: ${user.id}`);

    // Get user's Meta integration config
    const { data: integration, error: integrationError } = await supabaseClient
      .from("integrations")
      .select("config")
      .eq("user_id", user.id)
      .eq("type", "meta_whatsapp")
      .eq("is_active", true)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: "Meta WhatsApp integration not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = integration.config as {
      access_token?: string;
      phone_number_id?: string;
      waba_id?: string;
    };

    if (!config.access_token || !config.waba_id) {
      return new Response(
        JSON.stringify({ error: "Missing Meta API credentials (access_token or waba_id)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = config.access_token;
    const wabaId = config.waba_id;

    switch (action) {
      case "create": {
        // Build template components for Meta API
        const components: TemplateComponent[] = [];

        // Header component
        if (templateData.header_type && templateData.header_type !== "NONE") {
          const headerComponent: TemplateComponent = {
            type: "HEADER",
            format: templateData.header_type,
          };
          
          if (templateData.header_type === "TEXT" && templateData.header_content) {
            headerComponent.text = templateData.header_content;
            if (templateData.header_example) {
              headerComponent.example = { header_text: [templateData.header_example] };
            }
          }
          components.push(headerComponent);
        }

        // Body component (required)
        const bodyComponent: TemplateComponent = {
          type: "BODY",
          text: templateData.body_text,
        };
        
        // Add examples for variables if present
        if (templateData.body_examples && templateData.body_examples.length > 0) {
          bodyComponent.example = { body_text: [templateData.body_examples] };
        }
        components.push(bodyComponent);

        // Footer component
        if (templateData.footer_text) {
          components.push({
            type: "FOOTER",
            text: templateData.footer_text,
          });
        }

        // Buttons component
        if (templateData.buttons && templateData.buttons.length > 0) {
          components.push({
            type: "BUTTONS",
            buttons: templateData.buttons.map((btn: { type: string; text: string; url?: string; phone_number?: string }) => ({
              type: btn.type,
              text: btn.text,
              ...(btn.type === "URL" && btn.url ? { url: btn.url } : {}),
              ...(btn.type === "PHONE_NUMBER" && btn.phone_number ? { phone_number: btn.phone_number } : {}),
            })),
          });
        }

        // Submit to Meta API
        const metaResponse = await fetch(
          `${GRAPH_API_BASE}/${wabaId}/message_templates`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: templateData.name,
              language: templateData.language || "pt_BR",
              category: templateData.category,
              components,
            }),
          }
        );

        const metaResult = await metaResponse.json();
        console.log("[meta-template-manager] Meta API response:", JSON.stringify(metaResult));

        if (!metaResponse.ok) {
          // Save as draft with error
          await supabaseClient.from("meta_templates").insert({
            user_id: user.id,
            waba_id: wabaId,
            name: templateData.name,
            language: templateData.language || "pt_BR",
            category: templateData.category,
            status: "draft",
            rejection_reason: metaResult.error?.message || "Failed to submit to Meta",
            header_type: templateData.header_type,
            header_content: templateData.header_content,
            header_example: templateData.header_example,
            body_text: templateData.body_text,
            body_examples: templateData.body_examples || [],
            footer_text: templateData.footer_text,
            buttons: templateData.buttons || [],
          });

          return new Response(
            JSON.stringify({ 
              error: metaResult.error?.message || "Failed to submit template to Meta",
              details: metaResult.error
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Save to database with Meta template ID
        const { data: savedTemplate, error: saveError } = await supabaseClient
          .from("meta_templates")
          .insert({
            user_id: user.id,
            meta_template_id: metaResult.id,
            waba_id: wabaId,
            name: templateData.name,
            language: templateData.language || "pt_BR",
            category: templateData.category,
            status: "pending",
            header_type: templateData.header_type,
            header_content: templateData.header_content,
            header_example: templateData.header_example,
            body_text: templateData.body_text,
            body_examples: templateData.body_examples || [],
            footer_text: templateData.footer_text,
            buttons: templateData.buttons || [],
            submitted_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (saveError) {
          console.error("[meta-template-manager] Save error:", saveError);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            template: savedTemplate,
            meta_template_id: metaResult.id,
            status: metaResult.status
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "sync": {
        // Sync all pending templates from Meta
        const metaResponse = await fetch(
          `${GRAPH_API_BASE}/${wabaId}/message_templates?limit=100`,
          {
            headers: { "Authorization": `Bearer ${accessToken}` },
          }
        );

        if (!metaResponse.ok) {
          const errorData = await metaResponse.json();
          return new Response(
            JSON.stringify({ error: "Failed to fetch templates from Meta", details: errorData }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const metaData = await metaResponse.json();
        const metaTemplates = metaData.data || [];

        // Get local templates
        const { data: localTemplates } = await supabaseClient
          .from("meta_templates")
          .select("*")
          .eq("user_id", user.id);

        let updated = 0;
        let added = 0;

        for (const metaTemplate of metaTemplates) {
          const localTemplate = localTemplates?.find(
            (t: { name: string }) => t.name === metaTemplate.name
          );

          const newStatus = metaTemplate.status?.toLowerCase() || "pending";

          if (localTemplate) {
            // Update existing
            if (localTemplate.status !== newStatus) {
              await supabaseClient
                .from("meta_templates")
                .update({
                  meta_template_id: metaTemplate.id,
                  status: newStatus,
                  rejection_reason: metaTemplate.rejected_reason || null,
                  approved_at: newStatus === "approved" ? new Date().toISOString() : null,
                })
                .eq("id", localTemplate.id);
              updated++;
            }
          } else {
            // Add new template from Meta
            const bodyComponent = metaTemplate.components?.find(
              (c: { type: string }) => c.type === "BODY"
            );
            const headerComponent = metaTemplate.components?.find(
              (c: { type: string }) => c.type === "HEADER"
            );
            const footerComponent = metaTemplate.components?.find(
              (c: { type: string }) => c.type === "FOOTER"
            );

            await supabaseClient.from("meta_templates").insert({
              user_id: user.id,
              meta_template_id: metaTemplate.id,
              waba_id: wabaId,
              name: metaTemplate.name,
              language: metaTemplate.language,
              category: metaTemplate.category,
              status: newStatus,
              header_type: headerComponent?.format || "NONE",
              header_content: headerComponent?.text,
              body_text: bodyComponent?.text || "",
              footer_text: footerComponent?.text,
              approved_at: newStatus === "approved" ? new Date().toISOString() : null,
            });
            added++;
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            synced: metaTemplates.length,
            updated,
            added
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        if (!templateId) {
          return new Response(
            JSON.stringify({ error: "Template ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get template from database
        const { data: template } = await supabaseClient
          .from("meta_templates")
          .select("*")
          .eq("id", templateId)
          .eq("user_id", user.id)
          .single();

        if (!template) {
          return new Response(
            JSON.stringify({ error: "Template not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Delete from Meta if it was submitted
        if (template.meta_template_id) {
          const metaResponse = await fetch(
            `${GRAPH_API_BASE}/${wabaId}/message_templates?name=${template.name}`,
            {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${accessToken}` },
            }
          );

          if (!metaResponse.ok) {
            const errorData = await metaResponse.json();
            console.warn("[meta-template-manager] Meta delete warning:", errorData);
          }
        }

        // Delete from database
        await supabaseClient
          .from("meta_templates")
          .delete()
          .eq("id", templateId);

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get": {
        // Get single template
        if (!templateId) {
          return new Response(
            JSON.stringify({ error: "Template ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: template, error: fetchError } = await supabaseClient
          .from("meta_templates")
          .select("*")
          .eq("id", templateId)
          .eq("user_id", user.id)
          .single();

        if (fetchError || !template) {
          return new Response(
            JSON.stringify({ error: "Template not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ template }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list": {
        // List all user templates
        const { data: templates, error: listError } = await supabaseClient
          .from("meta_templates")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (listError) {
          return new Response(
            JSON.stringify({ error: listError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ templates }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "save_draft": {
        // Save as draft without submitting to Meta
        const { data: savedTemplate, error: saveError } = await supabaseClient
          .from("meta_templates")
          .insert({
            user_id: user.id,
            waba_id: wabaId,
            name: templateData.name,
            language: templateData.language || "pt_BR",
            category: templateData.category,
            status: "draft",
            header_type: templateData.header_type,
            header_content: templateData.header_content,
            header_example: templateData.header_example,
            body_text: templateData.body_text,
            body_examples: templateData.body_examples || [],
            footer_text: templateData.footer_text,
            buttons: templateData.buttons || [],
          })
          .select()
          .single();

        if (saveError) {
          return new Response(
            JSON.stringify({ error: saveError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, template: savedTemplate }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[meta-template-manager] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
