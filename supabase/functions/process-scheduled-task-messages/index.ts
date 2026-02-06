import { createClient } from "npm:@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar mensagens pendentes que devem ser enviadas
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("scheduled_task_messages")
      .select(`
        *,
        task:conversation_tasks(*),
        conversation:conversations(*, instance:whatsapp_instances(*)),
        contact:contacts(*)
      `)
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .limit(50);

    if (fetchError) {
      console.error("Error fetching pending messages:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingMessages?.length || 0} pending messages to process`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(JSON.stringify({ success: true, ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const message of pendingMessages) {
      results.processed++;

      try {
        const conversation = message.conversation;
        const contact = message.contact;

        if (!conversation) {
          throw new Error("Conversation not found");
        }

        if (!contact) {
          throw new Error("Contact not found");
        }

        // Determinar a instância para envio
        let instanceId = conversation.instance_id;
        let instance = conversation.instance;

        // Se não tem instância na conversa, buscar uma conectada do usuário
        if (!instance || instance.status !== "connected") {
          const { data: connectedInstance } = await supabase
            .from("whatsapp_instances")
            .select("*")
            .eq("user_id", message.user_id)
            .eq("status", "connected")
            .limit(1)
            .single();

          if (connectedInstance) {
            instance = connectedInstance;
            instanceId = connectedInstance.id;
          }
        }

        if (!instance || instance.status !== "connected") {
          throw new Error("No connected WhatsApp instance available");
        }

        // Substituir variáveis na mensagem
        let messageContent = message.message_content;
        messageContent = messageContent.replace(/\{\{nome\}\}/gi, contact.name || "");
        messageContent = messageContent.replace(/\{\{telefone\}\}/gi, contact.phone || "");
        messageContent = messageContent.replace(/\{\{email\}\}/gi, contact.email || "");

        // Determinar o JID do contato
        let remoteJid = contact.phone;
        
        // Suporte para contatos LID (Click-to-WhatsApp Ads)
        if (remoteJid.startsWith("LID_") || contact.label_id) {
          const lidValue = contact.label_id || remoteJid.replace("LID_", "");
          remoteJid = `${lidValue}@lid`;
        } else if (!remoteJid.includes("@")) {
          // Limpar número e adicionar sufixo WhatsApp
          const cleanPhone = remoteJid.replace(/\D/g, "");
          remoteJid = `${cleanPhone}@s.whatsapp.net`;
        }

        // Enviar mensagem via Evolution API
        const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
        const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

        if (!evolutionApiUrl || !evolutionApiKey) {
          throw new Error("Evolution API not configured");
        }

        const sendResponse = await fetch(
          `${evolutionApiUrl}/message/sendText/${instance.instance_name}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: evolutionApiKey,
            },
            body: JSON.stringify({
              number: remoteJid,
              text: messageContent,
            }),
          }
        );

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          throw new Error(`Failed to send message: ${errorText}`);
        }

        const sendResult = await sendResponse.json();

        // Atualizar status para 'sent'
        await supabase
          .from("scheduled_task_messages")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", message.id);

        // Registrar a mensagem no inbox_messages
        await supabase.from("inbox_messages").insert({
          user_id: message.user_id,
          conversation_id: message.conversation_id,
          contact_id: message.contact_id,
          instance_id: instanceId,
          content: messageContent,
          message_type: "text",
          direction: "outgoing",
          status: "sent",
          remote_jid: remoteJid,
          message_id: sendResult.key?.id || `scheduled_${message.id}`,
          timestamp: new Date().toISOString(),
        });

        // Atualizar preview da conversa
        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: messageContent.substring(0, 100),
            last_message_direction: 'outbound',
          })
          .eq("id", message.conversation_id);

        // Marcar tarefa como concluída (opcional - pode ser configurável)
        if (message.task) {
          await supabase
            .from("conversation_tasks")
            .update({
              completed_at: new Date().toISOString(),
            })
            .eq("id", message.task_id);
        }

        results.sent++;
        console.log(`Message ${message.id} sent successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.failed++;
        results.errors.push(`Message ${message.id}: ${errorMessage}`);

        // Atualizar status para 'failed'
        await supabase
          .from("scheduled_task_messages")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("id", message.id);

        console.error(`Error processing message ${message.id}:`, error);
      }
    }

    console.log("Processing complete:", results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in process-scheduled-task-messages:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
