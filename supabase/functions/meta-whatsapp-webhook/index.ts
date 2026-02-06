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
          }
        }
        if (webhookPhoneNumberId) break;
      }

      console.log('[META-WEBHOOK] Phone Number ID from payload:', webhookPhoneNumberId);

      // Find the integration by phone_number_id from credentials
      let integration;
      if (webhookPhoneNumberId) {
        const { data: integrations } = await supabase
          .from('integrations')
          .select('*')
          .eq('provider', 'meta_whatsapp')
          .eq('is_active', true);

        // Find integration matching the phone_number_id
        integration = integrations?.find(
          (i: any) => i.credentials?.phone_number_id === webhookPhoneNumberId
        );
      }

      if (!integration) {
        // Fallback: try to get the first active integration
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
        
        // Log event even without integration (for debugging)
        await logWebhookEvent(supabase, null, 'POST', 200, webhookPhoneNumberId, eventType, body, 'No integration found', null);
        
        return new Response(JSON.stringify({ success: true, message: 'No integration found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[META-WEBHOOK] Using integration:', integration.id, 'for user:', integration.user_id);
      userId = integration.user_id;

      // Verify signature using app_secret from integration credentials
      const appSecret = integration.credentials?.app_secret;
      const signature = req.headers.get('x-hub-signature-256') || '';
      let signatureValid: boolean | null = null;
      
      if (appSecret) {
        signatureValid = verifySignature(rawBody, signature, appSecret);
        if (!signatureValid) {
          console.error('[META-WEBHOOK] Invalid signature');
          
          // Log failed signature
          await logWebhookEvent(supabase, userId, 'POST', 401, webhookPhoneNumberId, eventType, body, 'Invalid signature', false);
          
          return new Response('Invalid signature', { status: 401 });
        }
        console.log('[META-WEBHOOK] Signature verified successfully');
      } else {
        console.warn('[META-WEBHOOK] No app_secret configured, skipping signature verification');
      }

      // Process each entry
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
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
                  media_url: mediaUrl || null,
                  message_type: messageType,
                  created_at: timestamp
                });

              if (msgError) {
                console.error('[META-WEBHOOK] Error saving message:', msgError);
              } else {
                console.log('[META-WEBHOOK] Message saved successfully to inbox_messages');
              }

              // Update conversation
              const { error: convUpdateError } = await supabase
                .from('conversations')
                .update({
                  last_message_at: timestamp,
                  last_message_preview: content.substring(0, 100),
                  last_message_direction: 'inbound',
                  unread_count: (conversation.unread_count || 0) + 1,
                  updated_at: new Date().toISOString()
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
