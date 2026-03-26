import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { source_field_key, target_field_key, source_entity_type, target_entity_type, mode, user_id } = await req.json();

    if (!source_field_key || !target_field_key || !source_entity_type || !target_entity_type || !mode) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure user_id matches authenticated user
    if (user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let transferred = 0;

    // Same entity type: simple field-to-field within same table
    if (source_entity_type === target_entity_type) {
      const table = source_entity_type === "contact" ? "contacts" : "funnel_deals";
      const userCol = source_entity_type === "contact" ? "user_id" : "user_id";

      const { data: rows, error: fetchErr } = await supabase
        .from(table)
        .select("id, custom_fields")
        .eq(userCol, user.id)
        .not("custom_fields", "is", null);

      if (fetchErr) throw fetchErr;

      for (const row of rows || []) {
        const cf = (row.custom_fields || {}) as Record<string, unknown>;
        const val = cf[source_field_key];
        if (val === undefined || val === null || val === "") continue;

        const newCf = { ...cf, [target_field_key]: val };
        if (mode === "move") {
          delete newCf[source_field_key];
        }

        const { error: updErr } = await supabase
          .from(table)
          .update({ custom_fields: newCf })
          .eq("id", row.id);

        if (!updErr) transferred++;
      }
    } else {
      // Cross-entity: contact <-> lead via funnel_deals.contact_id
      if (source_entity_type === "contact" && target_entity_type === "lead") {
        // Read from contacts, write to funnel_deals
        const { data: contacts, error: cErr } = await supabase
          .from("contacts")
          .select("id, custom_fields")
          .eq("user_id", user.id)
          .not("custom_fields", "is", null);
        if (cErr) throw cErr;

        for (const contact of contacts || []) {
          const cf = (contact.custom_fields || {}) as Record<string, unknown>;
          const val = cf[source_field_key];
          if (val === undefined || val === null || val === "") continue;

          // Find deals for this contact
          const { data: deals, error: dErr } = await supabase
            .from("funnel_deals")
            .select("id, custom_fields")
            .eq("contact_id", contact.id);
          if (dErr) continue;

          for (const deal of deals || []) {
            const dealCf = (deal.custom_fields || {}) as Record<string, unknown>;
            const newDealCf = { ...dealCf, [target_field_key]: val };

            const { error: updErr } = await supabase
              .from("funnel_deals")
              .update({ custom_fields: newDealCf })
              .eq("id", deal.id);

            if (!updErr) transferred++;
          }

          // Clear source if move
          if (mode === "move") {
            const newCf = { ...cf };
            delete newCf[source_field_key];
            await supabase
              .from("contacts")
              .update({ custom_fields: newCf })
              .eq("id", contact.id);
          }
        }
      } else {
        // lead -> contact: Read from funnel_deals, write to contacts
        const { data: deals, error: dErr } = await supabase
          .from("funnel_deals")
          .select("id, contact_id, custom_fields")
          .eq("user_id", user.id)
          .not("custom_fields", "is", null);
        if (dErr) throw dErr;

        const contactUpdates = new Map<string, unknown>();

        for (const deal of deals || []) {
          const cf = (deal.custom_fields || {}) as Record<string, unknown>;
          const val = cf[source_field_key];
          if (val === undefined || val === null || val === "" || !deal.contact_id) continue;

          // Store last value per contact (in case multiple deals)
          contactUpdates.set(deal.contact_id, val);

          // Clear source if move
          if (mode === "move") {
            const newCf = { ...cf };
            delete newCf[source_field_key];
            await supabase
              .from("funnel_deals")
              .update({ custom_fields: newCf })
              .eq("id", deal.id);
          }
        }

        for (const [contactId, val] of contactUpdates) {
          const { data: contact, error: cErr } = await supabase
            .from("contacts")
            .select("custom_fields")
            .eq("id", contactId)
            .single();
          if (cErr) continue;

          const cf = (contact.custom_fields || {}) as Record<string, unknown>;
          const newCf = { ...cf, [target_field_key]: val };

          const { error: updErr } = await supabase
            .from("contacts")
            .update({ custom_fields: newCf })
            .eq("id", contactId);

          if (!updErr) transferred++;
        }
      }
    }

    return new Response(JSON.stringify({ transferred }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
