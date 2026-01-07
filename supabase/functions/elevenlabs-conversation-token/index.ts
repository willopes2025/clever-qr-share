import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!ELEVENLABS_API_KEY) {
      console.error('ELEVENLABS_API_KEY is not set');
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const { agentId, contactName, contactPhone, conversationContext } = await req.json();

    console.log('Generating ElevenLabs conversation token for:', { agentId, contactName, contactPhone });

    // Request a conversation token from ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('ElevenLabs session created successfully');

    // Build dynamic instructions based on context
    const instructions = buildAgentInstructions(contactName, contactPhone, conversationContext);

    return new Response(
      JSON.stringify({
        signedUrl: data.signed_url,
        instructions,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating conversation token:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function buildAgentInstructions(
  contactName?: string, 
  contactPhone?: string, 
  conversationContext?: string
): string {
  const name = contactName || 'o cliente';
  
  let instructions = `Você é um assistente de atendimento profissional e amigável.
  
Você está em uma ligação telefônica com ${name}${contactPhone ? ` (${contactPhone})` : ''}.

Diretrizes Gerais:
- Seja cordial, profissional e objetivo
- Fale de forma natural e conversacional
- Responda em português brasileiro
- Mantenha as respostas concisas para uma conversa telefônica
- Se não souber algo, diga que vai verificar e retornar
- Sempre confirme entendimento antes de prosseguir com ações importantes`;

  if (conversationContext) {
    instructions += `\n\n${conversationContext}`;
  }

  return instructions;
}
