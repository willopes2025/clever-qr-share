import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function verifySignature(payload: string, signature: string, appSecret: string): boolean {
  if (!appSecret || !signature) return false;
  
  const expectedSignature = createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');
  
  return signature === `sha256=${expectedSignature}`;
}

// Helper to log webhook events
async function logWebhookEvent(
  supabase: any,
  userId: string | null,
  method: string,
  statusCode: number | null,
  phoneNumberId: string | null,
  eventType: string | null,
  payload: any,
  error: string | null,
  signatureValid: boolean | null
) {
  try {
    // Use a default user_id if none found (for debugging unmatched webhooks)
    const logUserId = userId || '00000000-0000-0000-0000-000000000000';
    
    await supabase.from('meta_webhook_events').insert({
      user_id: logUserId,
      method,
      status_code: statusCode,
      phone_number_id: phoneNumberId,
      event_type: eventType,
      payload,
      error,
      signature_valid: signatureValid,
    });
  } catch (logError) {
    console.error('[META-WEBHOOK] Failed to log event:', logError);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('[META-WEBHOOK] Verification request:', { mode, token, challenge: challenge?.substring(0, 10) });

    if (mode === 'subscribe' && token) {
      // Find ALL active integrations and search for matching verify_token
      const { data: integrations, error } = await supabase
        .from('integrations')
        .select('id, user_id, credentials')
        .eq('provider', 'meta_whatsapp')
        .eq('is_active', true);

      if (error) {
        console.log('[META-WEBHOOK] Error fetching integrations:', error);
      }

      console.log('[META-WEBHOOK] Found', integrations?.length || 0, 'active integrations');

      // Search for integration with matching verify_token
      const matchingIntegration = integrations?.find(
        (i: any) => i.credentials?.verify_token === token
      );
      
      console.log('[META-WEBHOOK] Received token:', token);
      console.log('[META-WEBHOOK] Matching integration:', matchingIntegration?.id || 'none');

      if (matchingIntegration) {
        console.log('[META-WEBHOOK] Verification successful for integration:', matchingIntegration.id);
        
        // Log successful verification
        await logWebhookEvent(
          supabase,
          matchingIntegration.user_id,
          'GET',
          200,
          matchingIntegration.credentials?.phone_number_id || null,
          'verification',
          { mode, challenge: challenge?.substring(0, 20) },
          null,
          null
        );
        
        return new Response(challenge, { 
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }

    console.log('[META-WEBHOOK] Verification failed - no matching verify_token found');
    
    // Log failed verification
    await logWebhookEvent(supabase, null, 'GET', 403, null, 'verification', { mode, token }, 'No matching verify_token found', null);
    
    return new Response('Forbidden', { status: 403 });
  }

  // Handle incoming webhooks (POST request)
  if (req.method === 'POST') {
    let rawBody = '';
    let body: any = null;
    let webhookPhoneNumberId: string | null = null;
    let userId: string | null = null;
    let eventType = 'unknown';
    
    try {
      rawBody = await req.text();
      body = JSON.parse(rawBody);
      
      console.log('[META-WEBHOOK] Received webhook:', JSON.stringify(body, null, 2));

      // Get phone_number_id from webhook payload to find the correct integration
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages' && change.value?.metadata?.phone_number_id) {
            webhookPhoneNumberId = change.value.metadata.phone_number_id;
            
            // Determine event type
            if (change.value.messages?.length > 0) {
              eventType = 'message';
            } else if (change.value.statuses?.length > 0) {
              eventType = 'status';
            }
            break;
          } else if (change.field === 'message_template_status_update') {
            eventType = 'template_status_update';
          }
        }
        if (webhookPhoneNumberId) break;
      }

      console.log('[META-WEBHOOK] Phone Number ID from payload:', webhookPhoneNumberId);

      // Step 1: Find the user via meta_whatsapp_numbers table (primary lookup)
      let integration = null;
      let foundUserId: string | null = null;

      if (webhookPhoneNumberId) {
        // Check meta_whatsapp_numbers first (supports multiple numbers per user)
        const { data: metaNumber } = await supabase
          .from('meta_whatsapp_numbers')
          .select('user_id, default_funnel_id, default_stage_id')
          .eq('phone_number_id', webhookPhoneNumberId)
          .eq('is_active', true)
          .maybeSingle();

        if (metaNumber) {
          foundUserId = metaNumber.user_id;
          console.log('[META-WEBHOOK] Found user via meta_whatsapp_numbers:', foundUserId);

          // Get the integration for this user (contains access_token)
          const { data: userIntegration } = await supabase
            .from('integrations')
            .select('*')
            .eq('user_id', foundUserId)
            .eq('provider', 'meta_whatsapp')
            .eq('is_active', true)
            .maybeSingle();

          integration = userIntegration;
        }
      }

      // Step 2: Fallback to integrations table search
      if (!integration && webhookPhoneNumberId) {
        const { data: integrations } = await supabase
          .from('integrations')
          .select('*')
          .eq('provider', 'meta_whatsapp')
          .eq('is_active', true);

        integration = integrations?.find(
          (i: any) => i.credentials?.phone_number_id === webhookPhoneNumberId ||
                      i.credentials?.all_phone_number_ids?.includes(webhookPhoneNumberId)
        );
      }

      if (!integration) {
        const { data: fallbackIntegration } = await supabase
          .from('integrations')
          .select('*')
          .eq('provider', 'meta_whatsapp')
          .eq('is_active', true)
          .limit(1)
          .single();
        
        integration = fallbackIntegration;
      }

      if (!integration) {
        console.log('[META-WEBHOOK] No active Meta WhatsApp integration found');
        
        await logWebhookEvent(supabase, null, 'POST', 200, webhookPhoneNumberId, eventType, body, 'No integration found', null);
        
        return new Response(JSON.stringify({ success: true, message: 'No integration found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[META-WEBHOOK] Using integration:', integration.id, 'for user:', integration.user_id);
      userId = integration.user_id;

      // Verify signature using app_secret (try integration credentials first, then env var)
      const appSecret = integration.credentials?.app_secret || Deno.env.get('META_WHATSAPP_APP_SECRET');
      const signature = req.headers.get('x-hub-signature-256') || '';
      let signatureValid: boolean | null = null;
      
      if (appSecret && signature) {
        signatureValid = verifySignature(rawBody, signature, appSecret);
        if (!signatureValid) {
          console.error('[META-WEBHOOK] Invalid signature - appSecret source:', integration.credentials?.app_secret ? 'credentials' : 'env', '- signature:', signature.substring(0, 20));
          
          // Log failed signature but DON'T reject - allow processing to continue
          // Meta sometimes sends webhooks before signature can be fully validated
          await logWebhookEvent(supabase, userId, 'POST', 200, webhookPhoneNumberId, eventType, body, 'Signature mismatch (allowed)', false);
          
          console.warn('[META-WEBHOOK] Proceeding despite signature mismatch');
        } else {
          console.log('[META-WEBHOOK] Signature verified successfully');
        }
      } else {
        console.warn('[META-WEBHOOK] No app_secret or signature available, skipping verification');
      }

      // Process each entry
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          // Handle template status updates
          if (change.field === 'message_template_status_update') {
            const value = change.value;
            const templateName = value?.message_template_name;
            const templateStatus = value?.event?.toLowerCase(); // APPROVED, REJECTED, PENDING_DELETION, etc.
            const rejectionReason = value?.reason || value?.other_info?.description || null;

            console.log('[META-WEBHOOK] Template status update:', { templateName, templateStatus, rejectionReason });

            if (templateName && templateStatus && userId) {
              const statusMap: Record<string, string> = {
                approved: 'approved',
                rejected: 'rejected',
                pending_deletion: 'disabled',
                disabled: 'disabled',
                paused: 'paused',
                flagged: 'paused',
              };

              const mappedStatus = statusMap[templateStatus] || templateStatus;

              const updateData: Record<string, any> = {
                status: mappedStatus,
              };

              if (mappedStatus === 'approved') {
                updateData.approved_at = new Date().toISOString();
                updateData.rejection_reason = null;
              } else if (mappedStatus === 'rejected') {
                updateData.rejection_reason = rejectionReason;
              }

              const { error: updateError } = await supabase
                .from('meta_templates')
                .update(updateData)
                .eq('user_id', userId)
                .eq('name', templateName);

              if (updateError) {
                console.error('[META-WEBHOOK] Error updating template status:', updateError);
              } else {
                console.log('[META-WEBHOOK] Template status updated:', templateName, '->', mappedStatus);
              }
            }
            continue;
          }

          if (change.field === 'messages') {
            const value = change.value;

            // Process incoming messages
            for (const message of value.messages || []) {
              const contactPhone = message.from;
              const contactName = value.contacts?.[0]?.profile?.name || contactPhone;
              const messageId = message.id;
              const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();

              console.log('[META-WEBHOOK] Processing message:', { 
                from: contactPhone, 
                type: message.type,
                messageId 
              });

              // Find or create contact
              let { data: contact } = await supabase
                .from('contacts')
                .select('*')
                .eq('user_id', userId)
                .eq('phone', contactPhone)
                .single();

              if (!contact) {
                const { data: newContact, error: contactError } = await supabase
                  .from('contacts')
                  .insert({
                    user_id: userId,
                    phone: contactPhone,
                    name: contactName,
                    status: 'active'
                  })
                  .select()
                  .single();
                
                if (contactError) {
                  console.error('[META-WEBHOOK] Error creating contact:', contactError);
                  continue;
                }
                contact = newContact;
                console.log('[META-WEBHOOK] Created new contact:', contact?.id);
              }

              if (!contact) {
                console.error('[META-WEBHOOK] Failed to create/find contact');
                continue;
              }

              // Find or create conversation
              let { data: conversation } = await supabase
                .from('conversations')
                .select('*')
                .eq('user_id', userId)
                .eq('contact_id', contact.id)
                .single();

              if (!conversation) {
                const { data: newConversation, error: convError } = await supabase
                  .from('conversations')
                  .insert({
                    user_id: userId,
                    contact_id: contact.id,
                    status: 'open',
                    last_message_at: timestamp,
                    provider: 'meta',
                    meta_phone_number_id: webhookPhoneNumberId
                  })
                  .select()
                  .single();
                
                if (convError) {
                  console.error('[META-WEBHOOK] Error creating conversation:', convError);
                  continue;
                }
                conversation = newConversation;
                console.log('[META-WEBHOOK] Created new conversation:', conversation?.id);

                // Auto-create lead for new conversations
                // Priority: 1) Meta number's default funnel, 2) User settings auto-lead funnel
                if (conversation && userId) {
                  try {
                    // Check Meta number's default funnel first
                    let autoFunnelId: string | null = null;
                    let autoStageId: string | null = null;

                    if (metaNumber?.default_funnel_id) {
                      autoFunnelId = metaNumber.default_funnel_id;
                      autoStageId = metaNumber.default_stage_id || null;
                      console.log('[META-WEBHOOK] Using Meta number default funnel:', autoFunnelId);
                    } else {
                      // Fallback to user_settings
                      const { data: userSettings } = await supabase
                        .from('user_settings')
                        .select('auto_create_leads, auto_lead_funnel_id, auto_lead_stage_id')
                        .eq('user_id', userId)
                        .maybeSingle();

                      if (userSettings?.auto_create_leads && userSettings?.auto_lead_funnel_id) {
                        autoFunnelId = userSettings.auto_lead_funnel_id;
                        autoStageId = userSettings.auto_lead_stage_id || null;
                      }
                    }

                    if (autoFunnelId) {
                      console.log('[META-WEBHOOK] Auto-creating lead in funnel:', autoFunnelId);
                      
                      const { data: existingDeal } = await supabase
                        .from('funnel_deals')
                        .select('id')
                        .eq('contact_id', contact.id)
                        .eq('funnel_id', autoFunnelId)
                        .limit(1)
                        .maybeSingle();

                      if (!existingDeal) {
                        let dealStageId = autoStageId;
                        if (!dealStageId) {
                          const { data: firstStage } = await supabase
                            .from('funnel_stages')
                            .select('id')
                            .eq('funnel_id', autoFunnelId)
                            .order('display_order', { ascending: true })
                            .limit(1)
                            .single();
                          dealStageId = firstStage?.id;
                        }

                        if (dealStageId) {
                          const { data: newDeal, error: dealError } = await supabase
                            .from('funnel_deals')
                            .insert({
                              user_id: userId,
                              funnel_id: autoFunnelId,
                              stage_id: dealStageId,
                              contact_id: contact.id,
                              conversation_id: conversation.id,
                              title: `Lead - ${contactName}`,
                              value: 0,
                              source: 'whatsapp',
                            })
                            .select('id')
                            .single();

                          if (dealError) {
                            console.error('[META-WEBHOOK] Error auto-creating deal:', dealError);
                          } else {
                            console.log('[META-WEBHOOK] Auto-created deal:', newDeal?.id);
                            try {
                              const fnUrl = Deno.env.get("SUPABASE_URL")!;
                              const fnKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
                              await fetch(`${fnUrl}/functions/v1/process-funnel-automations`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${fnKey}` },
                                body: JSON.stringify({ dealId: newDeal?.id, toStageId: dealStageId, triggerType: 'on_stage_enter' }),
                              });
                            } catch (autoErr) {
                              console.error('[META-WEBHOOK] Error triggering automations:', autoErr);
                            }
                          }
                        }
                      }
                    }
                  } catch (autoLeadError) {
                    console.error('[META-WEBHOOK] Error in auto-lead creation:', autoLeadError);
                  }
                }
              }

              if (!conversation) {
                console.error('[META-WEBHOOK] Failed to create/find conversation');
                continue;
              }

              // Extract message content based on type
              let content = '';
              let mediaUrl = '';
              let messageType = 'text';

              switch (message.type) {
                case 'text':
                  content = message.text?.body || '';
                  break;
                case 'image':
                  content = message.image?.caption || '[Imagem]';
                  mediaUrl = message.image?.id || '';
                  messageType = 'image';
                  break;
                case 'audio':
                  content = '[Áudio]';
                  mediaUrl = message.audio?.id || '';
                  messageType = 'audio';
                  break;
                case 'video':
                  content = message.video?.caption || '[Vídeo]';
                  mediaUrl = message.video?.id || '';
                  messageType = 'video';
                  break;
                case 'document':
                  content = message.document?.caption || message.document?.filename || '[Documento]';
                  mediaUrl = message.document?.id || '';
                  messageType = 'document';
                  break;
                case 'sticker':
                  content = '[Sticker]';
                  mediaUrl = message.sticker?.id || '';
                  messageType = 'sticker';
                  break;
                case 'location':
                  content = `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`;
                  messageType = 'location';
                  break;
                case 'contacts':
                  content = `[Contato: ${message.contacts?.[0]?.name?.formatted_name || 'Desconhecido'}]`;
                  messageType = 'contacts';
                  break;
                case 'button':
                  content = message.button?.text || '[Botão]';
                  break;
                case 'interactive':
                  content = message.interactive?.button_reply?.title || 
                           message.interactive?.list_reply?.title || 
                           '[Interativo]';
                  break;
                default:
                  content = `[${message.type}]`;
              }

              // Download media from Meta Graph API and persist to Supabase Storage
              let persistedMediaUrl: string | null = null;
              if (mediaUrl && messageType !== 'text' && messageType !== 'location' && messageType !== 'contacts') {
                try {
                  const metaAccessToken = integration.credentials?.access_token || Deno.env.get('META_WHATSAPP_ACCESS_TOKEN');
                  if (metaAccessToken) {
                    console.log(`[META-WEBHOOK] Downloading media ${mediaUrl} from Meta Graph API...`);
                    
                    // Step 1: Get media download URL from Meta
                    const mediaInfoRes = await fetch(`https://graph.facebook.com/v21.0/${mediaUrl}`, {
                      headers: { 'Authorization': `Bearer ${metaAccessToken}` },
                    });
                    
                    if (mediaInfoRes.ok) {
                      const mediaInfo = await mediaInfoRes.json();
                      const downloadUrl = mediaInfo.url;
                      const mimeType = mediaInfo.mime_type || 'application/octet-stream';
                      
                      // Step 2: Download the actual file
                      const mediaRes = await fetch(downloadUrl, {
                        headers: { 'Authorization': `Bearer ${metaAccessToken}` },
                      });
                      
                      if (mediaRes.ok) {
                        const mediaBuffer = await mediaRes.arrayBuffer();
                        const extMap: Record<string, string> = {
                          'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'mp4', 'audio/aac': 'aac',
                          'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
                          'video/mp4': 'mp4', 'video/3gpp': '3gp',
                          'application/pdf': 'pdf',
                        };
                        const ext = extMap[mimeType] || mimeType.split('/')[1] || 'bin';
                        const filePath = `meta/${userId}/${Date.now()}_${mediaUrl}.${ext}`;
                        
                        // Step 3: Upload to Supabase Storage
                        const { error: uploadError } = await supabase.storage
                          .from('inbox-media')
                          .upload(filePath, mediaBuffer, { contentType: mimeType, upsert: false });
                        
                        if (!uploadError) {
                          const { data: publicUrlData } = supabase.storage
                            .from('inbox-media')
                            .getPublicUrl(filePath);
                          persistedMediaUrl = publicUrlData.publicUrl;
                          console.log('[META-WEBHOOK] Media saved to storage:', persistedMediaUrl);
                        } else {
                          console.error('[META-WEBHOOK] Storage upload error:', uploadError);
                        }
                      } else {
                        console.error('[META-WEBHOOK] Failed to download media file:', mediaRes.status);
                      }
                    } else {
                      console.error('[META-WEBHOOK] Failed to get media info:', mediaInfoRes.status);
                    }
                  } else {
                    console.log('[META-WEBHOOK] No access token available for media download');
                  }
                } catch (mediaError) {
                  console.error('[META-WEBHOOK] Error downloading media:', mediaError);
                }
              }

              const finalMediaUrl = persistedMediaUrl || (mediaUrl && mediaUrl.startsWith('http') ? mediaUrl : null);

              // Check if message already exists (avoid duplicates)
              const { data: existingMessage } = await supabase
                .from('inbox_messages')
                .select('id')
                .eq('whatsapp_message_id', messageId)
                .maybeSingle();

              if (existingMessage) {
                console.log('[META-WEBHOOK] Message already exists, skipping:', messageId);
                continue;
              }

              // Save message to inbox_messages table (CORRECTED SCHEMA)
              const { error: msgError } = await supabase
                .from('inbox_messages')
                .insert({
                  user_id: userId,
                  conversation_id: conversation.id,
                  content,
                  direction: 'inbound',
                  status: 'received',
                  whatsapp_message_id: messageId,
                  media_url: finalMediaUrl,
                  message_type: messageType,
                  created_at: timestamp
                });

              if (msgError) {
                console.error('[META-WEBHOOK] Error saving message:', msgError);
              } else {
                console.log('[META-WEBHOOK] Message saved successfully to inbox_messages');
              }

              // Update conversation (reopen if archived)
              const { error: convUpdateError } = await supabase
                .from('conversations')
                .update({
                  last_message_at: timestamp,
                  last_message_preview: content.substring(0, 100),
                  last_message_direction: 'inbound',
                  unread_count: (conversation.unread_count || 0) + 1,
                  updated_at: new Date().toISOString(),
                  status: 'open'
                })
                .eq('id', conversation.id);

              if (convUpdateError) {
                console.error('[META-WEBHOOK] Error updating conversation:', convUpdateError);
              }

              // Update contact last_message_at
              await supabase
                .from('contacts')
                .update({ last_message_at: timestamp })
                .eq('id', contact.id);
            }

            // Process status updates for sent messages
            for (const status of value.statuses || []) {
              console.log('[META-WEBHOOK] Status update:', {
                id: status.id,
                status: status.status,
                recipientId: status.recipient_id,
                timestamp: status.timestamp
              });

              const statusTimestamp = status.timestamp 
                ? new Date(parseInt(status.timestamp) * 1000).toISOString() 
                : new Date().toISOString();

              // Build update object based on status
              const updateData: Record<string, any> = {};

              switch (status.status) {
                case 'sent':
                  updateData.status = 'sent';
                  updateData.sent_at = statusTimestamp;
                  break;
                case 'delivered':
                  updateData.status = 'delivered';
                  updateData.delivered_at = statusTimestamp;
                  break;
                case 'read':
                  updateData.status = 'read';
                  updateData.read_at = statusTimestamp;
                  break;
                case 'failed':
                  updateData.status = 'failed';
                  if (status.errors?.length > 0) {
                    console.error('[META-WEBHOOK] Message failed:', status.errors);
                  }
                  break;
                default:
                  console.log('[META-WEBHOOK] Unknown status:', status.status);
                  continue;
              }

              // Update message status in inbox_messages
              const { error: statusError, data: updatedMsg } = await supabase
                .from('inbox_messages')
                .update(updateData)
                .eq('whatsapp_message_id', status.id)
                .select('id')
                .maybeSingle();

              if (statusError) {
                console.error('[META-WEBHOOK] Error updating message status:', statusError);
              } else if (updatedMsg) {
                console.log('[META-WEBHOOK] Message status updated:', status.id, '->', status.status);
              } else {
                console.log('[META-WEBHOOK] No message found for status update:', status.id);
              }
            }
          }
        }
      }

      // Log successful processing
      await logWebhookEvent(supabase, userId, 'POST', 200, webhookPhoneNumberId, eventType, body, null, true);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error: unknown) {
      console.error('[META-WEBHOOK] Error processing webhook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log error
      await logWebhookEvent(supabase, userId, 'POST', 500, webhookPhoneNumberId, eventType, body, errorMessage, null);
      
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
