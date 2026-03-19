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

async function getMetaCredentials(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string
) {
  // Try integrations table first
  const { data: integration } = await supabaseClient
    .from("integrations")
    .select("credentials")
    .eq("user_id", userId)
    .eq("provider", "meta_whatsapp")
    .eq("is_active", true)
    .single();

  let accessToken: string | undefined;

  if (integration?.credentials) {
    const creds = integration.credentials as { access_token?: string };
    accessToken = creds.access_token;
  }

  if (!accessToken) {
    accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
  }

  return { accessToken };
}

async function getUserWabas(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string
): Promise<Array<{ waba_id: string; display_name: string | null; phone_number: string | null }>> {
  const { data } = await supabaseClient
    .from("meta_whatsapp_numbers")
    .select("waba_id, display_name, phone_number")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!data || data.length === 0) return [];

  // Deduplicate by waba_id
  const seen = new Set<string>();
  const unique: typeof data = [];
  for (const row of data) {
    if (row.waba_id && !seen.has(row.waba_id)) {
      seen.add(row.waba_id);
      unique.push(row);
    }
  }
  return unique;
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

    const { action, templateId, templateData, wabaId: requestedWabaId } = await req.json();
    console.log(`[meta-template-manager] Action: ${action}, User: ${user.id}`);

    const { accessToken } = await getMetaCredentials(supabaseClient, user.id);

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Meta WhatsApp access token not configured." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve wabaId: use requested, or fallback to env/integration
    let wabaId = requestedWabaId as string | undefined;
    if (!wabaId) {
      // Try integration credentials
      const { data: integration } = await supabaseClient
        .from("integrations")
        .select("credentials")
        .eq("user_id", user.id)
        .eq("provider", "meta_whatsapp")
        .eq("is_active", true)
        .single();

      if (integration?.credentials) {
        const creds = integration.credentials as { waba_id?: string; business_account_id?: string };
        wabaId = creds.waba_id || creds.business_account_id;
      }
      if (!wabaId) {
        wabaId = Deno.env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID");
      }
    }

    switch (action) {
      case "create": {
        if (!wabaId) {
          return new Response(
            JSON.stringify({ error: "WABA ID is required to create a template. Select a number/WABA." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const components: TemplateComponent[] = [];

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

        const bodyComponent: TemplateComponent = {
          type: "BODY",
          text: templateData.body_text,
        };
        if (templateData.body_examples && templateData.body_examples.length > 0) {
          bodyComponent.example = { body_text: [templateData.body_examples] };
        }
        components.push(bodyComponent);

        if (templateData.footer_text) {
          components.push({ type: "FOOTER", text: templateData.footer_text });
        }

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
              details: metaResult.error,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

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
            status: metaResult.status,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "sync": {
        // Get all distinct WABAs for this user
        const userWabas = await getUserWabas(supabaseClient, user.id);

        // If no numbers in DB, fallback to single wabaId
        const wabasToSync: string[] = userWabas.length > 0
          ? userWabas.map((w) => w.waba_id)
          : wabaId ? [wabaId] : [];

        if (wabasToSync.length === 0) {
          return new Response(
            JSON.stringify({ error: "No WABA configured. Connect a WhatsApp number first." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get all local templates for this user
        const { data: localTemplates } = await supabaseClient
          .from("meta_templates")
          .select("*")
          .eq("user_id", user.id);

        let totalSynced = 0;
        let totalUpdated = 0;
        let totalAdded = 0;

        for (const currentWabaId of wabasToSync) {
          console.log(`[meta-template-manager] Syncing WABA: ${currentWabaId}`);

          const metaResponse = await fetch(
            `${GRAPH_API_BASE}/${currentWabaId}/message_templates?limit=100`,
            {
              headers: { "Authorization": `Bearer ${accessToken}` },
            }
          );

          if (!metaResponse.ok) {
            const errorData = await metaResponse.json();
            console.warn(`[meta-template-manager] Failed to sync WABA ${currentWabaId}:`, errorData);
            continue; // Skip this WABA but continue with others
          }

          const metaData = await metaResponse.json();
          const metaTemplates = metaData.data || [];
          totalSynced += metaTemplates.length;

          for (const metaTemplate of metaTemplates) {
            // Match by name AND waba_id to avoid cross-account collisions
            const localTemplate = localTemplates?.find(
              (t: { name: string; waba_id: string | null }) =>
                t.name === metaTemplate.name && t.waba_id === currentWabaId
            );

            const newStatus = metaTemplate.status?.toLowerCase() || "pending";

            if (localTemplate) {
              if (localTemplate.status !== newStatus || !localTemplate.meta_template_id) {
                await supabaseClient
                  .from("meta_templates")
                  .update({
                    meta_template_id: metaTemplate.id,
                    status: newStatus,
                    rejection_reason: metaTemplate.rejected_reason || null,
                    approved_at: newStatus === "approved" ? new Date().toISOString() : null,
                  })
                  .eq("id", localTemplate.id);
                totalUpdated++;
              }
            } else {
              // Check if there's a duplicate by name only (old data without waba_id)
              const duplicateByName = localTemplates?.find(
                (t: { name: string; waba_id: string | null }) =>
                  t.name === metaTemplate.name && !t.waba_id
              );

              if (duplicateByName) {
                // Fix the old record: set its waba_id
                await supabaseClient
                  .from("meta_templates")
                  .update({
                    waba_id: currentWabaId,
                    meta_template_id: metaTemplate.id,
                    status: newStatus,
                  })
                  .eq("id", duplicateByName.id);
                totalUpdated++;
              } else {
                const bodyComponent = metaTemplate.components?.find(
                  (c: { type: string }) => c.type === "BODY"
                );
                const headerComponent = metaTemplate.components?.find(
                  (c: { type: string }) => c.type === "HEADER"
                );
                const footerComponent = metaTemplate.components?.find(
                  (c: { type: string }) => c.type === "FOOTER"
                );
                const buttonsComponent = metaTemplate.components?.find(
                  (c: { type: string }) => c.type === "BUTTONS"
                );

                await supabaseClient.from("meta_templates").insert({
                  user_id: user.id,
                  meta_template_id: metaTemplate.id,
                  waba_id: currentWabaId,
                  name: metaTemplate.name,
                  language: metaTemplate.language,
                  category: metaTemplate.category,
                  status: newStatus,
                  header_type: headerComponent?.format || "NONE",
                  header_content: headerComponent?.text,
                  body_text: bodyComponent?.text || "",
                  footer_text: footerComponent?.text,
                  buttons: buttonsComponent?.buttons || [],
                  approved_at: newStatus === "approved" ? new Date().toISOString() : null,
                });
                totalAdded++;
              }
            }
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            synced: totalSynced,
            updated: totalUpdated,
            added: totalAdded,
            wabas_synced: wabasToSync.length,
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

        const deleteWabaId = template.waba_id || wabaId;

        if (template.meta_template_id && deleteWabaId) {
          const metaResponse = await fetch(
            `${GRAPH_API_BASE}/${deleteWabaId}/message_templates?name=${template.name}`,
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
        let query = supabaseClient
          .from("meta_templates")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        // Filter by wabaId if provided
        if (requestedWabaId) {
          query = query.eq("waba_id", requestedWabaId);
        }

        const { data: templates, error: listError } = await query;

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
        const draftWabaId = requestedWabaId || wabaId;

        const { data: savedTemplate, error: saveError } = await supabaseClient
          .from("meta_templates")
          .insert({
            user_id: user.id,
            waba_id: draftWabaId,
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
