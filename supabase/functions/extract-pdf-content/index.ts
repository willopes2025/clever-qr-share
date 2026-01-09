import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, pdfUrl } = await req.json();

    if (!messageId || !pdfUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'messageId and pdfUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[EXTRACT-PDF] Processing message:', messageId, 'URL:', pdfUrl);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if already extracted
    const { data: existingMessage } = await supabase
      .from('inbox_messages')
      .select('extracted_content')
      .eq('id', messageId)
      .single();

    if (existingMessage?.extracted_content) {
      console.log('[EXTRACT-PDF] Content already extracted, returning cached');
      return new Response(
        JSON.stringify({ success: true, content: existingMessage.extracted_content }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download the PDF
    console.log('[EXTRACT-PDF] Downloading PDF...');
    const pdfResponse = await fetch(pdfUrl);
    
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    
    console.log('[EXTRACT-PDF] PDF downloaded, size:', pdfBuffer.byteLength, 'bytes');

    // Send to Lovable AI for text extraction
    console.log('[EXTRACT-PDF] Sending to AI for extraction...');
    
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
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extraia todo o texto deste documento PDF. Preserve a estrutura e formatação do texto original o máximo possível. Se houver tabelas, tente representá-las de forma legível. Retorne apenas o texto extraído, sem comentários adicionais.`
              },
              {
                type: 'file',
                file: {
                  filename: 'document.pdf',
                  file_data: `data:application/pdf;base64,${base64Pdf}`
                }
              }
            ]
          }
        ],
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[EXTRACT-PDF] AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Créditos de IA insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI extraction failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const extractedContent = aiData.choices?.[0]?.message?.content || '';

    console.log('[EXTRACT-PDF] Content extracted, length:', extractedContent.length);

    // Save to database
    const { error: updateError } = await supabase
      .from('inbox_messages')
      .update({ extracted_content: extractedContent })
      .eq('id', messageId);

    if (updateError) {
      console.error('[EXTRACT-PDF] Error saving content:', updateError);
      // Still return the content even if save fails
    }

    return new Response(
      JSON.stringify({ success: true, content: extractedContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[EXTRACT-PDF] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
