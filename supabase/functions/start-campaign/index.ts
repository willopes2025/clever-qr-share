import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
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

    // Fetch contacts from the broadcast list
    const { data: listContacts, error: contactsError } = await supabase
      .from('broadcast_list_contacts')
      .select(`
        contact:contacts(id, name, phone, email, custom_fields)
      `)
      .eq('list_id', campaign.list_id);

    if (contactsError) {
      console.error('Contacts fetch error:', contactsError);
      throw new Error('Failed to fetch contacts');
    }

    // Extract contacts and filter those with valid phone numbers
    const contacts: Contact[] = [];
    for (const lc of listContacts || []) {
      const contact = lc.contact as unknown as Contact;
      if (contact && contact.phone) {
        contacts.push(contact);
      }
    }

    if (contacts.length === 0) {
      throw new Error('No contacts found in the broadcast list');
    }

    console.log(`Found ${contacts.length} contacts to send messages to`);

    // Update campaign status to sending with multiple instance IDs
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'sending',
        started_at: new Date().toISOString(),
        instance_id: instanceIds[0], // Keep first instance for backwards compatibility
        instance_ids: instanceIds,
        sending_mode: sendingMode,
        total_contacts: contacts.length,
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
    const messageRecords = contacts.map((contact: Contact, index: number) => {
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
        totalContacts: contacts.length,
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
