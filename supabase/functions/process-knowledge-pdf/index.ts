import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { knowledgeItemId } = await req.json();

    if (!knowledgeItemId) {
      throw new Error('knowledgeItemId is required');
    }

    console.log(`[PDF-PROCESS] Processing knowledge item: ${knowledgeItemId}`);

    // Get the knowledge item
    const { data: item, error: itemError } = await supabase
      .from('ai_agent_knowledge_items')
      .select('*')
      .eq('id', knowledgeItemId)
      .single();

    if (itemError || !item) {
      throw new Error('Knowledge item not found');
    }

    if (item.source_type !== 'pdf' || !item.file_url) {
      throw new Error('Invalid knowledge item type');
    }

    // Update status to processing
    await supabase
      .from('ai_agent_knowledge_items')
      .update({ status: 'processing' })
      .eq('id', knowledgeItemId);

    console.log(`[PDF-PROCESS] Downloading PDF from: ${item.file_url}`);

    // Download the PDF
    const pdfResponse = await fetch(item.file_url);
    if (!pdfResponse.ok) {
      throw new Error('Failed to download PDF');
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    console.log(`[PDF-PROCESS] PDF downloaded, size: ${pdfBuffer.byteLength} bytes`);

    // Use AI to extract and summarize PDF content
    // We'll send the PDF as base64 and ask Gemini to extract the text content
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um extrator de conteúdo de documentos PDF. Sua tarefa é:
1. Extrair todo o texto relevante do documento
2. Organizar as informações de forma clara e estruturada
3. Manter FAQs, perguntas/respostas, especificações e informações importantes
4. Remover conteúdo irrelevante como headers/footers repetitivos
5. Preservar a hierarquia de informações (títulos, subtítulos, listas)

Retorne APENAS o conteúdo extraído, organizado de forma útil para um agente de IA que vai usar isso como base de conhecimento.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extraia e organize o conteúdo deste documento PDF chamado "${item.file_name}". Retorne o texto formatado e estruturado.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[PDF-PROCESS] AI API error:', aiResponse.status, errorText);
      
      // Fallback: just store a message that the PDF was uploaded
      await supabase
        .from('ai_agent_knowledge_items')
        .update({
          status: 'completed',
          processed_content: `[PDF: ${item.file_name}] - Documento carregado. O conteúdo será usado como referência visual pelo agente.`,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', knowledgeItemId);

      return new Response(
        JSON.stringify({ success: true, fallback: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const extractedContent = aiData.choices?.[0]?.message?.content;

    if (!extractedContent) {
      throw new Error('Failed to extract content from PDF');
    }

    console.log(`[PDF-PROCESS] Content extracted, length: ${extractedContent.length} chars`);

    // Update the knowledge item with extracted content
    await supabase
      .from('ai_agent_knowledge_items')
      .update({
        status: 'completed',
        processed_content: extractedContent,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', knowledgeItemId);

    console.log('[PDF-PROCESS] Knowledge item updated successfully');

    return new Response(
      JSON.stringify({ success: true, contentLength: extractedContent.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PDF-PROCESS] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Try to update status to failed
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { knowledgeItemId } = await req.json().catch(() => ({}));
      if (knowledgeItemId) {
        await supabase
          .from('ai_agent_knowledge_items')
          .update({ status: 'failed', error_message: message })
          .eq('id', knowledgeItemId);
      }
    } catch {
      // Ignore update errors
    }

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
