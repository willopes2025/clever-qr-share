import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const META_API_URL = 'https://graph.facebook.com/v19.0';

interface SendMessageRequest {
  to: string;
  type: 'text' | 'template' | 'image' | 'audio' | 'video' | 'document' | 'interactive';
  text?: { body: string };
  template?: {
    name: string;
    language: { code: string };
    components?: any[];
  };
  image?: { link?: string; id?: string; caption?: string };
  audio?: { link?: string; id?: string };
  video?: { link?: string; id?: string; caption?: string };
  document?: { link?: string; id?: string; filename?: string; caption?: string };
  interactive?: any;
  conversationId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Sessão expirada, faça login novamente' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('[META-SEND] Auth error:', authError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Sessão expirada, faça login novamente' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's Meta WhatsApp integration from database
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'meta_whatsapp')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.log('[META-SEND] No integration found for user:', user.id);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Integração Meta WhatsApp não configurada. Configure nas Settings.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = integration.credentials?.access_token;
    const phoneNumberId = integration.credentials?.phone_number_id;

    if (!accessToken) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Access Token não configurado na integração' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!phoneNumberId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Phone Number ID não configurado na integração' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body: SendMessageRequest = await req.json();
    console.log('[META-SEND] Request:', JSON.stringify(body, null, 2));

    if (!body.to) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Número do destinatário é obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Format phone number (remove + and spaces)
    const formattedPhone = body.to.replace(/[^0-9]/g, '');

    // Build message payload
    const messagePayload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: body.type || 'text'
    };

    switch (body.type) {
      case 'text':
        messagePayload.text = body.text || { body: '' };
        break;
      case 'template':
        if (!body.template?.name) {
          return new Response(JSON.stringify({ 
            success: false,
            error: 'Nome do template é obrigatório' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        messagePayload.template = body.template;
        break;
      case 'image':
        messagePayload.image = body.image;
        break;
      case 'audio':
        messagePayload.audio = body.audio;
        break;
      case 'video':
        messagePayload.video = body.video;
        break;
      case 'document':
        messagePayload.document = body.document;
        break;
      case 'interactive':
        messagePayload.interactive = body.interactive;
        break;
      default:
        messagePayload.type = 'text';
        messagePayload.text = { body: body.text?.body || '' };
    }

    console.log('[META-SEND] Sending to Meta API with phone_number_id:', phoneNumberId);

    // Send message via Meta API
    const response = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    const result = await response.json();
    console.log('[META-SEND] Meta API response:', JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error('[META-SEND] Meta API error:', result.error);
      return new Response(JSON.stringify({ 
        success: false,
        error: result.error?.message || 'Erro ao enviar mensagem' 
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const messageId = result.messages?.[0]?.id;

    // Save message to database if conversationId provided
    if (body.conversationId && messageId) {
      const content = body.type === 'text' ? body.text?.body :
                     body.type === 'template' ? `[Template: ${body.template?.name}]` :
                     body.type === 'image' ? body.image?.caption || '[Imagem]' :
                     body.type === 'video' ? body.video?.caption || '[Vídeo]' :
                     body.type === 'audio' ? '[Áudio]' :
                     body.type === 'document' ? body.document?.caption || body.document?.filename || '[Documento]' :
                     '[Mensagem]';

      await supabase
        .from('inbox_messages')
        .insert({
          conversation_id: body.conversationId,
          content,
          direction: 'outbound',
          status: 'sent',
          whatsapp_message_id: messageId,
          message_type: body.type || 'text',
          user_id: user.id
        });

      // Update conversation
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content?.substring(0, 100),
          updated_at: new Date().toISOString()
        })
        .eq('id', body.conversationId);
    }

    return new Response(JSON.stringify({
      success: true,
      messageId,
      ...result
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[META-SEND] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
