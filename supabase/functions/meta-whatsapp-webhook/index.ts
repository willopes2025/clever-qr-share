import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

serve(async (req) => {
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
        return new Response(challenge, { 
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }

    console.log('[META-WEBHOOK] Verification failed - no matching verify_token found');
    return new Response('Forbidden', { status: 403 });
  }

  // Handle incoming webhooks (POST request)
  if (req.method === 'POST') {
    try {
      const rawBody = await req.text();
      const signature = req.headers.get('x-hub-signature-256') || '';
      const body = JSON.parse(rawBody);
      
      console.log('[META-WEBHOOK] Received webhook:', JSON.stringify(body, null, 2));

      // Get phone_number_id from webhook payload to find the correct integration
      let webhookPhoneNumberId: string | null = null;
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages' && change.value?.metadata?.phone_number_id) {
            webhookPhoneNumberId = change.value.metadata.phone_number_id;
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
        return new Response(JSON.stringify({ success: true, message: 'No integration found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[META-WEBHOOK] Using integration:', integration.id, 'for user:', integration.user_id);

      // Verify signature using app_secret from integration credentials
      const appSecret = integration.credentials?.app_secret;
      if (appSecret) {
        if (!verifySignature(rawBody, signature, appSecret)) {
          console.error('[META-WEBHOOK] Invalid signature');
          return new Response('Invalid signature', { status: 401 });
        }
        console.log('[META-WEBHOOK] Signature verified successfully');
      } else {
        console.warn('[META-WEBHOOK] No app_secret configured, skipping signature verification');
      }

      const userId = integration.user_id;

      // Process each entry
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const value = change.value;

            // Process messages
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
                const { data: newContact } = await supabase
                  .from('contacts')
                  .insert({
                    user_id: userId,
                    phone: contactPhone,
                    name: contactName,
                    status: 'active'
                  })
                  .select()
                  .single();
                contact = newContact;
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
                const { data: newConversation } = await supabase
                  .from('conversations')
                  .insert({
                    user_id: userId,
                    contact_id: contact.id,
                    status: 'open',
                    last_message_at: timestamp
                  })
                  .select()
                  .single();
                conversation = newConversation;
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

              // Save message
              const { error: msgError } = await supabase
                .from('messages')
                .insert({
                  conversation_id: conversation.id,
                  content,
                  sender_type: 'contact',
                  status: 'received',
                  external_id: messageId,
                  media_url: mediaUrl || null,
                  media_type: messageType !== 'text' ? messageType : null,
                  created_at: timestamp
                });

              if (msgError) {
                console.error('[META-WEBHOOK] Error saving message:', msgError);
              }

              // Update conversation
              await supabase
                .from('conversations')
                .update({
                  last_message_at: timestamp,
                  last_message_preview: content.substring(0, 100),
                  unread_count: (conversation.unread_count || 0) + 1,
                  updated_at: new Date().toISOString()
                })
                .eq('id', conversation.id);

              console.log('[META-WEBHOOK] Message saved successfully');

              // ============ AUTO-CREATE DEAL IN FUNNEL "Seven ES" ============
              const SEVEN_ES_FUNNEL_ID = '79c5f8c6-9859-4425-af4b-0234acce9562';
              const FIRST_STAGE_ID = 'e65a59a6-cd53-4b34-bd0a-c7089ed579ff'; // Qualificação

              // Check if there's already an open deal for this contact in "Seven ES"
              const { data: existingDeal } = await supabase
                .from('funnel_deals')
                .select('id')
                .eq('contact_id', contact.id)
                .eq('funnel_id', SEVEN_ES_FUNNEL_ID)
                .is('closed_at', null)
                .maybeSingle();

              if (!existingDeal) {
                const { data: newDeal, error: dealError } = await supabase
                  .from('funnel_deals')
                  .insert({
                    funnel_id: SEVEN_ES_FUNNEL_ID,
                    stage_id: FIRST_STAGE_ID,
                    contact_id: contact.id,
                    conversation_id: conversation.id,
                    user_id: userId,
                    title: contactName || contactPhone,
                    source: 'meta_whatsapp',
                    entered_stage_at: new Date().toISOString()
                  })
                  .select()
                  .single();

                if (dealError) {
                  console.error('[META-WEBHOOK] Error creating deal:', dealError);
                } else {
                  console.log('[META-WEBHOOK] Deal created in funnel Seven ES:', newDeal?.id);
                }
              } else {
                console.log('[META-WEBHOOK] Contact already has open deal in Seven ES:', existingDeal.id);
              }
            }

            // Process status updates
            for (const status of value.statuses || []) {
              console.log('[META-WEBHOOK] Status update:', {
                id: status.id,
                status: status.status,
                recipientId: status.recipient_id
              });

              // Update message status
              const newStatus = status.status === 'delivered' ? 'delivered' :
                               status.status === 'read' ? 'read' :
                               status.status === 'sent' ? 'sent' :
                               status.status === 'failed' ? 'failed' : null;

              if (newStatus) {
                await supabase
                  .from('messages')
                  .update({ status: newStatus })
                  .eq('external_id', status.id);
              }

              // Handle errors
              if (status.errors) {
                console.error('[META-WEBHOOK] Message error:', status.errors);
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error: unknown) {
      console.error('[META-WEBHOOK] Error processing webhook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
