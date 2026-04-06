import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch pending reminders that are due
    const { data: reminders, error: fetchError } = await supabase
      .from('billing_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(100);

    if (fetchError) {
      console.error('Error fetching reminders:', fetchError);
      throw fetchError;
    }

    if (!reminders || reminders.length === 0) {
      console.log('No pending reminders to process');
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing ${reminders.length} billing reminders`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    // Group reminders by user_id for efficiency
    const byUser = new Map<string, typeof reminders>();
    for (const r of reminders) {
      const list = byUser.get(r.user_id) || [];
      list.push(r);
      byUser.set(r.user_id, list);
    }

    for (const [userId, userReminders] of byUser) {
      // Get Asaas integration settings to find configured Meta phone number
      const { data: asaasIntegration } = await supabase
        .from('integrations')
        .select('settings')
        .eq('user_id', userId)
        .eq('provider', 'asaas')
        .eq('is_active', true)
        .maybeSingle();

      const asaasSettings = (asaasIntegration?.settings as Record<string, any>) || {};
      const configuredMetaPhoneNumberId = asaasSettings.billing_meta_phone_number_id as string | undefined;
      const useEvolutionByConfig = configuredMetaPhoneNumberId === 'evolution';

      // Try to find user's default Evolution instance
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, evolution_instance_name, status')
        .eq('user_id', userId)
        .eq('status', 'connected')
        .limit(1);

      // Also check for Meta integration
      const { data: metaIntegration } = await supabase
        .from('integrations')
        .select('id, credentials, settings')
        .eq('user_id', userId)
        .eq('provider', 'meta_whatsapp')
        .eq('is_active', true)
        .maybeSingle();

      const hasEvolution = instances && instances.length > 0;
      const hasMeta = metaIntegration?.credentials?.access_token;

      if (!hasEvolution && !hasMeta) {
        console.log(`No WhatsApp instance found for user ${userId}, skipping ${userReminders.length} reminders`);
        // Mark as skipped
        for (const r of userReminders) {
          await supabase
            .from('billing_reminders')
            .update({ status: 'skipped', error_message: 'No WhatsApp instance available' })
            .eq('id', r.id);
        }
        skipped += userReminders.length;
        continue;
      }

      for (const reminder of userReminders) {
        try {
          // Get contact phone
          let contactPhone: string | null = null;
          let contactName: string | null = null;
          let contactLabelId: string | null = null;

          if (reminder.contact_id) {
            const { data: contact } = await supabase
              .from('contacts')
              .select('phone, name, label_id')
              .eq('id', reminder.contact_id)
              .single();

            if (contact) {
              contactPhone = contact.phone;
              contactName = contact.name;
              contactLabelId = contact.label_id;
            }
          }

          // If no contact found, try to find by asaas_customer_id
          if (!contactPhone && reminder.asaas_customer_id) {
            const { data: contacts } = await supabase
              .from('contacts')
              .select('id, phone, name, label_id')
              .eq('asaas_customer_id', reminder.asaas_customer_id)
              .eq('user_id', userId)
              .limit(1);

            if (contacts && contacts.length > 0) {
              contactPhone = contacts[0].phone;
              contactName = contacts[0].name;
              contactLabelId = contacts[0].label_id;
              
              // Update contact_id if not set
              if (!reminder.contact_id) {
                await supabase
                  .from('billing_reminders')
                  .update({ contact_id: contacts[0].id })
                  .eq('id', reminder.id);
              }
            }
          }

          if (!contactPhone) {
            console.log(`No contact phone found for reminder ${reminder.id}, skipping`);
            await supabase
              .from('billing_reminders')
              .update({ status: 'skipped', error_message: 'Contact phone not found' })
              .eq('id', reminder.id);
            skipped++;
            continue;
          }

          const messageContent = reminder.message_content || `Lembrete de cobrança: R$${reminder.value}`;

          // Find or create conversation
          let conversationId = reminder.conversation_id;
          if (!conversationId && reminder.contact_id) {
            const { data: conv } = await supabase
              .from('conversations')
              .select('id, instance_id, provider, meta_phone_number_id')
              .eq('contact_id', reminder.contact_id)
              .eq('user_id', userId)
              .order('last_message_at', { ascending: false })
              .limit(1);

            if (conv && conv.length > 0) {
              conversationId = conv[0].id;
            }
          }

          // Determine provider from conversation
          let useMetaForThis = false;
          let metaPhoneNumberId: string | null = null;
          let evolutionInstanceId: string | null = null;

          if (conversationId) {
            const { data: conv } = await supabase
              .from('conversations')
              .select('provider, meta_phone_number_id, instance_id')
              .eq('id', conversationId)
              .single();

            if (conv?.provider === 'meta') {
              useMetaForThis = true;
              metaPhoneNumberId = conv.meta_phone_number_id;
            } else if (conv?.instance_id) {
              evolutionInstanceId = conv.instance_id;
            }
          }

          // Fallback: use available provider
          if (!useMetaForThis && !evolutionInstanceId) {
            if (hasEvolution) {
              evolutionInstanceId = instances![0].id;
            } else if (hasMeta) {
              useMetaForThis = true;
              // Get default phone number
              const settings = metaIntegration?.settings as any;
              metaPhoneNumberId = settings?.phone_number_id || null;
            }
          }

          // Send the message
          let sendSuccess = false;

          if (useMetaForThis && hasMeta && metaPhoneNumberId) {
            // Send via Meta WhatsApp Cloud API
            const formattedPhone = contactPhone.replace(/\D/g, '');
            const META_API_URL = 'https://graph.facebook.com/v19.0';

            const response = await fetch(`${META_API_URL}/${metaPhoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${metaIntegration!.credentials.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: formattedPhone,
                type: 'text',
                text: { body: messageContent },
              }),
            });

            if (response.ok) {
              sendSuccess = true;
              console.log(`[META] Sent billing reminder ${reminder.id} to ${formattedPhone}`);
            } else {
              const err = await response.text();
              console.error(`[META] Failed to send reminder ${reminder.id}:`, err);
              throw new Error(`Meta API error: ${err}`);
            }
          } else if (hasEvolution) {
            // Send via Evolution API
            const instance = evolutionInstanceId 
              ? instances!.find(i => i.id === evolutionInstanceId) || instances![0]
              : instances![0];

            const evolutionName = instance.evolution_instance_name || instance.instance_name;
            let phone = contactPhone.replace(/\D/g, '');

            let remoteJid: string;
            const isLid = contactPhone.startsWith('LID_') || (contactLabelId && phone.length > 13);

            if (isLid) {
              const labelId = contactLabelId || phone;
              remoteJid = `${labelId}@lid`;
            } else {
              if (!phone.startsWith('55')) phone = '55' + phone;
              remoteJid = `${phone}@s.whatsapp.net`;
            }

            const response = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionName}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey,
              },
              body: JSON.stringify({
                number: remoteJid,
                text: messageContent,
              }),
            });

            if (response.ok) {
              sendSuccess = true;
              console.log(`[EVO] Sent billing reminder ${reminder.id} to ${remoteJid}`);
            } else {
              const err = await response.text();
              console.error(`[EVO] Failed to send reminder ${reminder.id}:`, err);
              throw new Error(`Evolution API error: ${err}`);
            }
          } else {
            throw new Error('No messaging provider available');
          }

          if (sendSuccess) {
            // Record in inbox_messages
            if (conversationId) {
              await supabase
                .from('inbox_messages')
                .insert({
                  conversation_id: conversationId,
                  user_id: userId,
                  direction: 'outbound',
                  content: messageContent,
                  message_type: 'text',
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                  sent_via_instance_id: evolutionInstanceId,
                  sent_via_meta_number_id: metaPhoneNumberId,
                });

              // Update conversation preview
              await supabase
                .from('conversations')
                .update({
                  last_message_at: new Date().toISOString(),
                  last_message_preview: messageContent.substring(0, 100),
                  last_message_direction: 'outbound',
                })
                .eq('id', conversationId);
            }

            // Mark reminder as sent
            await supabase
              .from('billing_reminders')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', reminder.id);

            sent++;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`Error processing reminder ${reminder.id}:`, errorMsg);

          await supabase
            .from('billing_reminders')
            .update({ status: 'pending', error_message: errorMsg })
            .eq('id', reminder.id);

          failed++;
        }
      }
    }

    console.log(`Billing reminders processed: sent=${sent}, skipped=${skipped}, failed=${failed}`);

    return new Response(JSON.stringify({ success: true, processed: sent, skipped, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing billing reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
