import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const META_API_URL = 'https://graph.facebook.com/v18.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Sessão expirada, faça login novamente' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('[META-TEMPLATES] Auth error:', authError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Sessão expirada, faça login novamente' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's Meta WhatsApp integration from database
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'meta_whatsapp')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.log('[META-TEMPLATES] No integration found for user:', user.id);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Integração Meta WhatsApp não configurada. Configure nas Settings.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = integration.credentials?.access_token;
    const businessAccountId = integration.credentials?.business_account_id;

    if (!accessToken) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Access Token não configurado na integração' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!businessAccountId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Business Account ID não configurado na integração' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list';

    console.log('[META-TEMPLATES] Action:', action, 'for user:', user.id);

    if (action === 'list') {
      // List all templates
      const response = await fetch(
        `${META_API_URL}/${businessAccountId}/message_templates?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      const result = await response.json();
      console.log('[META-TEMPLATES] Templates fetched:', result.data?.length || 0);

      if (!response.ok) {
        console.error('[META-TEMPLATES] Meta API error:', result.error);
        return new Response(JSON.stringify({ 
          success: false,
          error: result.error?.message || 'Erro ao buscar templates do Meta' 
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Filter and format templates
      const templates = (result.data || []).map((template: any) => ({
        id: template.id,
        name: template.name,
        status: template.status,
        category: template.category,
        language: template.language,
        components: template.components,
        qualityScore: template.quality_score
      }));

      return new Response(JSON.stringify({
        success: true,
        templates,
        paging: result.paging
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get') {
      const templateName = url.searchParams.get('name');
      if (!templateName) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Nome do template é obrigatório' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const response = await fetch(
        `${META_API_URL}/${businessAccountId}/message_templates?name=${templateName}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('[META-TEMPLATES] Meta API error:', result.error);
        return new Response(JSON.stringify({ 
          success: false,
          error: result.error?.message || 'Erro ao buscar template' 
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        template: result.data?.[0] || null
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: false,
      error: `Ação desconhecida: ${action}` 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[META-TEMPLATES] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
