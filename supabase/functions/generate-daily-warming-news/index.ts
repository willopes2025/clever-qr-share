import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeneratedContent {
  text: string;
  needsImage: boolean;
  imagePrompt?: string;
  category: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[WARMING-NEWS] Starting daily content generation...');

    // Generate diverse warming content using AI
    const prompt = `Você é um gerador de conteúdo para aquecimento de WhatsApp.

Gere exatamente 20 mensagens curtas e interessantes para conversas naturais. 
As mensagens devem ser variadas e incluir:

1. Curiosidades do dia (fatos interessantes, "sabia que...")
2. Dicas úteis do cotidiano
3. Frases motivacionais curtas
4. Comentários sobre temas leves (clima, fim de semana, etc)
5. Perguntas engajadoras

Regras:
- Cada mensagem: 20-100 caracteres
- Português brasileiro informal e natural
- Parecer conversas reais entre amigos
- Pode incluir emojis ocasionalmente
- Para cada mensagem, indique se uma imagem complementaria bem
- Se precisar de imagem, descreva brevemente o que seria

Retorne um JSON válido com este formato exato:
[
  {"text": "Sabia que abelhas dormem de 5-8 horas? 🐝", "needsImage": true, "imagePrompt": "cute cartoon bee sleeping on flower", "category": "curiosity"},
  {"text": "Bom dia! Tudo bem por aí?", "needsImage": false, "category": "greeting"},
  {"text": "Dica: beber água logo ao acordar ativa o metabolismo 💧", "needsImage": false, "category": "tip"}
]

Categorias válidas: curiosity, greeting, tip, motivation, casual, question, news`;

    console.log('[WARMING-NEWS] Calling AI to generate content...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um assistente que gera conteúdo de aquecimento para WhatsApp. Sempre responda com JSON válido.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WARMING-NEWS] AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const contentText = aiData.choices?.[0]?.message?.content || '';
    
    console.log('[WARMING-NEWS] AI response received, parsing...');

    // Parse JSON from the response
    let generatedContents: GeneratedContent[] = [];
    try {
      // Find JSON array in the response
      const jsonMatch = contentText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        generatedContents = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('[WARMING-NEWS] Error parsing AI response:', parseError);
      console.log('[WARMING-NEWS] Raw content:', contentText);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[WARMING-NEWS] Parsed ${generatedContents.length} content items`);

    const insertedContents = [];
    const contentWithImages = generatedContents.filter(c => c.needsImage && c.imagePrompt);

    // Process text content first (faster)
    for (const content of generatedContents) {
      if (!content.needsImage) {
        const { data, error } = await supabase
          .from('warming_content')
          .insert({
            content_type: 'text',
            content: content.text,
            category: content.category || 'generic',
            is_active: true,
            created_by_ai: true,
            user_id: '00000000-0000-0000-0000-000000000000', // System user
          })
          .select()
          .single();

        if (!error && data) {
          insertedContents.push(data);
        }
      }
    }

    console.log(`[WARMING-NEWS] Inserted ${insertedContents.length} text contents`);

    // Generate images for content that needs them (limit to 5 to avoid rate limits)
    const imagesToGenerate = contentWithImages.slice(0, 5);
    
    for (const content of imagesToGenerate) {
      try {
        console.log(`[WARMING-NEWS] Generating image for: ${content.imagePrompt}`);

        const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [
              { 
                role: 'user', 
                content: `Generate a simple, friendly image for WhatsApp sharing: ${content.imagePrompt}. Make it colorful and engaging.` 
              }
            ],
            modalities: ['image', 'text'],
          }),
        });

        if (!imageResponse.ok) {
          console.error('[WARMING-NEWS] Image generation failed:', imageResponse.status);
          continue;
        }

        const imageData = await imageResponse.json();
        const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (imageBase64 && imageBase64.startsWith('data:image')) {
          // Extract base64 data and upload to storage
          const base64Data = imageBase64.split(',')[1];
          const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const fileName = `ai-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('warming-images')
            .upload(fileName, imageBytes, {
              contentType: 'image/png',
              cacheControl: '3600',
            });

          if (!uploadError && uploadData) {
            const { data: publicUrl } = supabase.storage
              .from('warming-images')
              .getPublicUrl(fileName);

            // Insert content with image
            const { data: contentData, error: contentError } = await supabase
              .from('warming_content')
              .insert({
                content_type: 'image',
                content: content.text,
                media_url: publicUrl.publicUrl,
                category: content.category || 'generic',
                is_active: true,
                created_by_ai: true,
                user_id: '00000000-0000-0000-0000-000000000000',
              })
              .select()
              .single();

            if (!contentError && contentData) {
              insertedContents.push(contentData);
              console.log(`[WARMING-NEWS] Created image content: ${fileName}`);
            }
          } else {
            console.error('[WARMING-NEWS] Upload error:', uploadError);
          }
        }
      } catch (imageError) {
        console.error('[WARMING-NEWS] Error generating image:', imageError);
      }
    }

    console.log(`[WARMING-NEWS] Total content created: ${insertedContents.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: insertedContents.length,
        textOnly: generatedContents.filter(c => !c.needsImage).length,
        withImages: imagesToGenerate.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WARMING-NEWS] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
