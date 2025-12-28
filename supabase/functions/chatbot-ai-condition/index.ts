import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Intent {
  id: string;
  label: string;
  description: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userMessage, intents, intentDescription } = await req.json();

    // Support both single intent (legacy) and multiple intents
    const hasMultipleIntents = Array.isArray(intents) && intents.length > 0;

    if (!userMessage) {
      return new Response(
        JSON.stringify({ error: 'userMessage is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!hasMultipleIntents && !intentDescription) {
      return new Response(
        JSON.stringify({ error: 'intents array or intentDescription is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (hasMultipleIntents) {
      // Multiple intents mode
      console.log(`[AI-CONDITION] Analyzing ${intents.length} intents - Message: "${userMessage.substring(0, 50)}..."`);

      const intentsList = (intents as Intent[])
        .map((intent, idx) => `${idx + 1}. ID: "${intent.id}" - ${intent.label}: "${intent.description}"`)
        .join('\n');

      const systemPrompt = `Você é um analisador de intenções. Sua tarefa é determinar qual intenção melhor corresponde à mensagem do usuário.

Regras:
- Analise o significado semântico, não apenas palavras exatas
- Considere variações de linguagem e sinônimos
- Seja rigoroso na análise - só escolha uma intenção se houver correspondência clara
- Se nenhuma intenção corresponder claramente, responda NONE
- Responda APENAS com o ID da intenção correspondente ou "NONE", nada mais`;

      const userPrompt = `Intenções disponíveis:
${intentsList}

Mensagem do usuário: "${userMessage}"

Qual intenção corresponde melhor? Responda APENAS com o ID da intenção (entre aspas no formato acima) ou "NONE".`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 50,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required" }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "AI service error" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content?.trim() || "";
      
      // Try to find the matched intent ID
      let matchedIntentId = "NONE";
      const upperResponse = aiResponse.toUpperCase();
      
      if (!upperResponse.includes("NONE")) {
        // Look for intent ID in response
        for (const intent of intents as Intent[]) {
          if (aiResponse.includes(intent.id)) {
            matchedIntentId = intent.id;
            break;
          }
        }
        // Fallback: try to match by index number
        if (matchedIntentId === "NONE") {
          const numberMatch = aiResponse.match(/\d+/);
          if (numberMatch) {
            const idx = parseInt(numberMatch[0]) - 1;
            if (idx >= 0 && idx < intents.length) {
              matchedIntentId = (intents as Intent[])[idx].id;
            }
          }
        }
      }
      
      console.log(`[AI-CONDITION] Result - AI Response: "${aiResponse}" | Matched Intent: ${matchedIntentId}`);

      return new Response(
        JSON.stringify({ 
          matchedIntentId,
          match: matchedIntentId !== "NONE",
          aiResponse,
          userMessagePreview: userMessage.substring(0, 100)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Single intent mode (legacy support)
      console.log(`[AI-CONDITION] Analyzing single intent - Message: "${userMessage.substring(0, 50)}..." | Intent: "${intentDescription.substring(0, 50)}..."`);

      const systemPrompt = `Você é um analisador de intenções. Sua tarefa é determinar se a mensagem do usuário corresponde a uma intenção específica.

Regras:
- Analise o significado semântico, não apenas palavras exatas
- Considere variações de linguagem e sinônimos
- Seja rigoroso na análise - só responda SIM se houver correspondência clara
- Responda APENAS com "SIM" ou "NÃO", nada mais`;

      const userPrompt = `Intenção a verificar: "${intentDescription}"

Mensagem do usuário: "${userMessage}"

A mensagem corresponde à intenção? Responda apenas SIM ou NÃO.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 10,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required" }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "AI service error" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content?.trim().toUpperCase() || "";
      
      const match = aiResponse.includes("SIM");
      
      console.log(`[AI-CONDITION] Result - AI Response: "${aiResponse}" | Match: ${match}`);

      return new Response(
        JSON.stringify({ 
          match,
          matchedIntentId: match ? "yes" : "no",
          aiResponse,
          intentDescription,
          userMessagePreview: userMessage.substring(0, 100)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error("[AI-CONDITION] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
