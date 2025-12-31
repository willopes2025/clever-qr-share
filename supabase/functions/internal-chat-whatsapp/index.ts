import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InternalChatRequest {
  messageId: string;
  content: string;
  senderUserId: string;
  senderName: string;
  conversationId?: string;
  contactId?: string;
  contactName?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('Evolution API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { messageId, content, senderUserId, senderName, conversationId, contactId, contactName }: InternalChatRequest = await req.json();

    console.log('[INTERNAL-CHAT-WHATSAPP] Processing:', { messageId, senderUserId, conversationId, contactId });

    // Get the conversation owner to find organization members
    let ownerUserId: string | null = null;
    
    if (conversationId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('user_id')
        .eq('id', conversationId)
        .maybeSingle();
      
      ownerUserId = conv?.user_id || null;
    }

    if (!ownerUserId && contactId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('user_id')
        .eq('id', contactId)
        .maybeSingle();
      
      ownerUserId = contact?.user_id || null;
    }

    if (!ownerUserId) {
      console.log('[INTERNAL-CHAT-WHATSAPP] No owner found');
      return new Response(
        JSON.stringify({ success: false, message: 'No owner found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all organization members (except sender)
    const { data: orgMembers } = await supabase.rpc('get_organization_member_ids', { _user_id: ownerUserId });
    
    const memberIds = (orgMembers as string[] || []).filter(id => id !== senderUserId);
    
    if (memberIds.length === 0) {
      console.log('[INTERNAL-CHAT-WHATSAPP] No other members to notify');
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[INTERNAL-CHAT-WHATSAPP] Members to notify:', memberIds);

    // Get notification preferences for members who have internal chat enabled
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('user_id, notify_internal_chat')
      .in('user_id', memberIds);

    // Get team members with phone and organization
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('user_id, phone, organization_id')
      .in('user_id', memberIds)
      .eq('status', 'active');

    const sentNotifications: string[] = [];
    const errors: string[] = [];

    for (const userId of memberIds) {
      const pref = preferences?.find(p => p.user_id === userId);
      
      // Check if internal chat notification is enabled (default to true if no preferences)
      if (pref && pref.notify_internal_chat === false) {
        console.log(`[INTERNAL-CHAT-WHATSAPP] Internal chat disabled for user ${userId}`);
        continue;
      }

      // Get team member info (phone and organization)
      const teamMember = teamMembers?.find(tm => tm.user_id === userId);
      
      if (!teamMember) {
        console.log(`[INTERNAL-CHAT-WHATSAPP] No team member found for user ${userId}`);
        continue;
      }

      const phone = teamMember.phone;
      if (!phone) {
        console.log(`[INTERNAL-CHAT-WHATSAPP] No phone for user ${userId}`);
        continue;
      }

      if (!teamMember.organization_id) {
        console.log(`[INTERNAL-CHAT-WHATSAPP] No organization for user ${userId}`);
        continue;
      }

      // Get organization's notification instance
      const { data: organization } = await supabase
        .from('organizations')
        .select('notification_instance_id')
        .eq('id', teamMember.organization_id)
        .maybeSingle();

      if (!organization?.notification_instance_id) {
        console.log(`[INTERNAL-CHAT-WHATSAPP] No notification instance for organization ${teamMember.organization_id}`);
        continue;
      }

      // Get instance name
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_name')
        .eq('id', organization.notification_instance_id)
        .maybeSingle();

      if (!instance) {
        console.log(`[INTERNAL-CHAT-WHATSAPP] Instance ${organization.notification_instance_id} not found`);
        continue;
      }

      // Format phone
      let formattedPhone = phone.replace(/\D/g, '');
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      // Create/update chat session for reply tracking
      await supabase
        .from('internal_chat_sessions')
        .upsert({
          user_id: userId,
          conversation_id: conversationId || null,
          contact_id: contactId || null,
          whatsapp_phone: formattedPhone,
          last_message_preview: content.substring(0, 100),
          last_activity_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,conversation_id',
          ignoreDuplicates: false,
        });

      // Build the message
      const message = `💬 *[Chat Interno - ${contactName || 'Conversa'}]*\nDe: *${senderName}*\n\n${content}\n\n_Responda esta mensagem para enviar ao chat interno._`;

      try {
        const response = await fetch(`${evolutionApiUrl}/message/sendText/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          sentNotifications.push(userId);
          console.log(`[INTERNAL-CHAT-WHATSAPP] Sent to ${formattedPhone}`);

          // Update the internal message with the WhatsApp message ID
          if (result?.key?.id) {
            await supabase
              .from('internal_messages')
              .update({ whatsapp_message_id: result.key.id })
              .eq('id', messageId);
          }
        } else {
          errors.push(`Failed for user ${userId}: ${JSON.stringify(result)}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[INTERNAL-CHAT-WHATSAPP] Error sending to ${userId}:`, error);
        errors.push(`Error for user ${userId}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentNotifications.length,
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[INTERNAL-CHAT-WHATSAPP] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
