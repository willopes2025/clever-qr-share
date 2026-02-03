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

    // Check if user is a system admin (has 'admin' role in user_roles)
    const { data: isAdmin } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    let instances;
    let instancesError;

    if (isAdmin) {
      // System admins have access to ALL instances
      console.log('User is system admin - accessing all instances');
      const result = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, status, warming_level')
        .in('id', instanceIds);
      instances = result.data;
      instancesError = result.error;
    } else {
      // Regular users: check organization member IDs
      const { data: orgMemberIds } = await supabase
        .rpc('get_organization_member_ids', { _user_id: user.id });
      
      const allowedUserIds = orgMemberIds && orgMemberIds.length > 0 
        ? orgMemberIds 
        : [user.id];

      const result = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, status, warming_level')
        .in('id', instanceIds)
        .in('user_id', allowedUserIds);
      instances = result.data;
      instancesError = result.error;
    }

    if (instancesError) {
      console.error('Instances fetch error:', instancesError);
      throw new Error('Failed to fetch WhatsApp instances');
    }

    if (!instances || instances.length !== instanceIds.length) {
      console.error(`Expected ${instanceIds.length} instances, found ${instances?.length || 0}`);
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
    
    // Extract target funnel from list's filter_criteria
    let targetFunnelId: string | null = null;
    let targetStageId: string | null = null;
    
    if (campaign.list?.filter_criteria) {
      const fc = campaign.list.filter_criteria as { funnelId?: string; stageId?: string };
      targetFunnelId = fc.funnelId || null;
      targetStageId = fc.stageId || null;
      if (targetFunnelId) {
        console.log(`Campaign using target funnel from list: ${targetFunnelId}, stage: ${targetStageId || 'first stage'}`);
      }
    }

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
        source?: 'contacts' | 'funnel';
        funnelId?: string;
        stageId?: string;
        status?: string;
        optedOut?: boolean;
        tags?: string[];
        asaasPaymentStatus?: 'overdue' | 'pending' | 'current';
        customFields?: Array<{
          fieldKey: string;
          operator: 'equals' | 'contains' | 'not_empty' | 'empty';
          value?: string;
        }>;
      } || {};

      // NOVA LÓGICA: Se fonte é funil, buscar via funnel_deals
      if (filterCriteria.source === 'funnel' && filterCriteria.funnelId) {
        console.log(`Fetching contacts from funnel: ${filterCriteria.funnelId}, stage: ${filterCriteria.stageId || 'all'}`);
        
        const pageSize = 1000;
        let offset = 0;
        let allFunnelContacts: any[] = [];
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from('funnel_deals')
            .select('contact_id, contacts!inner(id, name, phone, email, custom_fields, opted_out)')
            .eq('funnel_id', filterCriteria.funnelId)
            .order('created_at', { ascending: true })
            .range(offset, offset + pageSize - 1);
          
          // Filtrar por etapa específica se definida
          if (filterCriteria.stageId && filterCriteria.stageId !== 'all') {
            query = query.eq('stage_id', filterCriteria.stageId);
          }
          
          // Aplicar filtro de opted_out
          if (filterCriteria.optedOut === false) {
            query = query.eq('contacts.opted_out', false);
          }

          const { data: batch, error: funnelError } = await query;

          if (funnelError) {
            console.error('Funnel contacts fetch error:', funnelError);
            throw new Error('Failed to fetch funnel contacts');
          }

          if (batch && batch.length > 0) {
            allFunnelContacts = allFunnelContacts.concat(batch);
            offset += pageSize;
            hasMore = batch.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        console.log(`Fetched ${allFunnelContacts.length} deals from funnel (paginated)`);
        
        // Remover duplicatas (mesmo contato pode ter múltiplos deals)
        const uniqueContacts = new Map<string, Contact>();
        for (const fc of allFunnelContacts) {
          const contact = fc.contacts as any;
          if (contact && contact.phone && !uniqueContacts.has(contact.id)) {
            // Aplicar filtro de tags se existir
            let passesTagFilter = true;
            if (filterCriteria.tags && filterCriteria.tags.length > 0) {
              // Será verificado depois em batch
              passesTagFilter = true;
            }
            
            if (passesTagFilter) {
              uniqueContacts.set(contact.id, {
                id: contact.id,
                name: contact.name,
                phone: contact.phone,
                email: contact.email,
                custom_fields: contact.custom_fields
              });
            }
          }
        }

        // Se há filtro de tags, aplicar
        if (filterCriteria.tags && filterCriteria.tags.length > 0) {
          const contactIds = Array.from(uniqueContacts.keys());
          let taggedContactIds: string[] = [];
          let tagOffset = 0;
          let hasMoreTags = true;

          while (hasMoreTags) {
            const { data: tagBatch, error: tagsError } = await supabase
              .from('contact_tags')
              .select('contact_id')
              .in('tag_id', filterCriteria.tags)
              .in('contact_id', contactIds)
              .range(tagOffset, tagOffset + pageSize - 1);

            if (tagsError) {
              console.error('Tags fetch error:', tagsError);
              throw new Error('Failed to fetch contact tags');
            }

            if (tagBatch && tagBatch.length > 0) {
              taggedContactIds.push(...tagBatch.map(tc => tc.contact_id));
              tagOffset += pageSize;
              hasMoreTags = tagBatch.length === pageSize;
            } else {
              hasMoreTags = false;
            }
          }

          const taggedIds = new Set(taggedContactIds);
          for (const [id] of uniqueContacts) {
            if (!taggedIds.has(id)) {
              uniqueContacts.delete(id);
            }
          }
        }

        // Aplicar filtro de campos personalizados se existir
        if (filterCriteria.customFields && filterCriteria.customFields.length > 0) {
          for (const [id, contact] of uniqueContacts) {
            const customFields = contact.custom_fields || {};
            let passesFilter = true;

            for (const cf of filterCriteria.customFields) {
              const fieldValue = customFields[cf.fieldKey] || '';

              switch (cf.operator) {
                case 'equals':
                  if (fieldValue !== cf.value) passesFilter = false;
                  break;
                case 'contains':
                  if (!fieldValue.toLowerCase().includes((cf.value || '').toLowerCase())) passesFilter = false;
                  break;
                case 'not_empty':
                  if (!fieldValue) passesFilter = false;
                  break;
                case 'empty':
                  if (fieldValue) passesFilter = false;
                  break;
              }

              if (!passesFilter) break;
            }

            if (!passesFilter) {
              uniqueContacts.delete(id);
            }
          }
        }

        contacts = Array.from(uniqueContacts.values());
        console.log(`Found ${contacts.length} unique contacts from funnel after filters`);
        
      } else {
        // Lógica existente para listas baseadas em contatos
        const pageSize = 1000;
        let offset = 0;
        let allContacts: any[] = [];
        let hasMore = true;

        console.log(`Fetching contacts with pagination (filters: ${JSON.stringify(filterCriteria)})`);

        while (hasMore) {
          let query = supabase
            .from('contacts')
            .select('id, name, phone, email, custom_fields')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .range(offset, offset + pageSize - 1);

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

          const { data: batch, error: contactsError } = await query;

          if (contactsError) {
            console.error('Contacts fetch error:', contactsError);
            throw new Error('Failed to fetch contacts');
          }

          if (batch && batch.length > 0) {
            allContacts = allContacts.concat(batch);
            offset += pageSize;
            hasMore = batch.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        console.log(`Fetched ${allContacts.length} total contacts from database (paginated)`);

        // If tags filter exists, filter contacts that have those tags
        if (filterCriteria.tags && filterCriteria.tags.length > 0) {
          // PAGINATED TAG FETCH: Buscar todas as tags com paginação
          let taggedContactIds: string[] = [];
          let tagOffset = 0;
          let hasMoreTags = true;

          while (hasMoreTags) {
            const { data: tagBatch, error: tagsError } = await supabase
              .from('contact_tags')
              .select('contact_id')
              .in('tag_id', filterCriteria.tags)
              .range(tagOffset, tagOffset + pageSize - 1);

            if (tagsError) {
              console.error('Tags fetch error:', tagsError);
              throw new Error('Failed to fetch contact tags');
            }

            if (tagBatch && tagBatch.length > 0) {
              taggedContactIds.push(...tagBatch.map(tc => tc.contact_id));
              tagOffset += pageSize;
              hasMoreTags = tagBatch.length === pageSize;
            } else {
              hasMoreTags = false;
            }
          }

          console.log(`Fetched ${taggedContactIds.length} tagged contact IDs (paginated)`);

          const taggedIds = new Set(taggedContactIds);
          contacts = allContacts
            .filter(c => c.phone && taggedIds.has(c.id))
            .map(c => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              email: c.email,
              custom_fields: c.custom_fields as Record<string, string> | null
            }));
        } else {
          contacts = allContacts
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
        failed: 0,
        target_funnel_id: targetFunnelId,
        target_stage_id: targetStageId
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
