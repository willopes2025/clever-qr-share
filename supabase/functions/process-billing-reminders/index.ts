import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapping from reminder_type to Meta template name and variable order
const META_TEMPLATE_MAP: Record<string, { name: string; vars: string[] }> = {
  emitted: { name: 'cobranca_emitida', vars: ['nome', 'valor', 'data', 'url'] },
  before_5d: { name: 'cobranca_5dias_antes', vars: ['valor', 'data', 'url'] },
  due_day: { name: 'cobranca_dia_vencimento', vars: ['valor', 'url'] },
  after_1d: { name: 'cobranca_1dia_atraso', vars: ['valor', 'data', 'url'] },
  after_3d: { name: 'cobranca_3dias_atraso', vars: ['valor', 'data', 'url'] },
  after_5d: { name: 'cobranca_5dias_atraso', vars: ['valor', 'data', 'url'] },
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
      // Get Asaas integration settings and credentials
      const { data: asaasIntegration } = await supabase
        .from('integrations')
        .select('settings, credentials')
        .eq('user_id', userId)
        .eq('provider', 'asaas')
        .eq('is_active', true)
        .maybeSingle();

      const asaasSettings = (asaasIntegration?.settings as Record<string, any>) || {};
      const asaasCredentials = (asaasIntegration?.credentials as Record<string, any>) || {};
      const asaasApiKey = (asaasCredentials.access_token || asaasCredentials.api_key) as string | undefined;
      const isSandbox = asaasCredentials.environment === 'sandbox' || asaasCredentials.sandbox === true;
      const asaasApiUrl = isSandbox
        ? 'https://sandbox.asaas.com/api/v3'
        : 'https://api.asaas.com/api/v3';

      // Helper: check if Asaas payment is already paid
      const checkPaymentPaid = async (paymentId: string): Promise<boolean> => {
        if (!asaasApiKey || !paymentId) return false;
        try {
          const resp = await fetch(`${asaasApiUrl}/payments/${paymentId}`, {
            headers: { 'access_token': asaasApiKey },
          });
          if (!resp.ok) {
            console.error(`[ASAAS-CHECK] Failed to fetch payment ${paymentId}: ${resp.status}`);
            return false;
          }
          const data = await resp.json();
          const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
          const isPaid = paidStatuses.includes(data.status);
          if (isPaid) {
            console.log(`[ASAAS-CHECK] Payment ${paymentId} already paid (status: ${data.status})`);
          }
          return isPaid;
        } catch (e) {
          console.error(`[ASAAS-CHECK] Error checking payment ${paymentId}:`, e);
          return false;
        }
      };
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
        for (const r of userReminders) {
          await supabase
            .from('billing_reminders')
            .update({ status: 'skipped', error_message: 'No WhatsApp instance available' })
            .eq('id', r.id);
        }
        skipped += userReminders.length;
        continue;
      }

      // Pre-fetch Meta template statuses if using Meta
      let metaTemplateStatuses: Record<string, string> = {};
      if (configuredMetaPhoneNumberId && configuredMetaPhoneNumberId !== 'evolution' && hasMeta) {
        try {
          // Get WABA ID from the meta number
          const { data: metaNumber } = await supabase
            .from('meta_whatsapp_numbers')
            .select('waba_id')
            .eq('phone_number_id', configuredMetaPhoneNumberId)
            .maybeSingle();

          if (metaNumber?.waba_id) {
            const META_API_URL = 'https://graph.facebook.com/v19.0';
            const response = await fetch(
              `${META_API_URL}/${metaNumber.waba_id}/message_templates?fields=name,status,language&limit=100`,
              { headers: { 'Authorization': `Bearer ${metaIntegration!.credentials.access_token}` } }
            );
            if (response.ok) {
              const data = await response.json();
              for (const tmpl of (data.data || [])) {
                if (tmpl.language === 'pt_BR') {
                  metaTemplateStatuses[tmpl.name] = tmpl.status;
                }
              }
            }
          }
        } catch (e) {
          console.error('Error fetching Meta template statuses:', e);
        }
      }

      for (const reminder of userReminders) {
        try {
          // CHECK: Verify payment status with Asaas API before sending
          if (asaasApiKey && reminder.asaas_payment_id) {
            const isPaid = await checkPaymentPaid(reminder.asaas_payment_id);
            if (isPaid) {
              // Cancel this reminder AND all other pending reminders for this payment
              const { error: cancelError } = await supabase
                .from('billing_reminders')
                .update({ status: 'cancelled', error_message: 'Payment already confirmed in Asaas' })
                .eq('asaas_payment_id', reminder.asaas_payment_id)
                .eq('status', 'pending');

              if (cancelError) {
                console.error(`Error cancelling reminders for paid payment ${reminder.asaas_payment_id}:`, cancelError);
              } else {
                console.log(`[ASAAS-CHECK] Cancelled all pending reminders for paid payment ${reminder.asaas_payment_id}`);
              }

              // Also update contact payment status
              if (reminder.asaas_customer_id) {
                await supabase
                  .from('contacts')
                  .update({ asaas_payment_status: 'current' })
                  .eq('asaas_customer_id', reminder.asaas_customer_id);
              }

              skipped++;
              continue;
            }
          }

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
              
              if (!reminder.contact_id) {
                await supabase
                  .from('billing_reminders')
                  .update({ contact_id: contacts[0].id })
                  .eq('id', reminder.id);
              }
            }
          }

          // If still no contact, try to fetch phone from Asaas and auto-create contact
          if (!contactPhone && asaasApiKey) {
            try {
              let custData: any = null;

              // Strategy 1: Try fetching customer directly
              if (reminder.asaas_customer_id) {
                const custResp = await fetch(`${asaasApiUrl}/customers/${reminder.asaas_customer_id}`, {
                  headers: { 'access_token': asaasApiKey },
                });
                if (custResp.ok) {
                  custData = await custResp.json();
                  console.log(`[AUTO-CREATE] Got customer data from customer endpoint for ${reminder.asaas_customer_id}`);
                } else {
                  console.log(`[AUTO-CREATE] Customer ${reminder.asaas_customer_id} returned ${custResp.status}, trying via payment...`);
                  await custResp.text(); // consume body
                }
              }

              // Strategy 2: If customer fetch failed, try via payment endpoint
              if (!custData && reminder.asaas_payment_id) {
                const payResp = await fetch(`${asaasApiUrl}/payments/${reminder.asaas_payment_id}`, {
                  headers: { 'access_token': asaasApiKey },
                });
                if (payResp.ok) {
                  const payData = await payResp.json();
                  if (payData.customer) {
                    // Fetch the customer using the ID from the payment (may be from same account)
                    const custResp2 = await fetch(`${asaasApiUrl}/customers/${payData.customer}`, {
                      headers: { 'access_token': asaasApiKey },
                    });
                    if (custResp2.ok) {
                      custData = await custResp2.json();
                      console.log(`[AUTO-CREATE] Got customer data via payment ${reminder.asaas_payment_id} -> customer ${payData.customer}`);
                    } else {
                      // Use payment data as fallback (has customer name at least)
                      console.log(`[AUTO-CREATE] Customer from payment also failed (${custResp2.status}), using payment name`);
                      await custResp2.text();
                      // Payment doesn't have phone, but we can try to match by name
                      custData = { name: payData.customerName || payData.description, noPhone: true };
                    }
                  }
                } else {
                  console.log(`[AUTO-CREATE] Payment ${reminder.asaas_payment_id} returned ${payResp.status}`);
                  await payResp.text();
                }
              }

              if (custData && !custData.noPhone) {
                const asaasPhone = (custData.mobilePhone || custData.phone || '').replace(/\D/g, '');
                if (asaasPhone && asaasPhone.length >= 10) {
                  // Normalize phone with country code 55
                  let normalizedPhone = asaasPhone;
                  if (!normalizedPhone.startsWith('55')) {
                    normalizedPhone = '55' + normalizedPhone;
                  }

                  // Check if contact with this phone already exists
                  const { data: existingContacts } = await supabase
                    .from('contacts')
                    .select('id, phone, name, label_id')
                    .eq('user_id', userId)
                    .eq('phone', normalizedPhone)
                    .limit(1);

                  if (existingContacts && existingContacts.length > 0) {
                    contactPhone = existingContacts[0].phone;
                    contactName = existingContacts[0].name;
                    contactLabelId = existingContacts[0].label_id;
                    await supabase
                      .from('billing_reminders')
                      .update({ contact_id: existingContacts[0].id })
                      .eq('id', reminder.id);
                    if (reminder.asaas_customer_id) {
                      await supabase
                        .from('contacts')
                        .update({ asaas_customer_id: reminder.asaas_customer_id })
                        .eq('id', existingContacts[0].id);
                    }
                    console.log(`[AUTO-CREATE] Linked existing contact ${existingContacts[0].id} (${contactName}) to Asaas customer`);
                  } else {
                    const newContactName = custData.name || 'Cliente Asaas';
                    const { data: newContact, error: createErr } = await supabase
                      .from('contacts')
                      .insert({
                        user_id: userId,
                        phone: normalizedPhone,
                        name: newContactName,
                        email: custData.email || null,
                        asaas_customer_id: reminder.asaas_customer_id || null,
                        custom_fields: custData.cpfCnpj ? { cpf: custData.cpfCnpj } : null,
                      })
                      .select('id, phone, name, label_id')
                      .single();

                    if (newContact && !createErr) {
                      contactPhone = newContact.phone;
                      contactName = newContact.name;
                      contactLabelId = newContact.label_id;
                      await supabase
                        .from('billing_reminders')
                        .update({ contact_id: newContact.id })
                        .eq('id', reminder.id);
                      reminder.contact_id = newContact.id;
                      console.log(`[AUTO-CREATE] Created new contact ${newContact.id} (${newContactName}, ${normalizedPhone}) from Asaas`);
                    } else {
                      console.error(`[AUTO-CREATE] Failed to create contact:`, createErr);
                    }
                  }
                } else {
                  console.log(`[AUTO-CREATE] Asaas customer has no valid phone: "${asaasPhone}"`);
                }
              } else if (custData?.noPhone) {
                console.log(`[AUTO-CREATE] Customer data available (${custData.name}) but no phone accessible`);
              }
            } catch (e) {
              console.error(`[AUTO-CREATE] Error auto-creating contact for reminder ${reminder.id}:`, e);
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

          // Determine provider
          let useMetaForThis = false;
          let metaPhoneNumberId: string | null = null;
          let evolutionInstanceId: string | null = null;

          if (useEvolutionByConfig) {
            if (hasEvolution) {
              evolutionInstanceId = instances![0].id;
            }
          } else if (configuredMetaPhoneNumberId && hasMeta) {
            useMetaForThis = true;
            metaPhoneNumberId = configuredMetaPhoneNumberId;
          } else if (conversationId) {
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

          // Fallback
          if (!useMetaForThis && !evolutionInstanceId) {
            if (hasEvolution) {
              evolutionInstanceId = instances![0].id;
            } else if (hasMeta) {
              useMetaForThis = true;
              const settings = metaIntegration?.settings as any;
              metaPhoneNumberId = settings?.phone_number_id || null;
            }
          }

          // Send the message
          let sendSuccess = false;

          if (useMetaForThis && hasMeta && metaPhoneNumberId) {
            const formattedPhone = contactPhone.replace(/\D/g, '');
            const META_API_URL = 'https://graph.facebook.com/v19.0';

            // Check if we have an approved Meta template for this reminder type
            const templateInfo = META_TEMPLATE_MAP[reminder.reminder_type];
            const templateApproved = templateInfo && metaTemplateStatuses[templateInfo.name] === 'APPROVED';

            if (templateApproved) {
              // Send via approved Meta template
              const varValues: Record<string, string> = {
                nome: contactName || 'Cliente',
                valor: reminder.value ? Number(reminder.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00',
                data: reminder.due_date ? new Date(reminder.due_date).toLocaleDateString('pt-BR') : '',
                url: reminder.invoice_url || reminder.bank_slip_url || '',
              };

              const parameters = templateInfo.vars.map(v => ({
                type: 'text' as const,
                text: varValues[v] || '',
              }));

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
                  type: 'template',
                  template: {
                    name: templateInfo.name,
                    language: { code: 'pt_BR' },
                    components: [
                      {
                        type: 'body',
                        parameters,
                      },
                    ],
                  },
                }),
              });

              if (response.ok) {
                sendSuccess = true;
                console.log(`[META-TEMPLATE] Sent ${templateInfo.name} for reminder ${reminder.id} to ${formattedPhone}`);
              } else {
                const err = await response.text();
                console.error(`[META-TEMPLATE] Failed:`, err);
                // Fallback to text
                console.log(`[META] Falling back to text message for ${reminder.id}`);
              }
            }

            // Fallback: send as regular text (only works within 24h window)
            if (!sendSuccess) {
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
                console.log(`[META-TEXT] Sent billing reminder ${reminder.id} to ${formattedPhone}`);
              } else {
                const err = await response.text();
                console.error(`[META-TEXT] Failed to send reminder ${reminder.id}:`, err);
                throw new Error(`Meta API error: ${err}`);
              }
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
            if (conversationId) {
              await supabase
                .from('inbox_messages')
                .insert({
                  conversation_id: conversationId,
                  user_id: userId,
                  direction: 'outbound',
                  content: messageContent,
                  message_type: useMetaForThis && META_TEMPLATE_MAP[reminder.reminder_type] ? 'template' : 'text',
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                  sent_via_instance_id: evolutionInstanceId,
                  sent_via_meta_number_id: metaPhoneNumberId,
                });

              await supabase
                .from('conversations')
                .update({
                  last_message_at: new Date().toISOString(),
                  last_message_preview: messageContent.substring(0, 100),
                  last_message_direction: 'outbound',
                })
                .eq('id', conversationId);
            }

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
