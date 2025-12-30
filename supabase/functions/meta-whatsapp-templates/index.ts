import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const META_API_URL = 'https://graph.facebook.com/v18.0';

// Helper to get WABA ID from phone_number_id
async function getWabaIdFromPhoneNumber(phoneNumberId: string, accessToken: string): Promise<{ wabaId: string | null; error: string | null }> {
  try {
    console.log('[META-TEMPLATES] Fetching WABA ID from phone_number_id:', phoneNumberId);
    
    const response = await fetch(
      `${META_API_URL}/${phoneNumberId}?fields=whatsapp_business_account`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const result = await response.json();
    console.log('[META-TEMPLATES] Phone number lookup result:', JSON.stringify(result));

    if (!response.ok) {
      return { 
        wabaId: null, 
        error: result.error?.message || 'Erro ao buscar WABA ID do número' 
      };
    }

    const wabaId = result.whatsapp_business_account?.id;
    if (!wabaId) {
      return { 
        wabaId: null, 
        error: 'Não foi possível detectar o WhatsApp Business Account ID. Verifique se o número está vinculado a uma conta comercial.' 
      };
    }

    return { wabaId, error: null };
  } catch (err) {
    console.error('[META-TEMPLATES] Error fetching WABA ID:', err);
    return { wabaId: null, error: 'Erro de rede ao buscar WABA ID' };
  }
}

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
        status: 200, // Return 200 to avoid FunctionsHttpError in frontend
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
        status: 200,
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
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = integration.credentials?.access_token;
    const phoneNumberId = integration.credentials?.phone_number_id;
    let businessAccountId = integration.credentials?.business_account_id;

    console.log('[META-TEMPLATES] Credentials:', { 
      hasAccessToken: !!accessToken, 
      phoneNumberId, 
      businessAccountId 
    });

    if (!accessToken) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Access Token não configurado na integração' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!phoneNumberId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Phone Number ID não configurado na integração' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If no business_account_id, auto-detect from phone_number_id
    if (!businessAccountId) {
      console.log('[META-TEMPLATES] No WABA ID configured, auto-detecting...');
      const { wabaId, error: wabaError } = await getWabaIdFromPhoneNumber(phoneNumberId, accessToken);
      
      if (wabaError) {
        return new Response(JSON.stringify({ 
          success: false,
          error: wabaError
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      businessAccountId = wabaId;
      console.log('[META-TEMPLATES] Auto-detected WABA ID:', businessAccountId);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list';

    console.log('[META-TEMPLATES] Action:', action, 'WABA ID:', businessAccountId);

    if (action === 'list') {
      // List all templates
      const templatesUrl = `${META_API_URL}/${businessAccountId}/message_templates?limit=100`;
      console.log('[META-TEMPLATES] Fetching templates from:', templatesUrl);
      
      const response = await fetch(templatesUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const result = await response.json();
      console.log('[META-TEMPLATES] Meta API response status:', response.status);

      if (!response.ok) {
        console.error('[META-TEMPLATES] Meta API error:', JSON.stringify(result.error));
        
        // Check if it's the "Business" node type error (wrong ID type)
        if (result.error?.code === 100 && result.error?.message?.includes('node type (Business)')) {
          // Try to auto-detect the correct WABA ID
          console.log('[META-TEMPLATES] Detected Business Manager ID instead of WABA ID, retrying with auto-detection...');
          
          const { wabaId, error: wabaError } = await getWabaIdFromPhoneNumber(phoneNumberId, accessToken);
          
          if (wabaError) {
            return new Response(JSON.stringify({ 
              success: false,
              error: `O ID informado parece ser do Business Manager, não do WhatsApp Business Account. ${wabaError}` 
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Retry with correct WABA ID
          console.log('[META-TEMPLATES] Retrying with correct WABA ID:', wabaId);
          const retryUrl = `${META_API_URL}/${wabaId}/message_templates?limit=100`;
          const retryResponse = await fetch(retryUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          const retryResult = await retryResponse.json();
          
          if (!retryResponse.ok) {
            return new Response(JSON.stringify({ 
              success: false,
              error: retryResult.error?.message || 'Erro ao buscar templates',
              meta: retryResult.error
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Return successful retry result
          const templates = (retryResult.data || []).map((template: any) => ({
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
            detectedWabaId: wabaId,
            paging: retryResult.paging
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ 
          success: false,
          error: result.error?.message || 'Erro ao buscar templates do Meta',
          meta: result.error
        }), {
          status: 200,
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

      console.log('[META-TEMPLATES] Templates fetched successfully:', templates.length);

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
          status: 200,
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
          error: result.error?.message || 'Erro ao buscar template',
          meta: result.error
        }), {
          status: 200,
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
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[META-TEMPLATES] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
