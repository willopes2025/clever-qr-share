import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { conversationId, content, instanceId } = await req.json();

    if (!conversationId || !content || !instanceId) {
      throw new Error('conversationId, content and instanceId are required');
    }

    console.log(`Sending inbox message for conversation ${conversationId} via instance ${instanceId}`);

    // Get conversation with contact info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        user_id,
        contact:contacts(id, phone, name)
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('Conversation fetch error:', convError);
      throw new Error('Failed to fetch conversation');
    }

    // Get instance info
    const { data: instance, error: instError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, status')
      .eq('id', instanceId)
      .single();

    if (instError || !instance) {
      console.error('Instance fetch error:', instError);
      throw new Error('Failed to fetch instance');
    }

    if (instance.status !== 'connected') {
      throw new Error('Instance is not connected');
    }

    // Type-safe access to contact - cast through unknown first
    const contactData = conversation.contact as unknown as { id: string; phone: string; name: string | null } | null;
    if (!contactData || !contactData.phone) {
      console.error('Contact data:', JSON.stringify(conversation.contact));
      throw new Error('Contact not found');
    }
    
    // Format phone number - remove non-digits
    let phone = contactData.phone.replace(/\D/g, '');
    
    console.log(`Original phone from contact: ${contactData.phone}, cleaned: ${phone}`);
    
    // Validate phone number format
    // Brazilian phones: 10-11 digits without country code, 12-13 with country code (55)
    // If the number doesn't look like a valid Brazilian phone, it might be a Label ID
    const isLikelyLabelId = phone.length > 13 || (phone.length < 10);
    
    if (isLikelyLabelId) {
      console.error(`Invalid phone number format (likely a Label ID): ${phone}`);
      throw new Error(`Número de telefone inválido: ${contactData.phone}. Este contato pode ter sido criado com um ID incorreto. Por favor, atualize o telefone do contato.`);
    }
    
    // Add Brazil country code if missing
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
    }
    
    // Final validation: Brazilian phone with country code should be 12-13 digits
    // 55 + DDD (2 digits) + number (8-9 digits) = 12-13 digits
    if (phone.length < 12 || phone.length > 13) {
      console.error(`Phone number has invalid length after formatting: ${phone} (${phone.length} digits)`);
      throw new Error(`Número de telefone inválido: formato incorreto.`);
    }

    console.log(`Sending message to ${phone} via ${instance.instance_name}`);

    // Create message record first with 'sending' status
    const { data: message, error: msgError } = await supabase
      .from('inbox_messages')
      .insert({
        conversation_id: conversationId,
        user_id: conversation.user_id,
        direction: 'outbound',
        content,
        message_type: 'text',
        status: 'sending',
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (msgError) {
      console.error('Message insert error:', msgError);
      throw new Error('Failed to create message record');
    }

    // Send via Evolution API
    const response = await fetch(
      `${evolutionApiUrl}/message/sendText/${instance.instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey
        },
        body: JSON.stringify({
          number: phone,
          text: content
        })
      }
    );

    const result = await response.json();
    console.log('Evolution API response:', JSON.stringify(result));

    if (response.ok && result.key) {
      // Message sent successfully
      await supabase
        .from('inbox_messages')
        .update({ 
          status: 'sent',
          whatsapp_message_id: result.key.id
        })
        .eq('id', message.id);

      // Update conversation
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.substring(0, 100),
          instance_id: instanceId,
        })
        .eq('id', conversationId);

      console.log(`Message sent successfully to ${phone}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Message sent successfully',
          messageId: message.id,
          whatsappMessageId: result.key.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Message failed
      const errorMessage = result.message || result.error || 'Unknown error';
      
      await supabase
        .from('inbox_messages')
        .update({ 
          status: 'failed'
        })
        .eq('id', message.id);

      console.error(`Message failed: ${errorMessage}`);
      
      throw new Error(errorMessage);
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-inbox-message:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
