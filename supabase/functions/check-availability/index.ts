import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const formId = url.searchParams.get('form_id');
    const fieldId = url.searchParams.get('field_id');
    const date = url.searchParams.get('date'); // YYYY-MM-DD

    if (!formId || !fieldId || !date) {
      return new Response(
        JSON.stringify({ error: 'form_id, field_id and date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get form field settings
    const { data: field, error: fieldError } = await supabase
      .from('form_fields')
      .select('settings, form_id')
      .eq('id', fieldId)
      .eq('form_id', formId)
      .single();

    if (fieldError || !field) {
      return new Response(
        JSON.stringify({ error: 'Field not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get form owner
    const { data: form } = await supabase
      .from('forms')
      .select('user_id')
      .eq('id', formId)
      .single();

    if (!form) {
      return new Response(
        JSON.stringify({ error: 'Form not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const schedule = (field.settings as any)?.schedule;
    if (!schedule) {
      return new Response(
        JSON.stringify({ slots: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestedDate = new Date(date + 'T00:00:00');
    const dayOfWeek = requestedDate.getDay(); // 0=Sun, 1=Mon...
    const dayConfig = schedule.weekly_hours?.[String(dayOfWeek)];

    // Check if day is enabled
    if (!dayConfig?.enabled) {
      return new Response(
        JSON.stringify({ slots: [], reason: 'day_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if date is blocked
    if (schedule.blocked_dates?.includes(date)) {
      return new Response(
        JSON.stringify({ slots: [], reason: 'date_blocked' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate all possible slots
    const slotDuration = schedule.slot_duration || 30;
    const [startH, startM] = dayConfig.start.split(':').map(Number);
    const [endH, endM] = dayConfig.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const allSlots: string[] = [];
    for (let m = startMinutes; m + slotDuration <= endMinutes; m += slotDuration) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      allSlots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }

    // Check min advance
    const now = new Date();
    const minAdvanceHours = schedule.min_advance_hours || 0;
    const minAdvanceMs = minAdvanceHours * 60 * 60 * 1000;

    // Fetch existing tasks for the form owner on this date
    // Get organization member IDs to check all members' tasks
    const { data: memberIds } = await supabase.rpc('get_organization_member_ids', {
      _user_id: form.user_id
    });

    const ownerIds = memberIds ? memberIds.map((r: any) => r) : [form.user_id];

    const { data: existingTasks } = await supabase
      .from('conversation_tasks')
      .select('due_date, due_time')
      .eq('due_date', date)
      .in('user_id', ownerIds)
      .is('completed_at', null);

    const occupiedTimes = new Set<string>();
    if (existingTasks) {
      for (const task of existingTasks) {
        if (task.due_time) {
          // due_time is stored as HH:MM or HH:MM:SS
          occupiedTimes.add(task.due_time.substring(0, 5));
        }
      }
    }

    // Also check deal_tasks
    const { data: dealTasks } = await supabase
      .from('deal_tasks')
      .select('due_date, due_time')
      .eq('due_date', date)
      .in('user_id', ownerIds)
      .is('completed_at', null);

    if (dealTasks) {
      for (const task of dealTasks) {
        if (task.due_time) {
          occupiedTimes.add(task.due_time.substring(0, 5));
        }
      }
    }

    // Filter available slots
    const availableSlots = allSlots.filter(slot => {
      // Check if occupied
      if (occupiedTimes.has(slot)) return false;

      // Check min advance time
      if (minAdvanceHours > 0) {
        const slotDate = new Date(`${date}T${slot}:00`);
        if (slotDate.getTime() - now.getTime() < minAdvanceMs) return false;
      }

      return true;
    });

    return new Response(
      JSON.stringify({ slots: availableSlots }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-availability:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
