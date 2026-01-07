import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Contact {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  custom_fields: Record<string, string> | null;
}

interface Instance {
  id: string;
  instance_name: string;
  warming_level: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { campaignId, instanceIds, sendingMode = 'sequential' } = await req.json();

    if (!campaignId || !instanceIds || !Array.isArray(instanceIds) || instanceIds.length === 0) {
      throw new Error('Campaign ID and at least one Instance ID are required');
    }

    console.log(`Starting campaign ${campaignId} with ${instanceIds.length} instances in ${sendingMode} mode`);

    // Fetch campaign with template and list
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        template:message_templates(*),
        list:broadcast_lists(*)
      `)
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign fetch error:', campaignError);
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'sending' || campaign.status === 'completed') {
      throw new Error(`Campaign is already ${campaign.status}`);
    }

    // Verify all instances exist and are connected
    const { data: instances, error: instancesError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, status, warming_level')
      .in('id', instanceIds)
      .eq('user_id', user.id);

    if (instancesError) {
      console.error('Instances fetch error:', instancesError);
      throw new Error('Failed to fetch WhatsApp instances');
    }

    if (!instances || instances.length !== instanceIds.length) {
      throw new Error('One or more WhatsApp instances not found');
    }

    const disconnectedInstances = instances.filter(i => i.status !== 'connected');
    if (disconnectedInstances.length > 0) {
      throw new Error(`Instance(s) not connected: ${disconnectedInstances.map(i => i.instance_name).join(', ')}`);
    }

    // Create instances array with id, name, and warming_level
    const validInstances: Instance[] = instances.map(i => ({
      id: i.id,
      instance_name: i.instance_name,
      warming_level: i.warming_level || 1
    }));

    console.log(`Validated ${validInstances.length} connected instances`);

    // Fetch contacts based on list type
    let contacts: Contact[] = [];
    
    if (campaign.list?.type === 'manual') {
      // Manual list: fetch from broadcast_list_contacts junction table
      const { data: listContacts, error: contactsError } = await supabase
        .from('broadcast_list_contacts')
        .select(`
          contact:contacts(id, name, phone, email, custom_fields, opted_out)
        `)
        .eq('list_id', campaign.list_id);

      if (contactsError) {
        console.error('Contacts fetch error:', contactsError);
        throw new Error('Failed to fetch contacts');
      }

      for (const lc of listContacts || []) {
        const contact = lc.contact as unknown as Contact & { opted_out?: boolean };
        if (contact && contact.phone && !contact.opted_out) {
          contacts.push({
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            custom_fields: contact.custom_fields
          });
        }
      }
    } else if (campaign.list?.type === 'dynamic') {
      // Dynamic list: fetch contacts based on filter_criteria
      const filterCriteria = campaign.list.filter_criteria as {
        status?: string;
        optedOut?: boolean;
        tags?: string[];
        asaasPaymentStatus?: 'overdue' | 'pending' | 'current';
      } || {};

      let query = supabase
        .from('contacts')
        .select('id, name, phone, email, custom_fields')
        .eq('user_id', user.id);

      // Apply status filter
      if (filterCriteria.status) {
        query = query.eq('status', filterCriteria.status);
      }

      // Apply opted_out filter (usually false for active contacts)
      if (typeof filterCriteria.optedOut === 'boolean') {
        query = query.eq('opted_out', filterCriteria.optedOut);
      }

      // Apply Asaas payment status filter
      if (filterCriteria.asaasPaymentStatus) {
        query = query.eq('asaas_payment_status', filterCriteria.asaasPaymentStatus);
      }

      const { data: filteredContacts, error: contactsError } = await query;

      if (contactsError) {
        console.error('Contacts fetch error:', contactsError);
        throw new Error('Failed to fetch contacts');
      }

      // If tags filter exists, filter contacts that have those tags
      if (filterCriteria.tags && filterCriteria.tags.length > 0) {
        const { data: taggedContactIds, error: tagsError } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', filterCriteria.tags);

        if (tagsError) {
          console.error('Tags fetch error:', tagsError);
          throw new Error('Failed to fetch contact tags');
        }

        const taggedIds = new Set(taggedContactIds?.map(tc => tc.contact_id) || []);
        contacts = (filteredContacts || [])
          .filter(c => c.phone && taggedIds.has(c.id))
          .map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            custom_fields: c.custom_fields as Record<string, string> | null
          }));
      } else {
        contacts = (filteredContacts || [])
          .filter(c => c.phone)
          .map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            custom_fields: c.custom_fields as Record<string, string> | null
          }));
      }
    }

    if (contacts.length === 0) {
      throw new Error('No contacts found in the broadcast list');
    }

    console.log(`Found ${contacts.length} contacts in list`);

    // Filter out contacts that already received messages based on skip settings
    let filteredContacts = contacts;
    let skippedCount = 0;

    if (campaign.skip_already_sent !== false) {
      const skipMode = campaign.skip_mode || 'same_template';
      const skipDaysPeriod = campaign.skip_days_period || 30;

      // Calculate period start date
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - skipDaysPeriod);
      const periodStartISO = periodStart.toISOString();

      let campaignIdsToCheck: string[] = [];

      // Determine which campaigns to check based on skip_mode
      if (skipMode === 'same_campaign') {
        campaignIdsToCheck = [campaignId];
      } else if (skipMode === 'same_template' && campaign.template_id) {
        const { data: sameTemplateCampaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('template_id', campaign.template_id);
        campaignIdsToCheck = sameTemplateCampaigns?.map(c => c.id) || [];
      } else if (skipMode === 'same_list' && campaign.list_id) {
        const { data: sameListCampaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('list_id', campaign.list_id);
        campaignIdsToCheck = sameListCampaigns?.map(c => c.id) || [];
      }
      // For 'any_campaign', we don't filter by campaign_id

      // Query already sent contacts
      let alreadySentQuery = supabase
        .from('campaign_messages')
        .select('contact_id')
        .in('status', ['sent', 'delivered'])
        .gte('sent_at', periodStartISO);

      // Apply campaign filter if not 'any_campaign'
      if (skipMode !== 'any_campaign' && campaignIdsToCheck.length > 0) {
        alreadySentQuery = alreadySentQuery.in('campaign_id', campaignIdsToCheck);
      }

      const { data: alreadySent } = await alreadySentQuery;
      const alreadySentIds = new Set(alreadySent?.map(m => m.contact_id) || []);

      const originalCount = contacts.length;
      filteredContacts = contacts.filter(c => !alreadySentIds.has(c.id));
      skippedCount = originalCount - filteredContacts.length;

      console.log(`Filtered out ${skippedCount} contacts already sent (mode: ${skipMode}, period: ${skipDaysPeriod} days)`);
    }

    if (filteredContacts.length === 0) {
      throw new Error(`Todos os ${contacts.length} contatos já receberam mensagens no período configurado`);
    }

    console.log(`${filteredContacts.length} contacts will receive messages`);

    // Update campaign status to sending with multiple instance IDs
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'sending',
        started_at: new Date().toISOString(),
        instance_id: instanceIds[0], // Keep first instance for backwards compatibility
        instance_ids: instanceIds,
        sending_mode: sendingMode,
        total_contacts: filteredContacts.length,
        sent: 0,
        delivered: 0,
        failed: 0
      })
      .eq('id', campaignId);

    if (updateError) {
      console.error('Campaign update error:', updateError);
      throw new Error('Failed to update campaign status');
    }

    // Fetch template variations if any
    const { data: variations } = await supabase
      .from('template_variations')
      .select('content')
      .eq('template_id', campaign.template_id);

    // Build array of message options (original + variations)
    const messageOptions: string[] = [campaign.template.content];
    if (variations && variations.length > 0) {
      messageOptions.push(...variations.map(v => v.content));
    }

    console.log(`Using ${messageOptions.length} message variations (1 original + ${variations?.length || 0} variations)`);

    // Create campaign_messages records
    const messageRecords = filteredContacts.map((contact: Contact, index: number) => {
      // Select a random message option for this contact
      const randomIndex = Math.floor(Math.random() * messageOptions.length);
      let messageContent = messageOptions[randomIndex];
      
      // Replace standard variables
      messageContent = messageContent.replace(/\{\{nome\}\}/gi, contact.name || '');
      messageContent = messageContent.replace(/\{\{name\}\}/gi, contact.name || '');
      messageContent = messageContent.replace(/\{\{phone\}\}/gi, contact.phone || '');
      messageContent = messageContent.replace(/\{\{telefone\}\}/gi, contact.phone || '');
      messageContent = messageContent.replace(/\{\{email\}\}/gi, contact.email || '');
      
      // Replace custom_fields variables dynamically
      const customFields = contact.custom_fields || {};
      for (const [key, value] of Object.entries(customFields)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
        messageContent = messageContent.replace(regex, value || '');
      }
      
      // Clean up any remaining unreplaced variables
      messageContent = messageContent.replace(/\{\{[^}]+\}\}/g, '');

      return {
        campaign_id: campaignId,
        contact_id: contact.id,
        phone: contact.phone,
        contact_name: contact.name,
        message_content: messageContent,
        status: 'queued'
      };
    });

    const { error: insertError } = await supabase
      .from('campaign_messages')
      .insert(messageRecords);

    if (insertError) {
      console.error('Message records insert error:', insertError);
      throw new Error('Failed to create message records');
    }

    console.log(`Created ${messageRecords.length} message records`);

    // Call send-campaign-messages function in background with multiple instances
    const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;
    
    // Fire and forget - don't await
    fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        campaignId,
        instances: validInstances,
        sendingMode
      })
    }).catch(err => console.error('Background send error:', err));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Campaign started',
        totalContacts: filteredContacts.length,
        skippedContacts: skippedCount,
        instanceCount: validInstances.length,
        sendingMode
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Start campaign error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
