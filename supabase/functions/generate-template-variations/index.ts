import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templateId, content, variationCount = 5 } = await req.json();

    if (!templateId || !content) {
      return new Response(
        JSON.stringify({ error: 'templateId and content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify template belongs to user
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .select('id, user_id')
      .eq('id', templateId)
      .single();

    if (templateError || !template || template.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Template not found or not authorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating ${variationCount} variations for template ${templateId}`);

    // Call Lovable AI to generate variations
    const prompt = `Você é um especialista em copywriting para WhatsApp e marketing digital.

Gere exatamente ${variationCount} variações da mensagem abaixo, mantendo o mesmo significado e intenção, mas alterando:
- Emojis (use alternativas similares ou adicione/remova levemente)
- Palavras por sinônimos naturais
- Estrutura das frases (sem mudar o tom ou formalidade)
- Pontuação e formatação levemente diferente

REGRAS OBRIGATÓRIAS:
1. MANTENHA TODAS as variáveis no formato {{variavel}} EXATAMENTE como estão (ex: {{nome}}, {{telefone}}, {{empresa}})
2. Mantenha o mesmo tom (formal/informal) da mensagem original
3. NÃO altere números, datas, valores monetários ou links específicos
4. Cada variação DEVE ser única e diferente das outras
5. Mantenha aproximadamente o mesmo tamanho da mensagem original
6. NÃO adicione informações que não estavam no original

Mensagem original:
"""
${content}
"""

Responda APENAS com um JSON válido no formato:
{"variations": ["variação 1", "variação 2", ...]}

Sem explicações, sem markdown, apenas o JSON.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos à sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error('Failed to generate variations');
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content in AI response');
    }

    console.log('AI response:', aiContent);

    // Parse the JSON response
    let variations: string[];
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiContent.match(/\{[\s\S]*"variations"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        variations = parsed.variations;
      } else {
        throw new Error('No valid JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse AI response');
    }

    if (!Array.isArray(variations) || variations.length === 0) {
      throw new Error('Invalid variations format');
    }

    // Delete existing variations for this template
    await supabase
      .from('template_variations')
      .delete()
      .eq('template_id', templateId);

    // Insert new variations
    const variationsToInsert = variations.slice(0, variationCount).map((content, index) => ({
      template_id: templateId,
      content: content.trim(),
      variation_index: index + 1,
    }));

    const { data: insertedVariations, error: insertError } = await supabase
      .from('template_variations')
      .insert(variationsToInsert)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to save variations');
    }

    console.log(`Successfully created ${insertedVariations?.length} variations`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        variations: insertedVariations,
        count: insertedVariations?.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-template-variations:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
