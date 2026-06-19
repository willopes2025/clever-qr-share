// Hourly dispatcher: for each enabled buyer_report_objective whose local schedule
// matches "now" in the org timezone, generate the PDF and deliver to managers (email)
// and optionally to each assignee (WhatsApp).
//
// Called by pg_cron every hour. Body: {} or { objective_id: uuid } for manual trigger.

import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveOrgTimezone, nowInTimezone } from "../_shared/timezone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string {
  let p = (raw || "").replace(/\D/g, "");
  if (!p) return "";
  if (p.startsWith("55") && (p.length === 12 || p.length === 13)) p = p.slice(2);
  if (p.length === 10) {
    const ddd = parseInt(p.slice(0, 2), 10);
    if (ddd >= 11 && ddd <= 99) p = p.slice(0, 2) + "9" + p.slice(2);
  }
  return "55" + p;
}

async function processObjective(
  supabase: ReturnType<typeof createClient>,
  obj: any,
  supabaseUrl: string,
  serviceKey: string,
  evolutionApiUrl?: string,
  evolutionApiKey?: string,
) {
  console.log(`[dispatch-buyer] processing objective ${obj.id} - ${obj.name}`);

  // 1. Generate consolidated PDF
  const genResp = await fetch(`${supabaseUrl}/functions/v1/generate-buyer-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ objective_id: obj.id }),
  });
  const gen = await genResp.json();
  if (!genResp.ok || !gen.pdf_url) {
    console.error("[dispatch-buyer] generation failed", gen);
    await supabase.from("buyer_report_objectives")
      .update({ last_run_at: new Date().toISOString() }).eq("id", obj.id);
    return;
  }
  const { run_id, pdf_url, leads_count } = gen;

  let emailStatus = "skipped";
  let waStatus = "skipped";

  // 2. Email managers
  if (obj.manager_user_ids?.length) {
    try {
      const { data: profiles } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const users = (profiles as any)?.users || [];
      const emails: string[] = [];
      for (const uid of obj.manager_user_ids) {
        const u = users.find((x: any) => x.id === uid);
        if (u?.email) emails.push(u.email);
      }
      const { data: org } = await supabase.from("organizations")
        .select("name").eq("id", obj.organization_id).maybeSingle();

      let okCount = 0;
      for (const email of emails) {
        const r = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            templateName: "buyer-report-daily",
            recipientEmail: email,
            idempotencyKey: `buyer-${obj.id}-${new Date().toISOString().slice(0, 10)}-${email}`,
            templateData: {
              objectiveName: obj.name,
              organizationName: (org as any)?.name || "",
              leadsCount: leads_count,
              pdfUrl: pdf_url,
              lookbackDays: obj.lookback_days,
            },
          }),
        });
        if (r.ok) okCount++;
      }
      emailStatus = `sent:${okCount}/${emails.length}`;
    } catch (e) {
      console.error("[dispatch-buyer] email error", e);
      emailStatus = `error:${(e as any).message}`;
    }
  }

  // 3. WhatsApp per assignee (each gets only their own leads)
  if (obj.send_to_assignee_whatsapp && obj.whatsapp_instance_id && evolutionApiUrl && evolutionApiKey) {
    try {
      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, evolution_instance_name")
        .eq("id", obj.whatsapp_instance_id).maybeSingle();
      const instanceName = ((inst as any)?.evolution_instance_name || (inst as any)?.instance_name || "").trim();
      if (!instanceName) throw new Error("Instance not found");

      // Find assignees that have deals in the configured stages
      const since = new Date(Date.now() - obj.lookback_days * 86400000).toISOString();
      const { data: dealAssignees } = await supabase
        .from("funnel_deals")
        .select("responsible_id")
        .eq("funnel_id", obj.funnel_id)
        .in("stage_id", obj.stage_ids)
        .gte("updated_at", since)
        .not("responsible_id", "is", null);

      const assignees = Array.from(new Set((dealAssignees || []).map((d: any) => d.responsible_id)));
      let okCount = 0;
      for (const uid of assignees) {
        // Generate per-user PDF
        const r1 = await fetch(`${supabaseUrl}/functions/v1/generate-buyer-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ objective_id: obj.id, assignee_user_id: uid }),
        });
        const g1 = await r1.json();
        if (!r1.ok || !g1.pdf_url || g1.leads_count === 0) continue;

        const { data: tm } = await supabase
          .from("team_members").select("phone")
          .eq("user_id", uid).eq("organization_id", obj.organization_id)
          .eq("status", "active").maybeSingle();
        const phone = normalizePhone((tm as any)?.phone || "");
        if (!phone) continue;

        const send = await fetch(`${evolutionApiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
          body: JSON.stringify({
            number: phone,
            mediatype: "document",
            media: g1.pdf_url,
            mimetype: "application/pdf",
            fileName: `leads-quentes-${new Date().toISOString().slice(0, 10)}.pdf`,
            caption: `🔥 *${obj.name}* — Você tem *${g1.leads_count}* lead(s) quente(s) hoje.`,
          }),
        });
        if (send.ok) okCount++;
      }
      waStatus = `sent:${okCount}/${assignees.length}`;
    } catch (e) {
      console.error("[dispatch-buyer] wa error", e);
      waStatus = `error:${(e as any).message}`;
    }
  }

  // 4. Update run + objective
  if (run_id) {
    await supabase.from("buyer_report_runs")
      .update({ email_status: emailStatus, whatsapp_status: waStatus })
      .eq("id", run_id);
  }
  await supabase.from("buyer_report_objectives")
    .update({ last_run_at: new Date().toISOString() }).eq("id", obj.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL") || undefined;
  const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY") || undefined;
  const supabase = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));

  // Manual trigger
  if (body.objective_id) {
    const { data: o } = await supabase
      .from("buyer_report_objectives").select("*").eq("id", body.objective_id).maybeSingle();
    if (!o) return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const task = processObjective(supabase, o, supabaseUrl, serviceKey, evolutionApiUrl, evolutionApiKey);
    // @ts-ignore EdgeRuntime
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
    else await task;
    return new Response(JSON.stringify({ success: true, queued: 1 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Scheduled mode: pick all enabled objectives whose local time matches NOW (hour:min within current hour)
  const { data: all } = await supabase
    .from("buyer_report_objectives").select("*").eq("enabled", true);

  const due: any[] = [];
  for (const o of all || []) {
    try {
      const tz = await resolveOrgTimezone(supabase, { organizationId: (o as any).organization_id });
      const nowTz = nowInTimezone(tz);
      if (!(o as any).schedule_days?.includes(nowTz.weekday)) continue;
      const [hh, mm] = ((o as any).schedule_time || "08:00").split(":").map(Number);
      // Trigger if current hour matches scheduled hour, and minute already passed
      if (nowTz.hour === hh && nowTz.minute >= mm) {
        // Skip if already ran today
        const last = (o as any).last_run_at ? new Date((o as any).last_run_at) : null;
        if (last) {
          const lastTz = nowInTimezone(tz, last);
          if (lastTz.isoDate === nowTz.isoDate) continue;
        }
        due.push(o);
      }
    } catch (e) {
      console.error("[dispatch-buyer] tz resolve failed", (o as any).id, e);
    }
  }

  console.log(`[dispatch-buyer] ${due.length} objectives due`);

  const task = (async () => {
    for (const o of due) {
      try {
        await processObjective(supabase, o, supabaseUrl, serviceKey, evolutionApiUrl, evolutionApiKey);
      } catch (e) {
        console.error("[dispatch-buyer] objective failed", (o as any).id, e);
      }
    }
  })();
  // @ts-ignore EdgeRuntime
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
  else await task;

  return new Response(JSON.stringify({ success: true, queued: due.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
