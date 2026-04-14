import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert Excel serial number to Date
function excelSerialToDate(serial: number): Date {
  const epoch = new Date(1899, 11, 30);
  return new Date(epoch.getTime() + serial * 86400000);
}

// Parse any date value (ISO string, dd/MM/yyyy, Excel serial)
function parseDateValue(value: unknown): Date | null {
  if (!value) return null;
  
  if (typeof value === 'number') {
    if (value > 25000 && value < 60000) {
      return excelSerialToDate(value);
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  
  if (typeof value === 'string') {
    // Try dd/MM/yyyy
    const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      return new Date(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1]));
    }
    // Try number string (Excel serial)
    const num = Number(value);
    if (!isNaN(num) && num > 25000 && num < 60000) {
      return excelSerialToDate(num);
    }
    // Timezone-safe: parse YYYY-MM-DD as local date
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, dd] = value.split('-').map(Number);
      return new Date(y, m - 1, dd);
    }
    // Standard ISO / Date parse
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const results: { type: string; processed: number; errors: number }[] = [];

    // ========== 1. on_scheduled_exact_time ==========
    {
      const { data: automations } = await supabase
        .from('funnel_automations')
        .select('*')
        .eq('is_active', true)
        .eq('trigger_type', 'on_scheduled_exact_time');

      let processed = 0, errors = 0;
      for (const auto of automations || []) {
        const config = (auto.trigger_config as Record<string, unknown>) || {};
        const scheduledDate = config.scheduled_date as string;
        const scheduledTime = config.scheduled_time as string;
        if (!scheduledDate || !scheduledTime) continue;

        const scheduledMoment = new Date(`${scheduledDate}T${scheduledTime}:00`);
        const diffMinutes = Math.abs((now.getTime() - scheduledMoment.getTime()) / 60000);
        if (diffMinutes > 1) continue;

        const deals = await getDeals(supabase, auto);
        for (const deal of deals) {
          const triggerKey = `exact_${scheduledDate}_${scheduledTime}`;
          const alreadyRun = await checkExecutionLog(supabase, auto.id, deal.id, triggerKey);
          if (alreadyRun) continue;

          try {
            await invokeFunnelAutomation(supabaseUrl, supabaseKey, deal.id, 'on_scheduled_exact_time');
            await logExecution(supabase, auto.id, deal.id, triggerKey);
            processed++;
          } catch { errors++; }
        }
      }
      results.push({ type: 'on_scheduled_exact_time', processed, errors });
    }

    // ========== 2. on_scheduled_daily ==========
    {
      const { data: automations } = await supabase
        .from('funnel_automations')
        .select('*')
        .eq('is_active', true)
        .eq('trigger_type', 'on_scheduled_daily');

      let processed = 0, errors = 0;
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      for (const auto of automations || []) {
        const config = (auto.trigger_config as Record<string, unknown>) || {};
        const dailyTime = config.daily_time as string;
        if (!dailyTime) continue;

        const [targetH, targetM] = dailyTime.split(':').map(Number);
        const [nowH, nowM] = currentTime.split(':').map(Number);
        if (targetH !== nowH || Math.abs(targetM - nowM) > 0) continue;

        const today = now.toISOString().split('T')[0];
        const deals = await getDeals(supabase, auto);
        for (const deal of deals) {
          const triggerKey = `daily_${today}`;
          const alreadyRun = await checkExecutionLog(supabase, auto.id, deal.id, triggerKey);
          if (alreadyRun) continue;

          try {
            await invokeFunnelAutomation(supabaseUrl, supabaseKey, deal.id, 'on_scheduled_daily');
            await logExecution(supabase, auto.id, deal.id, triggerKey);
            processed++;
          } catch { errors++; }
        }
      }
      results.push({ type: 'on_scheduled_daily', processed, errors });
    }

    // ========== 3. on_scheduled_before_date_field ==========
    {
      const { data: automations } = await supabase
        .from('funnel_automations')
        .select('*')
        .eq('is_active', true)
        .eq('trigger_type', 'on_scheduled_before_date_field');

      let processed = 0, errors = 0;
      console.log(`[SCHEDULED] Found ${(automations || []).length} on_scheduled_before_date_field automations`);
      for (const auto of automations || []) {
        const config = (auto.trigger_config as Record<string, unknown>) || {};
        const dateFieldKey = config.date_field_key as string;
        const hoursBefore = config.hours_before as number;
        console.log(`[SCHEDULED] Auto ${auto.id}: dateFieldKey=${dateFieldKey}, hoursBefore=${hoursBefore}, stageId=${auto.stage_id}`);
        if (!dateFieldKey || !hoursBefore) continue;

        const deals = await getDeals(supabase, auto);
        console.log(`[SCHEDULED] Auto ${auto.id}: found ${deals.length} deals`);
        for (const deal of deals) {
          const dateValue = await resolveDateField(supabase, deal, dateFieldKey);
          if (!dateValue) { console.log(`[SCHEDULED] Deal ${deal.id}: no dateValue for ${dateFieldKey}`); continue; }

          const targetDate = parseDateValue(dateValue);
          if (!targetDate) { console.log(`[SCHEDULED] Deal ${deal.id}: could not parse date ${dateValue}`); continue; }

          const triggerTime = new Date(targetDate.getTime() - hoursBefore * 3600000);
          // Trigger if time has passed (up to 7 days ago) - rely on execution log to prevent duplicates
          const diffMs = now.getTime() - triggerTime.getTime();
          console.log(`[SCHEDULED] Deal ${deal.id}: dateValue=${dateValue}, targetDate=${targetDate.toISOString()}, triggerTime=${triggerTime.toISOString()}, diffMs=${diffMs}`);
          if (diffMs < 0 || diffMs > 7 * 24 * 3600000) continue;

          const triggerKey = `before_${dateFieldKey}_${String(dateValue)}`;
          const alreadyRun = await checkExecutionLog(supabase, auto.id, deal.id, triggerKey);
          if (alreadyRun) { console.log(`[SCHEDULED] Deal ${deal.id}: already run`); continue; }

          try {
            await invokeFunnelAutomation(supabaseUrl, supabaseKey, deal.id, 'on_scheduled_before_date_field');
            await logExecution(supabase, auto.id, deal.id, triggerKey);
            processed++;
          } catch { errors++; }
        }
      }
      results.push({ type: 'on_scheduled_before_date_field', processed, errors });
    }

    // ========== 3b. on_scheduled_after_date_field ==========
    {
      const { data: automations } = await supabase
        .from('funnel_automations')
        .select('*')
        .eq('is_active', true)
        .eq('trigger_type', 'on_scheduled_after_date_field');

      let processed = 0, errors = 0;
      for (const auto of automations || []) {
        const config = (auto.trigger_config as Record<string, unknown>) || {};
        const dateFieldKey = config.date_field_key as string;
        const hoursAfter = config.hours_after as number;
        if (!dateFieldKey || !hoursAfter) continue;

        const deals = await getDeals(supabase, auto);
        for (const deal of deals) {
          const dateValue = await resolveDateField(supabase, deal, dateFieldKey);
          if (!dateValue) continue;

          const targetDate = parseDateValue(dateValue);
          if (!targetDate) continue;

          const triggerTime = new Date(targetDate.getTime() + hoursAfter * 3600000);
          // Trigger if time has passed (up to 7 days ago) - rely on execution log to prevent duplicates
          const diffMs = now.getTime() - triggerTime.getTime();
          if (diffMs < 0 || diffMs > 7 * 24 * 3600000) continue;

          const triggerKey = `after_${dateFieldKey}_${String(dateValue)}`;
          const alreadyRun = await checkExecutionLog(supabase, auto.id, deal.id, triggerKey);
          if (alreadyRun) continue;

          try {
            await invokeFunnelAutomation(supabaseUrl, supabaseKey, deal.id, 'on_scheduled_after_date_field');
            await logExecution(supabase, auto.id, deal.id, triggerKey);
            processed++;
          } catch { errors++; }
        }
      }
      results.push({ type: 'on_scheduled_after_date_field', processed, errors });
    }

    // ========== 4. on_hours_after_last_message ==========
    {
      const { data: automations } = await supabase
        .from('funnel_automations')
        .select('*')
        .eq('is_active', true)
        .eq('trigger_type', 'on_hours_after_last_message');

      let processed = 0, errors = 0;
      for (const auto of automations || []) {
        const config = (auto.trigger_config as Record<string, unknown>) || {};
        const hours = config.hours as number;
        if (!hours) continue;

        const deals = await getDeals(supabase, auto);
        for (const deal of deals) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id, last_message_at, last_message_direction')
            .eq('contact_id', deal.contact_id)
            .eq('user_id', deal.user_id)
            .order('last_message_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!conv?.last_message_at || conv.last_message_direction !== 'inbound') continue;

          const lastMsgTime = new Date(conv.last_message_at);
          const triggerTime = new Date(lastMsgTime.getTime() + hours * 3600000);
          const diffMinutes = Math.abs((now.getTime() - triggerTime.getTime()) / 60000);
          if (diffMinutes > 1) continue;

          const triggerKey = `hours_after_msg_${conv.last_message_at}`;
          const alreadyRun = await checkExecutionLog(supabase, auto.id, deal.id, triggerKey);
          if (alreadyRun) continue;

          try {
            await invokeFunnelAutomation(supabaseUrl, supabaseKey, deal.id, 'on_hours_after_last_message');
            await logExecution(supabase, auto.id, deal.id, triggerKey);
            processed++;
          } catch { errors++; }
        }
      }
      results.push({ type: 'on_hours_after_last_message', processed, errors });
    }

    console.log("[SCHEDULED-AUTOMATIONS] Results:", JSON.stringify(results));
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SCHEDULED-AUTOMATIONS] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Resolve date field value from deal or contact
async function resolveDateField(
  supabase: ReturnType<typeof createClient>,
  deal: Record<string, unknown>,
  dateFieldKey: string
): Promise<unknown> {
  // System fields on deal
  if (dateFieldKey === 'expected_close_date') return deal.expected_close_date;
  if (dateFieldKey === 'created_at') return deal.created_at;

  // Try deal custom_fields first
  const dealCf = (deal.custom_fields || {}) as Record<string, unknown>;
  if (dealCf[dateFieldKey] !== undefined && dealCf[dateFieldKey] !== null && dealCf[dateFieldKey] !== '') {
    return dealCf[dateFieldKey];
  }

  // Fallback: check contact custom_fields
  if (deal.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('custom_fields')
      .eq('id', deal.contact_id as string)
      .maybeSingle();

    if (contact) {
      const contactCf = (contact.custom_fields || {}) as Record<string, unknown>;
      if (contactCf[dateFieldKey] !== undefined && contactCf[dateFieldKey] !== null && contactCf[dateFieldKey] !== '') {
        return contactCf[dateFieldKey];
      }
    }
  }

  return null;
}

// Helper: get deals for an automation (filtered by funnel + optional stage)
async function getDeals(supabase: ReturnType<typeof createClient>, automation: Record<string, unknown>) {
  let query = supabase
    .from('funnel_deals')
    .select('id, contact_id, user_id, expected_close_date, custom_fields, stage_id, created_at')
    .eq('funnel_id', automation.funnel_id as string);

  if (automation.stage_id) {
    query = query.eq('stage_id', automation.stage_id as string);
  }

  const { data: finalStages } = await supabase
    .from('funnel_stages')
    .select('id')
    .eq('funnel_id', automation.funnel_id as string)
    .eq('is_final', true);

  const finalStageIds = (finalStages || []).map((s: { id: string }) => s.id);

  const { data: deals } = await query;
  
  return (deals || []).filter((d: { stage_id: string }) => !finalStageIds.includes(d.stage_id));
}

// Helper: check if automation already executed for this deal+trigger_key
async function checkExecutionLog(supabase: ReturnType<typeof createClient>, automationId: string, dealId: string, triggerKey: string): Promise<boolean> {
  const { data } = await supabase
    .from('automation_execution_log')
    .select('id')
    .eq('automation_id', automationId)
    .eq('deal_id', dealId)
    .eq('trigger_key', triggerKey)
    .maybeSingle();
  return !!data;
}

// Helper: log execution
async function logExecution(supabase: ReturnType<typeof createClient>, automationId: string, dealId: string, triggerKey: string) {
  await supabase.from('automation_execution_log').insert({
    automation_id: automationId,
    deal_id: dealId,
    trigger_key: triggerKey,
  });
}

// Helper: invoke the main funnel automation processor
async function invokeFunnelAutomation(supabaseUrl: string, supabaseKey: string, dealId: string, triggerType: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/process-funnel-automations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ dealId, triggerType }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to invoke automation: ${errorText}`);
  }
  return response.json();
}
