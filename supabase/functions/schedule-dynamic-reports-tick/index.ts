import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOrgTimezone, nowInTimezone } from "../_shared/timezone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduleConfig {
  enabled?: boolean;
  frequency?: "daily" | "weekly" | "monthly";
  hour?: number;   // 0-23 in the org's timezone
  minute?: number; // default 0
  weekdays?: number[]; // 0=Sun..6=Sat, when frequency=weekly
  monthday?: number;   // 1-31, when frequency=monthly
}

function shouldRun(cfg: ScheduleConfig, tz: string): boolean {
  if (!cfg.enabled) return false;
  const nowTz = nowInTimezone(tz);
  const hour = cfg.hour ?? 8;
  const minute = cfg.minute ?? 0;
  // Match within a 5-min window since this is called every 5 minutes.
  const currentMinutes = nowTz.hour * 60 + nowTz.minute;
  const targetMinutes = hour * 60 + minute;
  if (Math.abs(currentMinutes - targetMinutes) > 5) return false;
  if (cfg.frequency === "weekly") {
    return (cfg.weekdays ?? []).includes(nowTz.weekday);
  }
  if (cfg.frequency === "monthly") {
    return (cfg.monthday ?? 1) === nowTz.day;
  }
  return true; // daily
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: reports } = await supabase.from("dynamic_reports")
      .select("id, user_id, organization_id, schedule_config")
      .not("schedule_config->>enabled", "is", null);

    let triggered = 0;
    for (const r of reports ?? []) {
      const cfg = (r.schedule_config || {}) as ScheduleConfig;
      if (!cfg.enabled) continue;
      const tz = await resolveOrgTimezone(supabase, { organizationId: r.organization_id, userId: r.user_id });
      if (!shouldRun(cfg, tz)) continue;

      // Call run-dynamic-report via HTTP so we can send the internal secret header.
      const invokeUrl = `${supabaseUrl}/functions/v1/run-dynamic-report`;
      try {
        const res = await fetch(invokeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceKey,
            "x-internal-secret": serviceKey,
          },
          body: JSON.stringify({ mode: "run", report_id: r.id }),
        });
        if (!res.ok) {
          console.error(`[schedule-tick] report ${r.id} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        } else {
          triggered++;
        }
      } catch (err) {
        console.error(`[schedule-tick] report ${r.id} fetch error`, err);
      }
    }

    return new Response(JSON.stringify({ triggered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[schedule-tick] error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
