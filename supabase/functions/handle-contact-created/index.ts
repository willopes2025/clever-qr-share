import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * handle-contact-created
 *
 * Called by a Postgres AFTER INSERT trigger on the `contacts` table.
 * Finds all active on_contact_created automations for the contact's user
 * and fires process-funnel-automations for any open deals linked to this contact.
 *
 * The function waits up to 3 seconds for deals to be created in the same
 * transaction batch (e.g. form submission or CSV import that creates both
 * the contact and a deal).
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();

    // Supabase Database Webhooks send { type, table, record, schema, old_record }
    // pg_net triggers send the same structure
    const contact = payload?.record ?? payload;

    if (!contact?.id || !contact?.user_id) {
      console.log("[HANDLE-CONTACT-CREATED] Missing contact.id or contact.user_id in payload", payload);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contactId = contact.id as string;
    const userId = contact.user_id as string;

    console.log(`[HANDLE-CONTACT-CREATED] Processing contact ${contactId} for user ${userId}`);

    // Check if there are any active on_contact_created automations for this user
    const { data: automations, error: autoError } = await supabase
      .from("funnel_automations")
      .select("id, funnel_id, trigger_config")
      .eq("user_id", userId)
      .eq("trigger_type", "on_contact_created")
      .eq("is_active", true);

    if (autoError) {
      console.error("[HANDLE-CONTACT-CREATED] Error fetching automations:", autoError);
      return new Response(JSON.stringify({ error: autoError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!automations?.length) {
      console.log("[HANDLE-CONTACT-CREATED] No active on_contact_created automations — skipping");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[HANDLE-CONTACT-CREATED] Found ${automations.length} automation(s), waiting for deals...`);

    // Wait up to 3 seconds in two polls to let deal creation finish
    // (contact + deal often created in the same user action)
    let deals: { id: string }[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
      const { data } = await supabase
        .from("funnel_deals")
        .select("id")
        .eq("contact_id", contactId)
        .is("closed_at", null);
      deals = data || [];
      if (deals.length > 0) break;
    }

    if (!deals.length) {
      console.log(
        `[HANDLE-CONTACT-CREATED] No open deals found for contact ${contactId} after polling — ` +
          "on_contact_created automation skipped (no deal to anchor to)"
      );
      return new Response(JSON.stringify({ ok: true, noDeals: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[HANDLE-CONTACT-CREATED] Found ${deals.length} open deal(s) — firing automations`);

    const results: { dealId: string; status: string }[] = [];

    for (const deal of deals) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/process-funnel-automations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            dealId: deal.id,
            triggerType: "on_contact_created",
          }),
        });

        const text = await response.text();
        console.log(
          `[HANDLE-CONTACT-CREATED] process-funnel-automations for deal ${deal.id}: ${response.status} ${text}`
        );
        results.push({ dealId: deal.id, status: response.ok ? "ok" : "error" });
      } catch (e) {
        console.error(`[HANDLE-CONTACT-CREATED] Error firing automation for deal ${deal.id}:`, e);
        results.push({ dealId: deal.id, status: "error" });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[HANDLE-CONTACT-CREATED] Unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
