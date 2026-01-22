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
    const { templateId, content, variationCount = 5, includeMedia = false, mediaType = null, mediaUrl = null, mediaFilename = null } = await req.json();

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

    // Verify template exists
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .select('id, user_id')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user owns the template or is in the same organization
    let isAuthorized = template.user_id === user.id;
    
    if (!isAuthorized) {
      // Get organization members to check if template owner is in same org
      const { data: userOrg } = await supabase
        .from('team_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (userOrg?.organization_id) {
        const { data: orgMembers } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('organization_id', userOrg.organization_id)
          .eq('status', 'active');

        const orgMemberIds = orgMembers?.map(m => m.user_id) || [];
        isAuthorized = orgMemberIds.includes(template.user_id);
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to modify this template' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating ${variationCount} variations for template ${templateId}, includeMedia: ${includeMedia}`);

    // Call Lovable AI to generate variations
    const prompt = `Você é um especialista em copywriting para WhatsApp e marketing digital.

Sua tarefa: Criar exatamente ${variationCount} VARIAÇÕES COMPLETAS da mensagem abaixo.

⚠️ IMPORTANTE - CADA VARIAÇÃO DEVE SER:
- Uma mensagem COMPLETA e AUTÔNOMA (não linhas separadas!)
- Uma STRING ÚNICA contendo TODO o texto da mensagem
- Use \\n para representar quebras de linha DENTRO de cada variação
- Mantendo o mesmo significado, tom e estrutura da original

ALTERAÇÕES PERMITIDAS em cada variação:
- Substituir emojis por alternativas similares
- Trocar palavras por sinônimos naturais
- Pequenas mudanças na estrutura das frases
- Leve variação na pontuação

REGRAS OBRIGATÓRIAS:
1. MANTENHA TODAS as variáveis {{variavel}} EXATAMENTE como estão (ex: {{nome}}, {{telefone}})
2. MANTENHA o mesmo tom (formal/informal) da mensagem original
3. NÃO altere números, datas, valores monetários ou links
4. Cada variação DEVE ter aproximadamente o mesmo tamanho da original
5. NÃO adicione informações novas que não estavam no original
6. Cada elemento do array DEVE conter a mensagem INTEIRA, não linhas separadas

EXEMPLO DE ENTRADA:
"Olá {{nome}}! 👋
Temos uma oferta especial para você.
Responda SIM para saber mais!"

EXEMPLO DE SAÍDA CORRETA:
{
  "variations": [
    "Oi {{nome}}! 😊\\nPreparamos uma promoção exclusiva.\\nDigite SIM para conferir!",
    "Olá {{nome}}! 🙋\\nHá uma condição especial esperando por você.\\nResponda SIM para detalhes!"
  ]
}

MENSAGEM ORIGINAL:
"""
${content}
"""

Responda APENAS com um JSON válido no formato:
{"variations": ["variação completa 1 com \\n para quebras", "variação completa 2", ...]}

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

    // Validate variations - must be complete messages with reasonable length
    const originalLength = content.length;
    const validVariations = variations.filter(v => {
      if (typeof v !== 'string') return false;
      const trimmed = v.trim();
      const len = trimmed.length;
      // Variation should be at least 40% of original and no more than 200%
      // This helps filter out broken/partial responses
      return len >= originalLength * 0.4 && len <= originalLength * 2;
    });

    console.log(`Validated ${validVariations.length}/${variations.length} variations (original length: ${originalLength})`);

    if (validVariations.length === 0) {
      console.error('All variations failed validation. Original variations:', variations);
      throw new Error('Variações geradas estão em formato incorreto. Tente novamente.');
    }

    // Delete existing variations for this template
    await supabase
      .from('template_variations')
      .delete()
      .eq('template_id', templateId);

    // Insert new variations (use validVariations instead of original)
    const variationsToInsert = validVariations.slice(0, variationCount).map((variationContent, index) => ({
      template_id: templateId,
      content: variationContent.trim().replace(/\\n/g, '\n'),
      variation_index: index + 1,
      // Include media only if requested
      media_type: includeMedia ? mediaType : null,
      media_url: includeMedia ? mediaUrl : null,
      media_filename: includeMedia ? mediaFilename : null,
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
