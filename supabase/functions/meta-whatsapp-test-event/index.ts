import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = user.id;
    console.log('[META-TEST] Creating test event for user:', userId);

    // Get the first active meta_whatsapp_number for this user
    const { data: metaNumber } = await supabase
      .from('meta_whatsapp_numbers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .single();

    const phoneNumberId = metaNumber?.phone_number_id || 'test_phone_number_id';
    const testPhone = '5500999999999'; // Simulated test phone
    const testName = 'Teste Meta WhatsApp';
    const timestamp = new Date().toISOString();

    // Find or create contact
    let { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('phone', testPhone)
      .single();

    if (!contact) {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          user_id: userId,
          phone: testPhone,
          name: testName,
          status: 'active'
        })
        .select()
        .single();
      
      if (contactError) {
        console.error('[META-TEST] Error creating contact:', contactError);
        return new Response(JSON.stringify({ error: 'Failed to create contact' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      contact = newContact;
    }

    // Find or create conversation with provider='meta'
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', contact.id)
      .eq('provider', 'meta')
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
          meta_phone_number_id: phoneNumberId
        })
        .select()
        .single();
      
      if (convError) {
        console.error('[META-TEST] Error creating conversation:', convError);
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      conversation = newConversation;
    }

    // Create test message
    const testMessageId = `test_meta_${Date.now()}`;
    const testContent = `✅ Mensagem de teste Meta WhatsApp (simulada)\n\nEsta mensagem confirma que o sistema está pronto para receber mensagens da API Meta.\n\nData: ${new Date().toLocaleString('pt-BR')}`;

    const { error: msgError } = await supabase
      .from('inbox_messages')
      .insert({
        user_id: userId,
        conversation_id: conversation.id,
        content: testContent,
        direction: 'inbound',
        status: 'received',
        whatsapp_message_id: testMessageId,
        message_type: 'text',
        created_at: timestamp
      });

    if (msgError) {
      console.error('[META-TEST] Error creating message:', msgError);
      return new Response(JSON.stringify({ error: 'Failed to create message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_at: timestamp,
        last_message_preview: testContent.substring(0, 100),
        unread_count: (conversation.unread_count || 0) + 1,
        updated_at: timestamp
      })
      .eq('id', conversation.id);

    console.log('[META-TEST] Test event created successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      conversationId: conversation.id,
      contactId: contact.id,
      message: 'Mensagem de teste criada com sucesso. Verifique o Inbox.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[META-TEST] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
