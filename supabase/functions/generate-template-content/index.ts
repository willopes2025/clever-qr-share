import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, category, variables } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const variablesList = (variables || [])
      .map((v: { key: string; label: string }) => `- {{${v.key}}} → ${v.label}`)
      .join("\n");

    const systemPrompt = `Você é um especialista em criar mensagens para WhatsApp Business. 
Sua tarefa é gerar mensagens profissionais, naturais e persuasivas em português brasileiro.

REGRAS IMPORTANTES:
1. Use as variáveis dinâmicas disponíveis no formato {{nome_da_variavel}} para personalizar a mensagem.
2. A mensagem deve ser adequada para WhatsApp (concisa, direta, com emojis moderados).
3. NÃO use saudações genéricas como "Prezado(a)". Prefira "Olá {{nome}}" ou similar.
4. NÃO inclua assuntos ou títulos. Apenas o corpo da mensagem.
5. Mantenha a mensagem entre 2 a 6 linhas.
6. Use quebras de linha para organizar o texto.
7. Categoria da mensagem: ${category || "geral"}

VARIÁVEIS DISPONÍVEIS:
${variablesList || "Nenhuma variável disponível"}

Responda APENAS com o conteúdo da mensagem, sem explicações adicionais.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Erro ao gerar conteúdo com IA");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("IA não retornou conteúdo");
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-template-content error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
