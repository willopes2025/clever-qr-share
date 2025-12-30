import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ACCESS_TOKEN = Deno.env.get('META_WHATSAPP_ACCESS_TOKEN');
const BUSINESS_ACCOUNT_ID = Deno.env.get('META_WHATSAPP_BUSINESS_ACCOUNT_ID');
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
      throw new Error('Authorization header required');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'list';

    console.log('[META-TEMPLATES] Action:', action);

    if (action === 'list') {
      // List all templates
      const response = await fetch(
        `${META_API_URL}/${BUSINESS_ACCOUNT_ID}/message_templates?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`
          }
        }
      );

      const result = await response.json();
      console.log('[META-TEMPLATES] Templates fetched:', result.data?.length || 0);

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to fetch templates');
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
        throw new Error('Template name is required');
      }

      const response = await fetch(
        `${META_API_URL}/${BUSINESS_ACCOUNT_ID}/message_templates?name=${templateName}`,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to fetch template');
      }

      return new Response(JSON.stringify({
        success: true,
        template: result.data?.[0] || null
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: unknown) {
    console.error('[META-TEMPLATES] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
