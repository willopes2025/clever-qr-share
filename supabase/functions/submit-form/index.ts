import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const formId = body.form_id;

    if (!formId) {
      return new Response(
        JSON.stringify({ error: 'form_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch form
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      console.error('Form not found:', formError);
      return new Response(
        JSON.stringify({ error: 'Formulário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch form fields for mapping
    const { data: fields, error: fieldsError } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', formId);

    if (fieldsError) {
      console.error('Error fetching fields:', fieldsError);
    }

    const formFields = fields || [];

    // Extract submission data (remove form_id and static params from visible data)
    const { form_id, ...rawSubmissionData } = body;
    
    // Separate static params from regular submission data
    const staticParams: Record<string, string> = {};
    const submissionData: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(rawSubmissionData)) {
      if (key.startsWith('_static_')) {
        staticParams[key.replace('_static_', '')] = String(value);
      } else {
        submissionData[key] = value;
      }
    }

    // Process field mappings to find contact info and lead custom fields
    let contactData: { name?: string; email?: string; phone?: string; custom_fields?: Record<string, any> } = {
      custom_fields: {}
    };
    
    // Separate storage for lead/deal custom fields
    let dealCustomFields: Record<string, any> = {};

  for (const field of formFields) {
    const fieldValue = submissionData[field.id];
    
    // Check for composite field parts (name has _first/_last, phone has _country_code)
    const hasNameParts = submissionData[`${field.id}_first`] !== undefined;
    const hasPhoneParts = submissionData[`${field.id}_country_code`] !== undefined;
    
    // Skip only if no direct value AND no composite parts
    if (!fieldValue && !hasNameParts && !hasPhoneParts) continue;

    if (field.mapping_type === 'contact_field') {
      if (field.mapping_target === 'name') {
        // Handle name field (first + last) - check composite fields first
        if (submissionData[`${field.id}_first`]) {
          contactData.name = `${submissionData[`${field.id}_first`]} ${submissionData[`${field.id}_last`] || ''}`.trim();
        } else if (fieldValue) {
          contactData.name = String(fieldValue);
        }
      } else if (field.mapping_target === 'email') {
        if (fieldValue) {
          contactData.email = String(fieldValue);
        }
      } else if (field.mapping_target === 'phone') {
        // Get phone number and country code
        const phoneValue = fieldValue || '';
        const phoneDigits = String(phoneValue).replace(/\D/g, '');
        const countryCode = submissionData[`${field.id}_country_code`] || '55';
        // Combine country code with phone number
        if (phoneDigits) {
          contactData.phone = `${countryCode}${phoneDigits}`;
        }
      }
    } else if (field.mapping_type === 'custom_field' && field.mapping_target && fieldValue) {
      // Contact custom field
      contactData.custom_fields![field.mapping_target] = fieldValue;
    } else if (field.mapping_type === 'lead_field' && field.mapping_target && fieldValue) {
      // Lead/Deal custom field - will be saved to funnel_deals.custom_fields
      dealCustomFields[field.mapping_target] = fieldValue;
    } else if (field.mapping_type === 'new_custom_field' && field.mapping_target && field.create_custom_field_on_submit && fieldValue) {
      // Create new CONTACT custom field definition if it doesn't exist
      const fieldKey = field.mapping_target.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      const { data: existingField } = await supabase
        .from('custom_field_definitions')
        .select('id')
        .eq('user_id', form.user_id)
        .eq('field_key', fieldKey)
        .eq('entity_type', 'contact')
        .single();

      if (!existingField) {
        await supabase
          .from('custom_field_definitions')
          .insert({
            user_id: form.user_id,
            field_name: field.mapping_target,
            field_key: fieldKey,
            field_type: 'text',
            is_required: false,
            display_order: 999,
            entity_type: 'contact',
          });
      }

      contactData.custom_fields![fieldKey] = fieldValue;
    } else if (field.mapping_type === 'new_lead_field' && field.mapping_target && field.create_custom_field_on_submit && fieldValue) {
      // Create new LEAD custom field definition if it doesn't exist
      const fieldKey = field.mapping_target.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      const { data: existingField } = await supabase
        .from('custom_field_definitions')
        .select('id')
        .eq('user_id', form.user_id)
        .eq('field_key', fieldKey)
        .eq('entity_type', 'lead')
        .single();

      if (!existingField) {
        await supabase
          .from('custom_field_definitions')
          .insert({
            user_id: form.user_id,
            field_name: field.mapping_target,
            field_key: fieldKey,
            field_type: 'text',
            is_required: false,
            display_order: 999,
            entity_type: 'lead',
          });
      }

      // Save to deal custom fields
      dealCustomFields[fieldKey] = fieldValue;
    }
  }

    let contactId: string | null = null;

    // Check if a static contact_id was provided (trackable form link from inbox)
    const staticContactId = staticParams.contact_id;
    if (staticContactId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staticContactId)) {
      // Verify the contact exists and belongs to this form's user
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id, custom_fields')
        .eq('id', staticContactId)
        .eq('user_id', form.user_id)
        .single();

      if (existingContact) {
        contactId = existingContact.id;
        console.log(`Using static contact_id: ${contactId}`);

        // Update contact data if provided
        const updateData: Record<string, any> = {};
        if (contactData.name) updateData.name = contactData.name;
        if (contactData.email) updateData.email = contactData.email;
        if (contactData.phone) updateData.phone = contactData.phone;
        
        // Merge custom fields
        if (contactData.custom_fields && Object.keys(contactData.custom_fields).length > 0) {
          updateData.custom_fields = {
            ...(existingContact.custom_fields || {}),
            ...contactData.custom_fields,
          };
        }

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('contacts')
            .update(updateData)
            .eq('id', contactId);
        }
      }
    }

    // Find or create contact if we don't have one yet
    if (!contactId && (contactData.phone || contactData.email)) {
      // Try to find existing contact
      let query = supabase
        .from('contacts')
        .select('id, custom_fields')
        .eq('user_id', form.user_id);

      if (contactData.phone) {
        query = query.eq('phone', contactData.phone);
      } else if (contactData.email) {
        query = query.eq('email', contactData.email);
      }

      const { data: existingContact } = await query.single();

      if (existingContact) {
        contactId = existingContact.id;

        // Merge custom fields
        const mergedCustomFields = {
          ...(existingContact.custom_fields || {}),
          ...contactData.custom_fields,
        };

        // Update contact
        await supabase
          .from('contacts')
          .update({
            name: contactData.name || undefined,
            email: contactData.email || undefined,
            custom_fields: Object.keys(mergedCustomFields).length > 0 ? mergedCustomFields : undefined,
          })
          .eq('id', contactId);
      } else if (contactData.phone) {
        // Create new contact
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            user_id: form.user_id,
            phone: contactData.phone,
            name: contactData.name || null,
            email: contactData.email || null,
            custom_fields: Object.keys(contactData.custom_fields || {}).length > 0 ? contactData.custom_fields : null,
          })
          .select('id')
          .single();

        if (contactError) {
          console.error('Error creating contact:', contactError);
        } else {
          contactId = newContact.id;
        }
      }
    }

    // Get metadata from request, including static params
    const metadata = {
      ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
      referrer: req.headers.get('referer') || null,
      submitted_at: new Date().toISOString(),
      static_params: Object.keys(staticParams).length > 0 ? staticParams : undefined,
    };

    // Save submission
    const { data: submission, error: submissionError } = await supabase
      .from('form_submissions')
      .insert({
        form_id: formId,
        user_id: form.user_id,
        contact_id: contactId,
        data: submissionData,
        metadata,
      })
      .select('id')
      .single();

    if (submissionError) {
      console.error('Error saving submission:', submissionError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar resposta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Trigger webhooks (if any configured)
    const { data: webhooks } = await supabase
      .from('form_webhooks')
      .select('*')
      .eq('form_id', formId)
      .eq('is_active', true);

    if (webhooks && webhooks.length > 0) {
      for (const webhook of webhooks) {
        if (webhook.events.includes('submission')) {
          try {
            await fetch(webhook.target_url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(webhook.headers || {}),
              },
              body: JSON.stringify({
                event: 'submission',
                form_id: formId,
                form_name: form.name,
                submission_id: submission.id,
                contact_id: contactId,
                data: submissionData,
                metadata,
              }),
            });
          } catch (webhookError) {
            console.error('Webhook error:', webhookError);
          }
        }
      }
    }

    // Trigger funnel automations with on_form_submission trigger
    if (contactId) {
      try {
        // Find automations with on_form_submission trigger
        const { data: automations } = await supabase
          .from('funnel_automations')
          .select('*')
          .eq('user_id', form.user_id)
          .eq('trigger_type', 'on_form_submission')
          .eq('is_active', true);

        if (automations && automations.length > 0) {
          for (const automation of automations) {
            const triggerConfig = automation.trigger_config as Record<string, any> || {};
            
            // Check if this automation is for this specific form or any form
            if (triggerConfig.form_id && triggerConfig.form_id !== formId) {
              continue; // Skip if it's for a different form
            }

            // Trigger the automation via process-funnel-automations edge function
            try {
              await supabase.functions.invoke('process-funnel-automations', {
                body: {
                  automationId: automation.id,
                  contactId: contactId,
                  formSubmissionId: submission.id,
                  formId: formId,
                  triggerType: 'on_form_submission',
                },
              });
              console.log(`Triggered automation ${automation.id} for form submission`);
            } catch (automationError) {
              console.error('Automation trigger error:', automationError);
            }
          }
        }
      } catch (automationError) {
      console.error('Error processing form automations:', automationError);
    }
  }

  // Create deal in funnel if target_funnel_id is configured
  if (contactId && form.target_funnel_id) {
    try {
      let stageId = form.target_stage_id;
      
      // If no stage defined, get first stage of funnel
      if (!stageId) {
        const { data: firstStage } = await supabase
          .from('funnel_stages')
          .select('id')
          .eq('funnel_id', form.target_funnel_id)
          .order('display_order')
          .limit(1)
          .maybeSingle();
        
        stageId = firstStage?.id;
      }
      
      if (stageId) {
        // Check if there's already an open deal for this contact in this funnel
        const { data: existingDeal } = await supabase
          .from('funnel_deals')
          .select('id')
          .eq('contact_id', contactId)
          .eq('funnel_id', form.target_funnel_id)
          .is('closed_at', null)
          .maybeSingle();
        
        if (!existingDeal) {
          // Create new deal with lead custom fields
          const dealInsertData: Record<string, any> = {
            funnel_id: form.target_funnel_id,
            stage_id: stageId,
            contact_id: contactId,
            user_id: form.user_id,
            title: contactData.name || 'Lead do Formulário',
            source: `Formulário: ${form.name}`,
          };
          
          // Include lead custom fields if any were collected
          if (Object.keys(dealCustomFields).length > 0) {
            dealInsertData.custom_fields = dealCustomFields;
            console.log('Adding lead custom fields to deal:', dealCustomFields);
          }
          
          const { data: newDeal, error: dealError } = await supabase
            .from('funnel_deals')
            .insert(dealInsertData)
            .select('id')
            .single();
          
          if (dealError) {
            console.error('Error creating deal:', dealError);
          } else {
            console.log(`Deal created: ${newDeal.id} for contact ${contactId} in funnel ${form.target_funnel_id}`);
          }
        } else {
          console.log(`Existing open deal found for contact ${contactId} in funnel ${form.target_funnel_id}`);
        }
      }
    } catch (dealError) {
      console.error('Error processing funnel deal creation:', dealError);
    }
  }

  console.log(`Form submission saved: ${submission.id} for form ${formId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        submission_id: submission.id,
        contact_id: contactId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in submit-form:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
