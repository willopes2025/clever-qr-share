import { createClient } from "npm:@supabase/supabase-js@2";

const waitUntil = (promise: Promise<unknown>) => {
  const runtime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;

  if (runtime?.waitUntil) {
    runtime.waitUntil(promise);
  } else {
    promise.catch((error) => console.error('Background task error:', error));
  }
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
  status?: string;
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

    const { campaignId, instanceIds = [], sendingMode = 'sequential' } = await req.json();

    if (!campaignId) {
      throw new Error('Campaign ID is required');
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

    if (campaign.status === 'completed') {
      throw new Error(`Campaign is already ${campaign.status}`);
    }

    if (campaign.status === 'sending') {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyInProgress: true,
          message: 'Campanha já está em andamento.',
          totalContacts: campaign.total_contacts,
          sendingMode,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isMetaTemplateCampaign = !!campaign.meta_template_id && !!campaign.meta_phone_number_id;

    // For non-Meta campaigns, instance IDs are required
    if (!isMetaTemplateCampaign && (!instanceIds || instanceIds.length === 0)) {
      throw new Error('Campaign ID and at least one Instance ID are required');
    }

    let instances: Instance[] = [];

    if (instanceIds.length > 0) {
      // Check if user is a system admin (has 'admin' role in user_roles)
      const { data: isAdmin } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });

      let instancesError;

      if (isAdmin) {
        // System admins have access to ALL instances
        console.log('User is system admin - accessing all instances');
        const result = await supabase
          .from('whatsapp_instances')
          .select('id, instance_name, status, warming_level')
          .in('id', instanceIds);
        instances = result.data || [];
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
        instances = result.data || [];
        instancesError = result.error;
      }

      if (instancesError) {
        console.error('Instances fetch error:', instancesError);
        throw new Error('Failed to fetch WhatsApp instances');
      }

      if (instances.length !== instanceIds.length) {
        console.error(`Expected ${instanceIds.length} instances, found ${instances.length}`);
        throw new Error('One or more WhatsApp instances not found');
      }

      const disconnectedInstances = instances.filter((i: Instance & { status?: string }) => i.status !== 'connected');
      if (disconnectedInstances.length > 0) {
        throw new Error(`Instance(s) not connected: ${disconnectedInstances.map(i => i.instance_name).join(', ')}`);
      }

      console.log(`Validated ${instances.length} connected instances`);
    } // end instanceIds.length > 0

    // Create instances array with id, name, and warming_level
    const validInstances: Instance[] = instances.map(i => ({
      id: i.id,
      instance_name: i.instance_name,
      warming_level: i.warming_level || 1
    }));

    console.log(`Using ${validInstances.length} instances${isMetaTemplateCampaign ? ' (Meta template campaign)' : ''}`);

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
        asaasDueDateFrom?: string;
        asaasDueDateTo?: string;
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

         // Batch contact IDs in chunks of 50 to avoid URL length limit
         const contactIdChunks: string[][] = [];
         for (let i = 0; i < contactIds.length; i += 50) {
           contactIdChunks.push(contactIds.slice(i, i + 50));
         }

         for (const chunk of contactIdChunks) {
           tagOffset = 0;
           hasMoreTags = true;
           while (hasMoreTags) {
             const { data: tagBatch, error: tagsError } = await supabase
               .from('contact_tags')
               .select('contact_id')
               .in('tag_id', filterCriteria.tags)
               .in('contact_id', chunk)
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
            // Sync Asaas contacts with date range before filtering
            if (filterCriteria.asaasDueDateFrom || filterCriteria.asaasDueDateTo) {
              console.log(`[start-campaign] Syncing Asaas contacts with date filter: ${filterCriteria.asaasDueDateFrom || '*'} to ${filterCriteria.asaasDueDateTo || '*'}`);
              try {
                const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-asaas-contacts`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                  },
                  body: JSON.stringify({
                    dueDateFrom: filterCriteria.asaasDueDateFrom,
                    dueDateTo: filterCriteria.asaasDueDateTo,
                  }),
                });
                const syncResult = await syncResponse.json();
                console.log(`[start-campaign] Asaas sync result:`, syncResult);
              } catch (syncError) {
                console.error(`[start-campaign] Asaas sync error (continuing):`, syncError);
              }
            }
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
          // Batch contact IDs in chunks of 50 to avoid URL length limit
          const contactIds = allContacts.map(c => c.id);
          const contactIdChunks: string[][] = [];
          for (let i = 0; i < contactIds.length; i += 50) {
            contactIdChunks.push(contactIds.slice(i, i + 50));
          }

          let taggedContactIds: string[] = [];

          for (const chunk of contactIdChunks) {
            let tagOffset = 0;
            let hasMoreTags = true;
            while (hasMoreTags) {
              const { data: tagBatch, error: tagsError } = await supabase
                .from('contact_tags')
                .select('contact_id')
                .in('tag_id', filterCriteria.tags)
                .in('contact_id', chunk)
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
     // IMPORTANT: Exclusion must work across duplicate contact records (e.g., org members / imports)
     // so we exclude by PHONE (campaign_messages.phone) instead of contact_id.
     const normalizePhone = (p: string) => String(p || '').replace(/\D/g, '');
     let filteredContacts = contacts;
     let skippedCount = 0;

    if (campaign.skip_already_sent !== false) {
      const skipMode = campaign.skip_mode || 'same_template';
      const skipDaysPeriod = campaign.skip_days_period || 30;
      const originalCount = contacts.length;

      // NEW: Handle "has_tag" skip mode - exclude contacts that have a specific tag
      if (skipMode === 'has_tag' && campaign.skip_tag_id) {
        console.log(`Filtering by tag exclusion: ${campaign.skip_tag_id}`);
        
        // Fetch ALL contacts with the exclusion tag (paginated)
        // Then filter locally - avoids Supabase .in() limit of ~1000 items
        const pageSize = 1000;
        let taggedContactIds: string[] = [];
        let tagOffset = 0;
        let hasMoreTags = true;

        while (hasMoreTags) {
          const { data: tagBatch, error: tagsError } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .eq('tag_id', campaign.skip_tag_id)
            .range(tagOffset, tagOffset + pageSize - 1);

          if (tagsError) {
            console.error('Tag exclusion fetch error:', tagsError);
            throw new Error('Failed to fetch contacts with exclusion tag');
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
        filteredContacts = contacts.filter(c => !taggedIds.has(c.id));
        skippedCount = originalCount - filteredContacts.length;

        console.log(`Filtered out ${skippedCount} contacts with exclusion tag (checked ${taggedContactIds.length} tagged contacts)`);
      } else {
        // Existing logic for other skip modes
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
        // For 'any_campaign', get all user campaigns first
        if (skipMode === 'any_campaign') {
          const { data: userCampaigns } = await supabase
            .from('campaigns')
            .select('id')
            .eq('user_id', user.id);
          campaignIdsToCheck = userCampaigns?.map(c => c.id) || [];
        }

        // Query already sent phones with pagination to handle >1000 records
        let allAlreadySentPhones: string[] = [];
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          let alreadySentQuery = supabase
            .from('campaign_messages')
            .select('phone')
            .in('status', ['sent', 'delivered'])
            .gte('sent_at', periodStartISO)
            .range(offset, offset + pageSize - 1);

          // Apply campaign filter (now also applies to any_campaign with user's campaigns)
          if (campaignIdsToCheck.length > 0) {
            alreadySentQuery = alreadySentQuery.in('campaign_id', campaignIdsToCheck);
          }

          const { data: batch } = await alreadySentQuery;

          if (batch && batch.length > 0) {
            allAlreadySentPhones.push(
              ...batch
                .map((m: any) => m.phone)
                .filter(Boolean)
                .map((p: string) => normalizePhone(p))
            );
            offset += pageSize;
            hasMore = batch.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        const alreadySentPhones = new Set(allAlreadySentPhones);

        filteredContacts = contacts.filter(c => !alreadySentPhones.has(normalizePhone(c.phone)));
        skippedCount = originalCount - filteredContacts.length;

        console.log(
          `Filtered out ${skippedCount} contacts already sent (mode: ${skipMode}, period: ${skipDaysPeriod} days, checked ${allAlreadySentPhones.length} phone records)`
        );
      }
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
        skipped: skippedCount, // Track duplicate/skipped contacts
        target_funnel_id: targetFunnelId,
        target_stage_id: targetStageId
      })
      .eq('id', campaignId);

    if (updateError) {
      console.error('Campaign update error:', updateError);
      throw new Error('Failed to update campaign status');
    }

    const enqueueSendCampaignMessages = () => {
      const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;

      waitUntil((async () => {
        const response = await fetch(sendUrl, {
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
        });

        const responseText = await response.text();
        if (!response.ok) {
          console.error('Background send error:', response.status, responseText);
        }
      })().catch(err => console.error('Background send error:', err)));
    };

    const processDynamicAiCampaign = async () => {
      try {
        console.log('Dynamic AI mode detected, generating unique messages per contact');
        const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
        if (!lovableApiKey) {
          throw new Error('LOVABLE_API_KEY not configured');
        }

        const aiPrompt = campaign.template?.ai_prompt;
        if (!aiPrompt) {
          throw new Error('AI prompt not configured');
        }

        const { data: customFieldDefinitions, error: customFieldDefinitionsError } = await supabase
          .from('custom_field_definitions')
          .select('field_key, field_name, entity_type')
          .eq('user_id', user.id)
          .order('display_order', { ascending: true });

        if (customFieldDefinitionsError) {
          console.error('Custom field definitions fetch error:', customFieldDefinitionsError);
          throw new Error('Failed to fetch custom field definitions');
        }

        const contactFieldDefinitions = (customFieldDefinitions || []).filter((field) => field.entity_type === 'contact');
        const leadFieldDefinitions = (customFieldDefinitions || []).filter((field) => field.entity_type === 'lead');

        const formatFieldValue = (value: unknown): string => {
          if (value === null || value === undefined || value === '') return '';
          if (Array.isArray(value)) return value.join(', ');
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value);
        };

        const formatFieldContext = (
          fieldValues: Record<string, unknown> | null | undefined,
          definitions: Array<{ field_key: string; field_name: string }>,
          sectionTitle: string
        ): string => {
          if (!fieldValues) return '';

          const definitionMap = new Map(definitions.map((field) => [field.field_key, field.field_name]));
          const lines = Object.entries(fieldValues)
            .filter(([, value]) => formatFieldValue(value) !== '')
            .map(([key, value]) => {
              const label = definitionMap.get(key) || key;
              return `- ${label} ({{${key}}}): ${formatFieldValue(value)}`;
            });

          if (lines.length === 0) return '';
          return `${sectionTitle}:\n${lines.join('\n')}\n`;
        };

        const availableVariables = [
          '- Nome do contato ({{nome}})',
          '- Telefone do contato ({{telefone}})',
          '- Email do contato ({{email}})',
          ...contactFieldDefinitions.map((field) => `- ${field.field_name} ({{${field.field_key}}}) [contato]`),
          ...leadFieldDefinitions.map((field) => `- ${field.field_name} ({{${field.field_key}}}) [lead]`),
          ...(campaign.template?.include_asaas_data ? [
            '- Dados financeiros do Asaas (faturas pendentes/vencidas, valores, links de pagamento)'
          ] : []),
        ].join('\n');

        const BATCH_SIZE = 5;
        const dynamicMessageRecords: Array<{
          campaign_id: string;
          contact_id: string;
          phone: string;
          contact_name: string | null;
          message_content: string;
          status: 'queued';
        }> = [];

        for (let i = 0; i < filteredContacts.length; i += BATCH_SIZE) {
          const batch = filteredContacts.slice(i, i + BATCH_SIZE);
          const contactIds = batch.map((c: Contact) => c.id);

          let dealsQuery = supabase
            .from('funnel_deals')
            .select('contact_id, value, custom_fields, created_at, stage_id, stage:funnel_stages(name)')
            .in('contact_id', contactIds)
            .order('created_at', { ascending: false });

          if (targetFunnelId) {
            dealsQuery = dealsQuery.eq('funnel_id', targetFunnelId);
          }

          const { data: deals } = await dealsQuery;

          const { data: conversations } = await supabase
            .from('conversations')
            .select('contact_id, id')
            .in('contact_id', contactIds)
            .eq('user_id', user.id);

          const convMap: Record<string, any[]> = {};
          if (conversations && conversations.length > 0) {
            const convIds = conversations.map(c => c.id);
            const { data: messages } = await supabase
              .from('messages')
              .select('conversation_id, content, direction, created_at')
              .in('conversation_id', convIds)
              .order('created_at', { ascending: false })
              .limit(20 * convIds.length);

            if (messages) {
              for (const msg of messages) {
                if (!convMap[msg.conversation_id]) convMap[msg.conversation_id] = [];
                if (convMap[msg.conversation_id].length < 20) {
                  convMap[msg.conversation_id].push(msg);
                }
              }
            }
          }

          // Fetch Asaas financial data if enabled
          let asaasDataMap: Record<string, Array<{ status: string; value: number; dueDate: string; invoiceUrl: string; billingType: string }>> = {};
          if (campaign.template?.include_asaas_data) {
            const asaasApiKey = Deno.env.get('SSOTICA_API_TOKEN') || Deno.env.get('ASAAS_API_KEY');
            if (asaasApiKey) {
              const contactsWithAsaas = batch.filter((c: Contact & { asaas_customer_id?: string }) => c.asaas_customer_id);
              console.log(`[Asaas] Fetching financial data for ${contactsWithAsaas.length} contacts with Asaas ID`);
              
              // Also fetch asaas_customer_id from DB for contacts missing it in the select
              const { data: contactAsaasIds } = await supabase
                .from('contacts')
                .select('id, asaas_customer_id')
                .in('id', contactIds)
                .not('asaas_customer_id', 'is', null);
              
              const asaasMap = new Map((contactAsaasIds || []).map(c => [c.id, c.asaas_customer_id]));
              
              for (const [contactId, customerId] of asaasMap.entries()) {
                if (!customerId) continue;
                try {
                  const asaasResponse = await fetch(
                    `https://api.asaas.com/v3/payments?customer=${customerId}&status=PENDING&status=OVERDUE&limit=5`,
                    { headers: { 'access_token': asaasApiKey } }
                  );
                  if (asaasResponse.ok) {
                    const asaasResult = await asaasResponse.json();
                    if (asaasResult.data && asaasResult.data.length > 0) {
                      asaasDataMap[contactId] = asaasResult.data.map((p: any) => ({
                        status: p.status,
                        value: p.value,
                        dueDate: p.dueDate,
                        invoiceUrl: p.invoiceUrl || p.bankSlipUrl || '',
                        billingType: p.billingType || 'N/A'
                      }));
                    }
                  }
                } catch (asaasErr) {
                  console.error(`[Asaas] Error fetching for customer ${customerId}:`, asaasErr);
                }
              }
              console.log(`[Asaas] Got financial data for ${Object.keys(asaasDataMap).length} contacts`);
            } else {
              console.warn('[Asaas] No Asaas API key found, skipping financial data');
            }
          }

          const contactContexts = batch.map((contact: Contact, index: number) => {
            const deal = deals?.find(d => d.contact_id === contact.id);
            const conv = conversations?.find(c => c.contact_id === contact.id);
            const msgs = conv ? (convMap[conv.id] || []).reverse() : [];

            let context = `Contato: ${contact.name || 'Sem nome'}\nTelefone: ${contact.phone}\n`;
            if (contact.email) context += `Email: ${contact.email}\n`;
            context += formatFieldContext(contact.custom_fields, contactFieldDefinitions, 'Campos personalizados do contato');
            if (deal) {
              context += `Etapa do funil: ${(deal.stage as any)?.name || 'N/A'}\n`;
              if (deal.value) context += `Valor: R$ ${deal.value}\n`;
              context += formatFieldContext(deal.custom_fields, leadFieldDefinitions, 'Campos personalizados do lead');
            }
            
            // Add Asaas financial data
            const asaasPayments = asaasDataMap[contact.id];
            if (asaasPayments && asaasPayments.length > 0) {
              const statusLabels: Record<string, string> = { PENDING: 'Pendente', OVERDUE: 'Vencida', CONFIRMED: 'Confirmada' };
              context += `\nDados financeiros (Asaas):\n`;
              asaasPayments.forEach((p, idx) => {
                const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value);
                const formattedDate = p.dueDate ? p.dueDate.split('-').reverse().join('/') : 'N/A';
                context += `- Fatura ${idx + 1}: ${formattedValue} | Vencimento: ${formattedDate} | Status: ${statusLabels[p.status] || p.status} | Tipo: ${p.billingType}\n`;
                if (p.invoiceUrl) context += `  Link: ${p.invoiceUrl}\n`;
              });
            }
            
            if (msgs.length > 0) {
              context += `\nÚltimas mensagens:\n`;
              msgs.forEach((m: any) => {
                const dir = m.direction === 'outgoing' ? 'Você' : contact.name || 'Contato';
                context += `${dir}: ${m.content || '[mídia]'}\n`;
              });
            }
            return { contact, context, index };
          });

          const systemPrompt = `Você é um assistente que gera mensagens de WhatsApp personalizadas.
Para cada contato, gere UMA mensagem única e personalizada seguindo as instruções do usuário.
A mensagem deve ser natural, direta e pronta para envio.
Use SOMENTE os dados realmente presentes no contexto do contato.
Quando o usuário mencionar nomes amigáveis como "nome do contato", "valor da venda" ou "data de vencimento do boleto", relacione isso aos dados disponíveis no contexto, inclusive quando aparecerem com a chave técnica entre chaves.
Se um dado não existir no contexto do contato, não invente e não mencione esse dado.

REGRA CRÍTICA SOBRE NOMES:
- O nome do destinatário da mensagem é SEMPRE o que aparece na linha "Contato:" do contexto.
- Os dados financeiros (Asaas) podem pertencer a outro titular (ex: cônjuge, responsável financeiro). NUNCA use nomes vindos dos dados financeiros para se referir ao destinatário.
- Se precisar mencionar o nome na mensagem, use EXCLUSIVAMENTE o valor do campo "Contato:".
- O contact_id informado deve ser retornado EXATAMENTE igual para cada mensagem gerada.

Variáveis disponíveis neste workspace:
${availableVariables}`;
          const userMessage = `Instrução do template:\n${aiPrompt}\n\nGere uma mensagem personalizada para cada contato abaixo, usando os dados disponíveis. IMPORTANTE: O contact_id deve ser retornado exatamente como informado.\n\n${contactContexts.map((cc) => `--- Contato ${cc.index + 1} (ID: ${cc.contact.id}) ---\n${cc.context}`).join('\n\n')}`;

          try {
            console.log(`[AI] Sending batch to Lovable AI with ${contactContexts.length} contacts`);
            console.log(`[AI] User prompt: ${aiPrompt.substring(0, 200)}`);
            console.log(`[AI] Sample context: ${contactContexts[0]?.context.substring(0, 300)}`);

            const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-3-flash-preview',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userMessage }
                ],
                temperature: 0.8,
                tools: [{
                  type: 'function',
                  function: {
                    name: 'generate_campaign_messages',
                    description: 'Retorna uma mensagem personalizada para cada contato do lote',
                    parameters: {
                      type: 'object',
                      properties: {
                        results: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              contact_id: {
                                type: 'string',
                                description: 'ID exato do contato informado no contexto'
                              },
                              contact_index: {
                                type: 'number',
                                description: 'Índice do contato mostrado no contexto (baseado em 1 na exibição, mas pode retornar 0-based ou 1-based)'
                              },
                              message: {
                                type: 'string',
                                description: 'Mensagem final pronta para envio'
                              }
                            },
                            required: ['contact_id', 'message'],
                            additionalProperties: false
                          }
                        }
                      },
                      required: ['results'],
                      additionalProperties: false
                    }
                  }
                }],
                tool_choice: {
                  type: 'function',
                  function: { name: 'generate_campaign_messages' }
                }
              })
            });

            if (!aiResponse.ok) {
              const errText = await aiResponse.text();
              console.error(`[AI] Lovable AI error ${aiResponse.status}: ${errText}`);
              throw new Error(`Lovable AI error: ${aiResponse.status}`);
            }

            const aiData = await aiResponse.json();
            const toolArguments = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
            const aiContent = aiData.choices?.[0]?.message?.content;
            console.log(`[AI] Tool arguments received: ${toolArguments ? toolArguments.length : 0} chars`);
            if (!toolArguments && aiContent) {
              console.log(`[AI] Fallback content preview: ${aiContent.substring(0, 500)}`);
            }

            const rawPayload = toolArguments || aiContent;

            if (rawPayload) {
              const parsed = JSON.parse(rawPayload);
              let generatedMessages: Array<{ contact_id?: string; contact_index?: number; message: string }> = [];

              if (Array.isArray(parsed)) {
                generatedMessages = parsed;
              } else if (Array.isArray(parsed.results)) {
                generatedMessages = parsed.results;
              } else if (Array.isArray(parsed.messages)) {
                generatedMessages = parsed.messages;
              } else {
                for (const key of Object.keys(parsed)) {
                  if (Array.isArray(parsed[key])) {
                    generatedMessages = parsed[key];
                    console.log(`[AI] Found messages array under key: "${key}" with ${generatedMessages.length} items`);
                    break;
                  }
                }
              }

              console.log(`[AI] Parsed ${generatedMessages.length} messages from response`);

              // First pass: match by contact_id (most reliable)
              const usedIndices = new Set<number>();
              for (const cc of contactContexts) {
                let generated = generatedMessages.find((g) => {
                  return typeof g.contact_id === 'string' && g.contact_id === cc.contact.id;
                });

                // Fallback: match by index
                if (!generated) {
                  generated = generatedMessages.find((g, idx) => {
                    if (usedIndices.has(idx)) return false;
                    const matchesZeroBasedIndex = typeof g.contact_index === 'number' && g.contact_index === cc.index;
                    const matchesOneBasedIndex = typeof g.contact_index === 'number' && g.contact_index === cc.index + 1;
                    return matchesZeroBasedIndex || matchesOneBasedIndex;
                  });
                }

                // Last fallback: use positional order
                if (!generated && cc.index < generatedMessages.length && !usedIndices.has(cc.index)) {
                  generated = generatedMessages[cc.index];
                  console.warn(`[AI] Using positional fallback for contact ${cc.contact.id} (${cc.contact.name})`);
                }

                if (generated) {
                  const genIdx = generatedMessages.indexOf(generated);
                  if (genIdx >= 0) usedIndices.add(genIdx);
                }

                if (!generated?.message) {
                  console.warn(`[AI] No message generated for contact ${cc.contact.id} (${cc.contact.name})`);
                }

                // Validate: ensure the message uses the correct contact name
                let finalMessage = generated?.message?.trim() || `Olá ${cc.contact.name || ''}! Entramos em contato sobre seu cadastro.`;
                
                // Cross-contamination check: detect if another contact's name leaked into this message
                if (finalMessage && cc.contact.name) {
                  const otherContacts = contactContexts.filter(other => other.contact.id !== cc.contact.id && other.contact.name);
                  for (const other of otherContacts) {
                    const otherName = other.contact.name!;
                    const otherFirstName = otherName.split(' ')[0];
                    // If another contact's name appears in this message AND the correct name doesn't
                    if (otherFirstName.length > 2 && finalMessage.includes(otherFirstName) && !finalMessage.includes(cc.contact.name.split(' ')[0])) {
                      console.warn(`[AI] Name contamination detected: message for ${cc.contact.name} contains "${otherFirstName}". Replacing.`);
                      // Replace wrong name with correct name
                      finalMessage = finalMessage.replace(new RegExp(escapeRegex(otherName), 'gi'), cc.contact.name);
                      finalMessage = finalMessage.replace(new RegExp(escapeRegex(otherFirstName), 'gi'), cc.contact.name.split(' ')[0]);
                      break;
                    }
                  }
                }
                
                dynamicMessageRecords.push({
                  campaign_id: campaignId,
                  contact_id: cc.contact.id,
                  phone: normalizePhone(cc.contact.phone),
                  contact_name: cc.contact.name,
                  message_content: finalMessage,
                  status: 'queued'
                });
              }
            } else {
              console.error('[AI] No structured output in AI response:', JSON.stringify(aiData));
              for (const cc of contactContexts) {
                dynamicMessageRecords.push({
                  campaign_id: campaignId,
                  contact_id: cc.contact.id,
                  phone: normalizePhone(cc.contact.phone),
                  contact_name: cc.contact.name,
                  message_content: `Olá ${cc.contact.name || ''}! Entramos em contato sobre seu cadastro.`,
                  status: 'queued'
                });
              }
            }
          } catch (aiError) {
            console.error('[AI] Generation error for batch:', aiError);
            for (const cc of contactContexts) {
              dynamicMessageRecords.push({
                campaign_id: campaignId,
                contact_id: cc.contact.id,
                phone: normalizePhone(cc.contact.phone),
                contact_name: cc.contact.name,
                message_content: `Olá ${cc.contact.name || ''}! Entramos em contato sobre seu cadastro.`,
                status: 'queued'
              });
            }
          }

          console.log(`AI generated messages for batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(filteredContacts.length / BATCH_SIZE)}`);
        }

        const { error: insertError } = await supabase
          .from('campaign_messages')
          .insert(dynamicMessageRecords);

        if (insertError) {
          console.error('Message records insert error:', insertError);
          throw new Error('Failed to create message records');
        }

        console.log(`Created ${dynamicMessageRecords.length} message records`);
        enqueueSendCampaignMessages();
      } catch (backgroundError) {
        console.error('Dynamic AI campaign setup error:', backgroundError);
        await supabase
          .from('campaigns')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', campaignId);
      }
    };

    if (campaign.template?.ai_prompt && !isMetaTemplateCampaign) {
      waitUntil(processDynamicAiCampaign());

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Campanha iniciada! A IA está preparando as mensagens em segundo plano.',
          totalContacts: filteredContacts.length,
          skippedContacts: skippedCount,
          instanceCount: validInstances.length,
          sendingMode,
          backgroundProcessing: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build message records
    let messageRecords;

    if (isMetaTemplateCampaign) {
      const { data: metaTemplate } = await supabase
        .from('meta_templates')
        .select('body_text, name')
        .eq('id', campaign.meta_template_id)
        .single();

      const templateBody = metaTemplate?.body_text || `[Meta Template: ${metaTemplate?.name || campaign.meta_template_id}]`;
      const mappings = campaign.meta_variable_mappings as any[] | null;

      // Pre-fetch deal data if any mapping uses lead_custom_field, deal_value, or deal_name
      const needsDealData = mappings?.some((m: any) => m.source === 'lead_custom_field' || m.source === 'deal_value' || m.source === 'deal_name');
      let dealDataMap: Record<string, { custom_fields: Record<string, unknown>; value: number | null; name: string | null }> = {};
      
      if (needsDealData) {
        const contactIds = filteredContacts.map((c: Contact) => c.id);
        // Fetch most recent deal for each contact
        const { data: deals } = await supabase
          .from('funnel_deals')
          .select('contact_id, custom_fields, value, name')
          .in('contact_id', contactIds)
          .order('created_at', { ascending: false });
        
        if (deals) {
          for (const deal of deals) {
            if (deal.contact_id && !dealDataMap[deal.contact_id]) {
              dealDataMap[deal.contact_id] = {
                custom_fields: (deal.custom_fields as Record<string, unknown>) || {},
                value: deal.value,
                name: deal.name,
              };
            }
          }
        }
      }

      messageRecords = filteredContacts.map((contact: Contact) => {
        let messageContent = templateBody;

        if (mappings && mappings.length > 0) {
          // Use meta_variable_mappings to resolve each {{N}} variable
          for (const mapping of mappings) {
            const varIndex = mapping.variable_index;
            const regex = new RegExp(`\\{\\{${varIndex}\\}\\}`, 'g');
            let value = '';
            
            switch (mapping.source) {
              case 'contact_name':
                value = contact.name || '';
                break;
              case 'contact_phone':
                value = contact.phone || '';
                break;
              case 'contact_email':
                value = contact.email || '';
                break;
              case 'contact_custom_field':
                value = String(contact.custom_fields?.[mapping.field_key] || '');
                break;
              case 'lead_custom_field':
                value = String(dealDataMap[contact.id]?.custom_fields?.[mapping.field_key] || '');
                break;
              case 'deal_value':
                const dealVal = dealDataMap[contact.id]?.value;
                value = dealVal != null ? String(dealVal) : '';
                break;
              case 'deal_name':
                value = dealDataMap[contact.id]?.name || '';
                break;
              case 'fixed_text':
                value = mapping.fixed_value || '';
                break;
              default:
                value = '';
            }
            messageContent = messageContent.replace(regex, value);
          }
        } else {
          // Fallback: only {{1}} = name, others cleared
          messageContent = messageContent.replace(/\{\{1\}\}/g, contact.name || '');
        }

        // Clean any remaining unresolved variables
        messageContent = messageContent.replace(/\{\{[^}]+\}\}/g, '');

        return {
          campaign_id: campaignId,
          contact_id: contact.id,
          phone: normalizePhone(contact.phone),
          contact_name: contact.name,
          message_content: messageContent,
          status: 'queued'
        };
      });
    } else {
      const { data: variations } = await supabase
        .from('template_variations')
        .select('content')
        .eq('template_id', campaign.template_id);

      const messageOptions: string[] = [campaign.template.content];
      if (variations && variations.length > 0) {
        messageOptions.push(...variations.map(v => v.content));
      }

      console.log(`Using ${messageOptions.length} message variations (1 original + ${variations?.length || 0} variations)`);

      messageRecords = filteredContacts.map((contact: Contact) => {
        const randomIndex = Math.floor(Math.random() * messageOptions.length);
        let messageContent = messageOptions[randomIndex];

        messageContent = messageContent.replace(/\{\{nome\}\}/gi, contact.name || '');
        messageContent = messageContent.replace(/\{\{name\}\}/gi, contact.name || '');
        messageContent = messageContent.replace(/\{\{phone\}\}/gi, contact.phone || '');
        messageContent = messageContent.replace(/\{\{telefone\}\}/gi, contact.phone || '');
        messageContent = messageContent.replace(/\{\{email\}\}/gi, contact.email || '');

        const customFields = contact.custom_fields || {};
        for (const [key, value] of Object.entries(customFields)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
          messageContent = messageContent.replace(regex, value || '');
        }
        messageContent = messageContent.replace(/\{\{[^}]+\}\}/g, '');

        return {
          campaign_id: campaignId,
          contact_id: contact.id,
          phone: normalizePhone(contact.phone),
          contact_name: contact.name,
          message_content: messageContent,
          status: 'queued'
        };
      });
    }

    const { error: insertError } = await supabase
      .from('campaign_messages')
      .insert(messageRecords);

    if (insertError) {
      console.error('Message records insert error:', insertError);
      throw new Error('Failed to create message records');
    }

    console.log(`Created ${messageRecords.length} message records`);
    enqueueSendCampaignMessages();

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
