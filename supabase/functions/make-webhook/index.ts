import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing token parameter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Find webhook connection by token
  const { data: connection, error: connError } = await supabase
    .from('webhook_connections')
    .select('*')
    .eq('webhook_token', token)
    .eq('is_active', true)
    .single();

  if (connError || !connection) {
    return new Response(
      JSON.stringify({ error: 'Invalid or inactive webhook token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = connection.user_id;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { action } = body;

  if (!action) {
    return new Response(
      JSON.stringify({ error: 'Missing action field' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let result: any = null;
  let status = 'success';
  let errorMessage: string | null = null;

  try {
    switch (action) {
      case 'send_message':
        result = await handleSendMessage(supabase, userId, body);
        break;
      case 'create_lead':
        result = await handleCreateLead(supabase, userId, body);
        break;
      case 'create_deal':
        result = await handleCreateDeal(supabase, userId, body);
        break;
      case 'move_deal':
        result = await handleMoveDeal(supabase, userId, body);
        break;
      case 'update_contact':
        result = await handleUpdateContact(supabase, userId, body);
        break;
      case 'add_tag':
        result = await handleAddTag(supabase, userId, body);
        break;
      case 'remove_tag':
        result = await handleRemoveTag(supabase, userId, body);
        break;
      case 'get_contact_info':
        result = await handleGetContactInfo(supabase, userId, body);
        break;
      case 'get_deal_info':
        result = await handleGetDealInfo(supabase, userId, body);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err) {
    status = 'error';
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[MAKE-WEBHOOK] Error executing ${action}:`, errorMessage);
  }

  // Update last_received_at
  await supabase
    .from('webhook_connections')
    .update({ last_received_at: new Date().toISOString() })
    .eq('id', connection.id);

  // Log the execution
  await supabase.from('webhook_logs').insert({
    connection_id: connection.id,
    user_id: userId,
    direction: 'in',
    action,
    status,
    request_payload: body,
    response_payload: result,
    error_message: errorMessage,
  });

  if (status === 'error') {
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, data: result }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

// ===== ACTION HANDLERS =====

async function handleSendMessage(supabase: any, userId: string, body: any) {
  const { phone, message, instance_id } = body;
  if (!phone || !message) throw new Error('phone and message are required');

  // Find or create contact
  const cleanPhone = phone.replace(/\D/g, '');
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, phone')
    .eq('user_id', userId)
    .eq('phone', cleanPhone)
    .maybeSingle();

  if (!contact) throw new Error(`Contact not found for phone: ${cleanPhone}`);

  // Find conversation
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, instance_id')
    .eq('user_id', userId)
    .eq('contact_id', contact.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) throw new Error('Conversation not found for this contact');

  const targetInstanceId = instance_id || conversation.instance_id;
  if (!targetInstanceId) throw new Error('No instance_id available');

  // Get instance
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('id, instance_name, evolution_instance_name, status')
    .eq('id', targetInstanceId)
    .single();

  if (!instance || instance.status !== 'connected') throw new Error('Instance not connected');

  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;
  const evolutionName = instance.evolution_instance_name || instance.instance_name;

  let formattedPhone = cleanPhone;
  if (!formattedPhone.startsWith('55')) formattedPhone = '55' + formattedPhone;

  // Create message record
  const { data: msg } = await supabase
    .from('inbox_messages')
    .insert({
      conversation_id: conversation.id,
      user_id: userId,
      direction: 'outbound',
      content: message,
      message_type: 'text',
      status: 'sending',
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  // Send via Evolution API
  const response = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: evolutionApiKey,
    },
    body: JSON.stringify({ number: formattedPhone, text: message }),
  });

  const responseData = await response.json();

  if (!response.ok) {
    if (msg) await supabase.from('inbox_messages').update({ status: 'failed' }).eq('id', msg.id);
    throw new Error(`Evolution API error: ${JSON.stringify(responseData)}`);
  }

  if (msg) {
    await supabase.from('inbox_messages').update({ status: 'sent' }).eq('id', msg.id);
  }

  await supabase.from('conversations').update({
    last_message_at: new Date().toISOString(),
    last_message_preview: message.substring(0, 100),
    last_message_direction: 'outbound',
  }).eq('id', conversation.id);

  return { message_id: msg?.id, conversation_id: conversation.id, status: 'sent' };
}

async function handleCreateLead(supabase: any, userId: string, body: any) {
  const { phone, name, email, funnel_id, stage_id, deal_title, deal_value } = body;
  if (!phone) throw new Error('phone is required');

  const cleanPhone = phone.replace(/\D/g, '');

  // Create or find contact
  let { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', cleanPhone)
    .maybeSingle();

  if (!contact) {
    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({ user_id: userId, phone: cleanPhone, name: name || null, email: email || null })
      .select()
      .single();
    if (error) throw new Error(`Failed to create contact: ${error.message}`);
    contact = newContact;
  }

  // Create deal if funnel info provided
  let deal = null;
  if (funnel_id) {
    let targetStageId = stage_id;
    if (!targetStageId) {
      const { data: firstStage } = await supabase
        .from('funnel_stages')
        .select('id')
        .eq('funnel_id', funnel_id)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle();
      targetStageId = firstStage?.id;
    }

    if (targetStageId) {
      const { data: newDeal, error } = await supabase
        .from('funnel_deals')
        .insert({
          funnel_id,
          stage_id: targetStageId,
          contact_id: contact.id,
          user_id: userId,
          title: deal_title || name || cleanPhone,
          value: deal_value || 0,
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create deal: ${error.message}`);
      deal = newDeal;
    }
  }

  return { contact_id: contact.id, deal_id: deal?.id || null };
}

async function handleCreateDeal(supabase: any, userId: string, body: any) {
  const { contact_id, phone, funnel_id, stage_id, title, value } = body;
  if (!funnel_id) throw new Error('funnel_id is required');

  let contactId = contact_id;
  if (!contactId && phone) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', phone.replace(/\D/g, ''))
      .maybeSingle();
    contactId = contact?.id;
  }
  if (!contactId) throw new Error('contact_id or valid phone required');

  let targetStageId = stage_id;
  if (!targetStageId) {
    const { data: firstStage } = await supabase
      .from('funnel_stages')
      .select('id')
      .eq('funnel_id', funnel_id)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();
    targetStageId = firstStage?.id;
  }
  if (!targetStageId) throw new Error('No stage found');

  const { data: deal, error } = await supabase
    .from('funnel_deals')
    .insert({
      funnel_id,
      stage_id: targetStageId,
      contact_id: contactId,
      user_id: userId,
      title: title || 'Deal via Webhook',
      value: value || 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create deal: ${error.message}`);
  return { deal_id: deal.id, stage_id: targetStageId };
}

async function handleMoveDeal(supabase: any, userId: string, body: any) {
  const { deal_id, stage_id, phone } = body;
  if (!stage_id) throw new Error('stage_id is required');

  let targetDealId = deal_id;
  if (!targetDealId && phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (contact) {
      const { data: deals } = await supabase
        .from('funnel_deals')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      targetDealId = deals?.[0]?.id;
    }
  }

  if (!targetDealId) throw new Error('deal_id or valid phone required');

  const { error } = await supabase
    .from('funnel_deals')
    .update({ stage_id })
    .eq('id', targetDealId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to move deal: ${error.message}`);
  return { deal_id: targetDealId, new_stage_id: stage_id };
}

async function handleUpdateContact(supabase: any, userId: string, body: any) {
  const { contact_id, phone, name, email, custom_fields, notes } = body;

  let targetId = contact_id;
  if (!targetId && phone) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', phone.replace(/\D/g, ''))
      .maybeSingle();
    targetId = contact?.id;
  }
  if (!targetId) throw new Error('contact_id or valid phone required');

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (notes !== undefined) updates.notes = notes;
  if (custom_fields !== undefined) updates.custom_fields = custom_fields;

  const { error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', targetId)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to update contact: ${error.message}`);
  return { contact_id: targetId, updated_fields: Object.keys(updates) };
}

async function handleAddTag(supabase: any, userId: string, body: any) {
  const { contact_id, phone, tag_name, tag_id } = body;

  let targetContactId = contact_id;
  if (!targetContactId && phone) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', phone.replace(/\D/g, ''))
      .maybeSingle();
    targetContactId = contact?.id;
  }
  if (!targetContactId) throw new Error('contact_id or valid phone required');

  let targetTagId = tag_id;
  if (!targetTagId && tag_name) {
    // Find or create tag
    let { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('user_id', userId)
      .eq('name', tag_name)
      .maybeSingle();

    if (!tag) {
      const { data: newTag, error } = await supabase
        .from('tags')
        .insert({ user_id: userId, name: tag_name })
        .select()
        .single();
      if (error) throw new Error(`Failed to create tag: ${error.message}`);
      tag = newTag;
    }
    targetTagId = tag.id;
  }
  if (!targetTagId) throw new Error('tag_id or tag_name required');

  const { error } = await supabase
    .from('contact_tags')
    .upsert({ contact_id: targetContactId, tag_id: targetTagId }, { onConflict: 'contact_id,tag_id' });

  if (error) throw new Error(`Failed to add tag: ${error.message}`);
  return { contact_id: targetContactId, tag_id: targetTagId };
}

async function handleRemoveTag(supabase: any, userId: string, body: any) {
  const { contact_id, phone, tag_id, tag_name } = body;

  let targetContactId = contact_id;
  if (!targetContactId && phone) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', phone.replace(/\D/g, ''))
      .maybeSingle();
    targetContactId = contact?.id;
  }
  if (!targetContactId) throw new Error('contact_id or valid phone required');

  let targetTagId = tag_id;
  if (!targetTagId && tag_name) {
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('user_id', userId)
      .eq('name', tag_name)
      .maybeSingle();
    targetTagId = tag?.id;
  }
  if (!targetTagId) throw new Error('tag_id or tag_name required');

  await supabase
    .from('contact_tags')
    .delete()
    .eq('contact_id', targetContactId)
    .eq('tag_id', targetTagId);

  return { contact_id: targetContactId, tag_id: targetTagId, removed: true };
}

async function handleGetContactInfo(supabase: any, userId: string, body: any) {
  const { contact_id, phone } = body;

  let query = supabase
    .from('contacts')
    .select('id, name, phone, email, custom_fields, notes, status, created_at')
    .eq('user_id', userId);

  if (contact_id) {
    query = query.eq('id', contact_id);
  } else if (phone) {
    query = query.eq('phone', phone.replace(/\D/g, ''));
  } else {
    throw new Error('contact_id or phone required');
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Failed to fetch contact: ${error.message}`);
  if (!data) throw new Error('Contact not found');

  // Get tags
  const { data: tags } = await supabase
    .from('contact_tags')
    .select('tags(id, name)')
    .eq('contact_id', data.id);

  // Get deals
  const { data: deals } = await supabase
    .from('funnel_deals')
    .select('id, title, value, stage_id, funnel_id, created_at, funnel_stages(name)')
    .eq('contact_id', data.id)
    .eq('user_id', userId);

  return {
    ...data,
    tags: tags?.map((t: any) => t.tags).filter(Boolean) || [],
    deals: deals || [],
  };
}

async function handleGetDealInfo(supabase: any, userId: string, body: any) {
  const { deal_id } = body;
  if (!deal_id) throw new Error('deal_id is required');

  const { data, error } = await supabase
    .from('funnel_deals')
    .select(`
      id, title, value, stage_id, funnel_id, created_at, closed_at,
      funnel_stages(id, name),
      contacts(id, name, phone, email),
      funnels(id, name)
    `)
    .eq('id', deal_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch deal: ${error.message}`);
  if (!data) throw new Error('Deal not found');

  return data;
}
