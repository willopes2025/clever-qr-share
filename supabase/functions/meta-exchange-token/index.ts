import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_ID = '25248752291487782';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Get request body
    const { code } = await req.json();
    
    if (!code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Código de autorização não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get App Secret from Supabase secrets
    const appSecret = Deno.env.get('META_WHATSAPP_APP_SECRET');
    if (!appSecret) {
      console.error('[META-EXCHANGE] META_WHATSAPP_APP_SECRET not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'App Secret não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[META-EXCHANGE] Exchanging code for access token...');

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v24.0/oauth/access_token?` +
      `client_id=${APP_ID}` +
      `&client_secret=${appSecret}` +
      `&code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[META-EXCHANGE] Token exchange error:', tokenData.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: tokenData.error.message || 'Erro ao trocar código por token' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = tokenData.access_token;
    console.log('[META-EXCHANGE] Access token obtained successfully');

    // Get WhatsApp Business Accounts
    console.log('[META-EXCHANGE] Fetching WhatsApp Business Accounts...');
    
    // Use app access token for debug_token endpoint
    const appAccessToken = `${APP_ID}|${appSecret}`;
    const wabaUrl = `https://graph.facebook.com/v24.0/debug_token?input_token=${accessToken}&access_token=${appAccessToken}`;
    const debugResponse = await fetch(wabaUrl);
    const debugData = await debugResponse.json();
    
    console.log('[META-EXCHANGE] Debug token response:', JSON.stringify(debugData, null, 2));

    // Get shared WABA from the token permissions
    let wabaId: string | null = null;
    let phoneNumberId: string | null = null;
    let displayPhoneNumber: string | null = null;
    let businessName: string | null = null;

    // Try to get WABA from granular scopes
    if (debugData.data?.granular_scopes) {
      const wabaScope = debugData.data.granular_scopes.find(
        (scope: any) => scope.scope === 'whatsapp_business_management'
      );
      if (wabaScope?.target_ids?.length > 0) {
        wabaId = wabaScope.target_ids[0];
        console.log('[META-EXCHANGE] Found WABA ID from scopes:', wabaId);
      }
      
      // Also check whatsapp_business_messaging scope for phone number IDs
      if (!wabaId) {
        const msgScope = debugData.data.granular_scopes.find(
          (scope: any) => scope.scope === 'whatsapp_business_messaging'
        );
        if (msgScope?.target_ids?.length > 0) {
          wabaId = msgScope.target_ids[0];
          console.log('[META-EXCHANGE] Found WABA ID from messaging scope:', wabaId);
        }
      }
    }

    // If we have WABA ID, get phone numbers
    if (wabaId) {
      const phoneUrl = `https://graph.facebook.com/v24.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
      const phoneResponse = await fetch(phoneUrl);
      const phoneData = await phoneResponse.json();
      
      console.log('[META-EXCHANGE] Phone numbers response:', JSON.stringify(phoneData, null, 2));

      if (phoneData.data?.length > 0) {
        const phone = phoneData.data[0];
        phoneNumberId = phone.id;
        displayPhoneNumber = phone.display_phone_number;
        businessName = phone.verified_name;
        console.log('[META-EXCHANGE] Found phone:', displayPhoneNumber);
      }
    } else {
      // Fallback: Try to get WABA from /me/businesses endpoint
      console.log('[META-EXCHANGE] Trying /me/businesses endpoint...');
      const bizUrl = `https://graph.facebook.com/v24.0/me/businesses?fields=id,name&access_token=${accessToken}`;
      const bizResponse = await fetch(bizUrl);
      const bizData = await bizResponse.json();
      console.log('[META-EXCHANGE] Businesses response:', JSON.stringify(bizData, null, 2));
      
      // Try each business to find WABAs
      if (bizData.data?.length > 0) {
        for (const biz of bizData.data) {
          const wabaSearchUrl = `https://graph.facebook.com/v24.0/${biz.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`;
          const wabaSearchResponse = await fetch(wabaSearchUrl);
          const wabaSearchData = await wabaSearchResponse.json();
          console.log(`[META-EXCHANGE] WABAs for business ${biz.id}:`, JSON.stringify(wabaSearchData, null, 2));
          
          if (wabaSearchData.data?.length > 0) {
            wabaId = wabaSearchData.data[0].id;
            // Get phone numbers for this WABA
            const phoneUrl = `https://graph.facebook.com/v24.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
            const phoneResponse = await fetch(phoneUrl);
            const phoneData = await phoneResponse.json();
            if (phoneData.data?.length > 0) {
              phoneNumberId = phoneData.data[0].id;
              displayPhoneNumber = phoneData.data[0].display_phone_number;
              businessName = phoneData.data[0].verified_name;
            }
            break;
          }
        }
      }
    }

    if (!wabaId || !phoneNumberId) {
      // Last resort: check if this is a system user token
      console.log('[META-EXCHANGE] Trying to get WABA from me endpoint...');
      const meUrl = `https://graph.facebook.com/v24.0/me?fields=id,name&access_token=${accessToken}`;
      const meResponse = await fetch(meUrl);
      const meData = await meResponse.json();
      console.log('[META-EXCHANGE] Me endpoint response:', JSON.stringify(meData, null, 2));

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não foi possível encontrar a conta WhatsApp Business. Verifique se você completou o processo de compartilhamento.',
          debug: { debugData, meData }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save credentials to integrations table
    console.log('[META-EXCHANGE] Saving integration to database...');
    
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: upsertError } = await adminClient
      .from('integrations')
      .upsert({
        user_id: userId,
        provider: 'meta_whatsapp',
        credentials: {
          phone_number_id: phoneNumberId,
          business_account_id: wabaId,
          access_token: accessToken,
          display_phone_number: displayPhoneNumber,
          business_name: businessName,
        },
        is_active: true,
        last_sync_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      });

    if (upsertError) {
      console.error('[META-EXCHANGE] Database error:', upsertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao salvar credenciais' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[META-EXCHANGE] Integration saved successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        phoneNumberId,
        wabaId,
        displayPhoneNumber,
        businessName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[META-EXCHANGE] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
