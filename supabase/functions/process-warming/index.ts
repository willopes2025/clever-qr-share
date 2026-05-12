import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Warming progression: messages per day based on current_day
const WARMING_PROGRESSION: Record<number, { min: number; max: number; types: string[] }> = {
  1: { min: 5, max: 10, types: ['text'] },
  2: { min: 8, max: 15, types: ['text'] },
  3: { min: 10, max: 20, types: ['text', 'image'] },
  4: { min: 15, max: 30, types: ['text', 'image'] },
  5: { min: 20, max: 40, types: ['text', 'image', 'audio'] },
  6: { min: 25, max: 50, types: ['text', 'image', 'audio'] },
  7: { min: 30, max: 60, types: ['text', 'image', 'audio'] },
  8: { min: 40, max: 70, types: ['text', 'image', 'audio'] },
  9: { min: 45, max: 80, types: ['text', 'image', 'audio'] },
  10: { min: 50, max: 90, types: ['text', 'image', 'audio'] },
  11: { min: 55, max: 100, types: ['text', 'image', 'audio'] },
  12: { min: 60, max: 110, types: ['text', 'image', 'audio'] },
  13: { min: 65, max: 120, types: ['text', 'image', 'audio'] },
  14: { min: 70, max: 130, types: ['text', 'image', 'audio'] },
  15: { min: 80, max: 150, types: ['text', 'image', 'audio', 'video'] },
  16: { min: 90, max: 160, types: ['text', 'image', 'audio', 'video'] },
  17: { min: 100, max: 170, types: ['text', 'image', 'audio', 'video'] },
  18: { min: 110, max: 180, types: ['text', 'image', 'audio', 'video'] },
  19: { min: 120, max: 190, types: ['text', 'image', 'audio', 'video'] },
  20: { min: 130, max: 200, types: ['text', 'image', 'audio', 'video'] },
  21: { min: 150, max: 250, types: ['text', 'image', 'audio', 'video'] },
};

// Get progression for a given day (caps at day 21)
function getProgression(day: number) {
  const effectiveDay = Math.min(day, 21);
  return WARMING_PROGRESSION[effectiveDay] || WARMING_PROGRESSION[21];
}

// Get random number between min and max
function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Get random item from array
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Batch / pacing config
const BATCH_PER_RUN = 4;
const MIN_DELAY_MS = 8000;
const MAX_DELAY_MS = 25000;

// Check if current hour is within allowed warming hours (8h-22h Brazil time)
function isWithinWarmingHours(): boolean {
  const now = new Date();
  // Adjust to Brazil time (UTC-3)
  const brazilOffset = -3;
  const brazilHour = (now.getUTCHours() + brazilOffset + 24) % 24;
  const brazilMinutes = now.getUTCMinutes();
  console.log(`[WARMING] Current UTC: ${now.getUTCHours()}:${brazilMinutes}, Brazil time: ${brazilHour}:${brazilMinutes}`);
  return brazilHour >= 8 && brazilHour < 22;
}

// Calculate warming level based on progress
function calculateWarmingLevel(currentDay: number, totalSent: number, totalReceived: number): number {
  const responseRate = totalSent > 0 ? totalReceived / totalSent : 0;
  
  if (currentDay >= 21 && totalSent >= 1000 && responseRate >= 0.3) return 5;
  if (currentDay >= 14 && totalSent >= 500 && responseRate >= 0.25) return 4;
  if (currentDay >= 7 && totalSent >= 200 && responseRate >= 0.2) return 3;
  if (currentDay >= 3 && totalSent >= 50 && responseRate >= 0.1) return 2;
  return 1;
}

// Check if a phone number exists on WhatsApp using Evolution API
async function checkWhatsAppNumber(
  evolutionApiUrl: string,
  evolutionApiKey: string,
  instanceName: string,
  phone: string
): Promise<{ exists: boolean; jid?: string }> {
  try {
    console.log(`[WARMING] Checking if ${phone} exists on WhatsApp via ${instanceName}`);
    
    const response = await fetch(
      `${evolutionApiUrl}/chat/whatsappNumbers/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({ numbers: [phone] }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[WARMING] WhatsApp check failed for ${phone}: ${response.status} - ${errorText}`);
      return { exists: false };
    }

    const result = await response.json();
    console.log(`[WARMING] WhatsApp check result for ${phone}:`, JSON.stringify(result));
    
    // Evolution API returns array: [{ exists: true, jid: "...", number: "..." }]
    const numberCheck = Array.isArray(result) ? result[0] : result;
    
    return {
      exists: numberCheck?.exists === true,
      jid: numberCheck?.jid
    };
  } catch (error) {
    console.error(`[WARMING] Error checking WhatsApp number ${phone}:`, error);
    return { exists: false };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if within allowed hours
    const withinHours = isWithinWarmingHours();
    if (!withinHours) {
      console.log('[WARMING] Outside warming hours (8h-22h Brazil time), skipping...');
      return new Response(JSON.stringify({ message: 'Outside warming hours' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('[WARMING] Within allowed hours, proceeding...');

    // Get all active warming schedules
    const { data: schedules, error: schedulesError } = await supabase
      .from('warming_schedules')
      .select(`
        *,
        instance:whatsapp_instances(id, instance_name, status, user_id)
      `)
      .eq('status', 'active');

    if (schedulesError) {
      throw new Error(`Error fetching schedules: ${schedulesError.message}`);
    }

    if (!schedules || schedules.length === 0) {
      console.log('[WARMING] No active warming schedules found');
      return new Response(JSON.stringify({ message: 'No active schedules' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[WARMING] Processing ${schedules.length} active warming schedules`);
    console.log(`[WARMING] Schedule IDs: ${schedules.map(s => s.id).join(', ')}`);

    const results: unknown[] = [];

    const processAll = async () => {
      await Promise.all(schedules.map(async (schedule) => {
      try {
        // Skip if instance is not connected
        if (schedule.instance?.status !== 'connected') {
          console.log(`Instance ${schedule.instance?.instance_name} not connected, skipping`);
          return;
        }

        const progression = getProgression(schedule.current_day || 1);
        const targetToday = schedule.messages_target_today && schedule.messages_target_today > 0
          ? schedule.messages_target_today
          : getRandomNumber(progression.min, progression.max);

        // Check if already sent enough messages today
        if (schedule.messages_sent_today >= targetToday) {
          console.log(`Schedule ${schedule.id} already reached target for today (${schedule.messages_sent_today}/${targetToday})`);
          return;
        }

        // ===== Collect targets ONCE per run (reused across the batch) =====
        const { data: pairs } = await supabase
          .from('warming_pairs')
          .select('*, instance_a:whatsapp_instances!warming_pairs_instance_a_id_fkey(id, instance_name, status), instance_b:whatsapp_instances!warming_pairs_instance_b_id_fkey(id, instance_name, status)')
          .eq('user_id', schedule.user_id)
          .eq('is_active', true)
          .or(`instance_a_id.eq.${schedule.instance_id},instance_b_id.eq.${schedule.instance_id}`);

        const { data: contacts } = await supabase
          .from('warming_contacts')
          .select('*')
          .eq('user_id', schedule.user_id)
          .eq('is_active', true);

        const targets: { phone: string; name: string; type: 'pair' | 'contact' | 'pool'; sourceId?: string }[] = [];

        if (pairs) {
          for (const pair of pairs) {
            const otherInstance = pair.instance_a_id === schedule.instance_id ? pair.instance_b : pair.instance_a;
            if (otherInstance?.status === 'connected') {
              const { data: connectionStatus } = await supabase.functions.invoke('check-connection-status', {
                body: { instanceName: otherInstance.instance_name }
              });
              if (connectionStatus?.state === 'open' && connectionStatus?.instance?.owner) {
                targets.push({
                  phone: connectionStatus.instance.owner.replace('@s.whatsapp.net', ''),
                  name: otherInstance.instance_name,
                  type: 'pair',
                  sourceId: pair.id
                });
              }
            }
          }
        }

        if (contacts) {
          for (const contact of contacts) {
            targets.push({
              phone: contact.phone,
              name: contact.name || contact.phone,
              type: 'contact',
              sourceId: contact.id
            });
          }
        }

        const { data: poolEntry } = await supabase
          .from('warming_pool')
          .select('id, phone_number')
          .eq('instance_id', schedule.instance_id)
          .eq('is_active', true)
          .single();

        if (poolEntry) {
          const { data: poolPairs } = await supabase
            .from('warming_pool_pairs')
            .select(`
              *,
              entry_a:warming_pool!warming_pool_pairs_pool_entry_a_id_fkey(id, phone_number, instance:whatsapp_instances(id, status)),
              entry_b:warming_pool!warming_pool_pairs_pool_entry_b_id_fkey(id, phone_number, instance:whatsapp_instances(id, status))
            `)
            .eq('is_active', true)
            .or(`pool_entry_a_id.eq.${poolEntry.id},pool_entry_b_id.eq.${poolEntry.id}`);

          if (poolPairs) {
            for (const poolPair of poolPairs) {
              const otherEntry = poolPair.pool_entry_a_id === poolEntry.id ? poolPair.entry_b : poolPair.entry_a;
              if (otherEntry?.instance?.status === 'connected' && otherEntry?.phone_number) {
                targets.push({
                  phone: otherEntry.phone_number,
                  name: 'Pool Comunitário',
                  type: 'pool',
                  sourceId: poolPair.id
                });
              }
            }
          }
        }

        console.log(`[WARMING] Schedule ${schedule.id} (${schedule.instance?.instance_name}): ${targets.length} targets, day ${schedule.current_day}, ${schedule.messages_sent_today}/${targetToday} today`);

        if (targets.length === 0) {
          console.log(`[WARMING] No targets available for schedule ${schedule.id}`);
          return;
        }

        // ===== BATCH LOOP: send multiple messages per run =====
        let sentToday = schedule.messages_sent_today;
        let totalSent = schedule.total_messages_sent;
        let sentInThisRun = 0;
        let successInThisRun = 0;

        while (sentInThisRun < BATCH_PER_RUN && sentToday < targetToday) {
          // Pick content type & content (refreshed per iteration for variety)
          const contentType = getRandomItem(progression.types);

          let { data: contents } = await supabase
            .from('warming_content')
            .select('*')
            .eq('content_type', contentType)
            .eq('is_active', true)
            .eq('created_by_ai', true)
            .or(`user_id.eq.${schedule.user_id},user_id.eq.00000000-0000-0000-0000-000000000000`)
            .order('created_at', { ascending: false })
            .limit(50);

          if (!contents || contents.length === 0) {
            const { data: regularContents } = await supabase
              .from('warming_content')
              .select('*')
              .eq('content_type', contentType)
              .eq('is_active', true)
              .or(`user_id.eq.${schedule.user_id},user_id.eq.00000000-0000-0000-0000-000000000000`);
            contents = regularContents;
          }

          if (!contents || contents.length === 0) {
            console.log(`[WARMING] No content for type ${contentType}, skipping iteration`);
            sentInThisRun++;
            continue;
          }

          const content = getRandomItem(contents);
          const target = getRandomItem(targets);

          const numberCheck = await checkWhatsAppNumber(
            evolutionApiUrl,
            evolutionApiKey,
            schedule.instance?.instance_name,
            target.phone
          );

          if (!numberCheck.exists) {
            console.log(`[WARMING] ${target.phone} not on WhatsApp, deactivating`);
            if (target.type === 'contact' && target.sourceId) {
              await supabase.from('warming_contacts')
                .update({ is_active: false, notes: 'Número não existe no WhatsApp (verificado automaticamente)' })
                .eq('id', target.sourceId);
            } else if (target.type === 'pool' && target.sourceId) {
              await supabase.from('warming_pool_pairs').update({ is_active: false }).eq('id', target.sourceId);
            }
            await supabase.from('warming_activities').insert({
              schedule_id: schedule.id,
              instance_id: schedule.instance_id,
              activity_type: 'number_invalid',
              contact_phone: target.phone,
              content_preview: 'Número não existe no WhatsApp',
              success: false,
              error_message: 'Número não registrado no WhatsApp',
            });
            // Remove from in-memory targets so we don't keep picking it
            const idx = targets.findIndex(t => t.sourceId === target.sourceId);
            if (idx >= 0) targets.splice(idx, 1);
            if (targets.length === 0) {
              console.log(`[WARMING] All targets exhausted for schedule ${schedule.id}`);
              break;
            }
            sentInThisRun++;
            continue;
          }

          let sendSuccess = false;
          let errorMessage = '';

          try {
            if (contentType === 'text' && content.content) {
              const response = await fetch(`${evolutionApiUrl}/message/sendText/${schedule.instance?.instance_name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
                body: JSON.stringify({ number: target.phone, text: content.content }),
              });
              if (response.ok) sendSuccess = true;
              else errorMessage = `API Error: ${response.status} - ${await response.text()}`;
            } else if (content.media_url) {
              const mediaEndpoint = contentType === 'audio' ? 'sendWhatsAppAudio' : 'sendMedia';
              const mediaBody: Record<string, string> = { number: target.phone, media: content.media_url };
              if (contentType !== 'audio') {
                mediaBody.mediatype = contentType;
                if (content.content) mediaBody.caption = content.content;
              }
              const response = await fetch(`${evolutionApiUrl}/message/${mediaEndpoint}/${schedule.instance?.instance_name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
                body: JSON.stringify(mediaBody),
              });
              if (response.ok) sendSuccess = true;
              else errorMessage = `API Error: ${response.status} - ${await response.text()}`;
            }
          } catch (e: unknown) {
            errorMessage = `Send error: ${e instanceof Error ? e.message : String(e)}`;
          }

          await supabase.from('warming_activities').insert({
            schedule_id: schedule.id,
            instance_id: schedule.instance_id,
            activity_type: `send_${contentType}`,
            contact_phone: target.phone,
            content_preview: content.content?.substring(0, 100) || content.media_url,
            success: sendSuccess,
            error_message: errorMessage || null,
          });

          if (sendSuccess) {
            sentToday++;
            totalSent++;
            successInThisRun++;

            if (target.type === 'pool' && target.sourceId) {
              try {
                const { data: currentPair } = await supabase
                  .from('warming_pool_pairs')
                  .select('messages_exchanged')
                  .eq('id', target.sourceId)
                  .single();
                await supabase
                  .from('warming_pool_pairs')
                  .update({ messages_exchanged: (currentPair?.messages_exchanged || 0) + 1 })
                  .eq('id', target.sourceId);
              } catch (e) {
                console.log(`[WARMING] Failed to update pool pair count: ${e}`);
              }
            }
          }

          results.push({
            scheduleId: schedule.id,
            instanceName: schedule.instance?.instance_name,
            sent: sendSuccess,
            target: target.phone,
            contentType,
            error: errorMessage || null,
          });

          sentInThisRun++;

          // Human-like pacing between sends in the same run (skip after last)
          if (sentInThisRun < BATCH_PER_RUN && sentToday < targetToday) {
            await sleep(getRandomNumber(MIN_DELAY_MS, MAX_DELAY_MS));
          }
        }

        // Single update per schedule per run
        await supabase
          .from('warming_schedules')
          .update({
            messages_sent_today: sentToday,
            total_messages_sent: totalSent,
            messages_target_today: targetToday,
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', schedule.id);

        const newWarmingLevel = calculateWarmingLevel(
          schedule.current_day,
          totalSent,
          schedule.total_messages_received
        );
        await supabase
          .from('whatsapp_instances')
          .update({ warming_level: newWarmingLevel })
          .eq('id', schedule.instance_id);

        console.log(`[WARMING] Schedule ${schedule.id} batch done: ${successInThisRun}/${sentInThisRun} sent (today: ${sentToday}/${targetToday})`);

      } catch (scheduleError: unknown) {
        console.error(`Error processing schedule ${schedule.id}:`, scheduleError);
        results.push({
          scheduleId: schedule.id,
          error: scheduleError instanceof Error ? scheduleError.message : String(scheduleError),
        });
      }
    }

    console.log(`Warming processing complete. Results:`, results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in process-warming:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
