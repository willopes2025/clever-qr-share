import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  phoneNumberId?: string; // Allow specifying which number to send from
}

Deno.serve(async (req: Request) => {
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

    // Get user's integration (contains the access_token)
    // First try own integration, then fallback to org members' integration
    let integration = null;
    
    const { data: ownIntegration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'meta_whatsapp')
      .eq('is_active', true)
      .maybeSingle();

    if (ownIntegration) {
      integration = ownIntegration;
    } else {
      // Fallback: find integration from org members
      const { data: orgMemberIds } = await supabase.rpc('get_organization_member_ids', { _user_id: user.id });
      
      if (orgMemberIds && orgMemberIds.length > 0) {
        const { data: orgIntegration } = await supabase
          .from('integrations')
          .select('*')
          .in('user_id', orgMemberIds)
          .eq('provider', 'meta_whatsapp')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        integration = orgIntegration;
        if (integration) {
          console.log('[META-SEND] Using org member integration from user:', integration.user_id);
        }
      }
    }

    if (!integration) {
      console.log('[META-SEND] No integration found for user or org:', user.id);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Integração Meta WhatsApp não configurada. Configure nas Settings.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = integration.credentials?.access_token;
    if (!accessToken) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Access Token não configurado na integração' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine which phone_number_id to use
    let phoneNumberId = body.phoneNumberId || null;

    if (!phoneNumberId) {
      // If conversationId provided, check which meta number is associated
      if (body.conversationId) {
        const { data: conversation } = await supabase
          .from('conversations')
          .select('meta_phone_number_id')
          .eq('id', body.conversationId)
          .maybeSingle();
        
        if (conversation?.meta_phone_number_id) {
          phoneNumberId = conversation.meta_phone_number_id;
          console.log('[META-SEND] Using phone_number_id from conversation:', phoneNumberId);
        }
      }

      // Fallback: use first active meta number for this user or org
      if (!phoneNumberId) {
        const { data: metaNumber } = await supabase
          .from('meta_whatsapp_numbers')
          .select('phone_number_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('connected_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (metaNumber) {
          phoneNumberId = metaNumber.phone_number_id;
          console.log('[META-SEND] Using phone_number_id from meta_whatsapp_numbers:', phoneNumberId);
        } else {
          // Fallback: try org members' meta numbers
          const { data: orgMemberIds } = await supabase.rpc('get_organization_member_ids', { _user_id: user.id });
          if (orgMemberIds && orgMemberIds.length > 0) {
            const { data: orgMetaNumber } = await supabase
              .from('meta_whatsapp_numbers')
              .select('phone_number_id')
              .in('user_id', orgMemberIds)
              .eq('is_active', true)
              .order('connected_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (orgMetaNumber) {
              phoneNumberId = orgMetaNumber.phone_number_id;
              console.log('[META-SEND] Using phone_number_id from org meta_whatsapp_numbers:', phoneNumberId);
            }
          }
        }
      }

      // Final fallback: use from integration credentials
      if (!phoneNumberId) {
        phoneNumberId = integration.credentials?.phone_number_id;
        console.log('[META-SEND] Using phone_number_id from integration:', phoneNumberId);
      }
    }

    if (!phoneNumberId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Phone Number ID não configurado. Conecte um número nas configurações.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Format phone number
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
                     body.type === 'template' ? (body.text?.body || body.template?.name || '[Template]') :
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
          user_id: user.id,
          sent_via_meta_number_id: phoneNumberId,
        });

      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content?.substring(0, 100),
          last_message_direction: 'outbound',
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
