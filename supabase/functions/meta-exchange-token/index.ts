import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const APP_ID = '25248752291487782';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { code } = await req.json();
    
    if (!code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Código de autorização não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appSecret = Deno.env.get('META_WHATSAPP_APP_SECRET');
    if (!appSecret) {
      console.error('[META-EXCHANGE] META_WHATSAPP_APP_SECRET not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'App Secret não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[META-EXCHANGE] Exchanging code for access token...');

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
    
    const appAccessToken = `${APP_ID}|${appSecret}`;
    const wabaUrl = `https://graph.facebook.com/v24.0/debug_token?input_token=${accessToken}&access_token=${appAccessToken}`;
    const debugResponse = await fetch(wabaUrl);
    const debugData = await debugResponse.json();
    
    console.log('[META-EXCHANGE] Debug token response:', JSON.stringify(debugData, null, 2));

    let wabaId: string | null = null;
    let allPhoneNumbers: Array<{ id: string; display_phone_number: string; verified_name: string; quality_rating?: string }> = [];

    // Try to get WABA from granular scopes
    if (debugData.data?.granular_scopes) {
      const wabaScope = debugData.data.granular_scopes.find(
        (scope: any) => scope.scope === 'whatsapp_business_management'
      );
      if (wabaScope?.target_ids?.length > 0) {
        wabaId = wabaScope.target_ids[0];
        console.log('[META-EXCHANGE] Found WABA ID from scopes:', wabaId);
      }
      
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

    // If we have WABA ID, get ALL phone numbers
    if (wabaId) {
      const phoneUrl = `https://graph.facebook.com/v24.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
      const phoneResponse = await fetch(phoneUrl);
      const phoneData = await phoneResponse.json();
      
      console.log('[META-EXCHANGE] Phone numbers response:', JSON.stringify(phoneData, null, 2));

      if (phoneData.data?.length > 0) {
        allPhoneNumbers = phoneData.data.map((phone: any) => ({
          id: phone.id,
          display_phone_number: phone.display_phone_number,
          verified_name: phone.verified_name,
          quality_rating: phone.quality_rating,
        }));
      }
    } else {
      // Fallback: Try to get WABA from /me/businesses endpoint
      console.log('[META-EXCHANGE] Trying /me/businesses endpoint...');
      const bizUrl = `https://graph.facebook.com/v24.0/me/businesses?fields=id,name&access_token=${accessToken}`;
      const bizResponse = await fetch(bizUrl);
      const bizData = await bizResponse.json();
      console.log('[META-EXCHANGE] Businesses response:', JSON.stringify(bizData, null, 2));
      
      if (bizData.data?.length > 0) {
        for (const biz of bizData.data) {
          const wabaSearchUrl = `https://graph.facebook.com/v24.0/${biz.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`;
          const wabaSearchResponse = await fetch(wabaSearchUrl);
          const wabaSearchData = await wabaSearchResponse.json();
          console.log(`[META-EXCHANGE] WABAs for business ${biz.id}:`, JSON.stringify(wabaSearchData, null, 2));
          
          if (wabaSearchData.data?.length > 0) {
            wabaId = wabaSearchData.data[0].id;
            const phoneUrl = `https://graph.facebook.com/v24.0/${wabaId}/phone_numbers?access_token=${accessToken}`;
            const phoneResponse = await fetch(phoneUrl);
            const phoneData = await phoneResponse.json();
            if (phoneData.data?.length > 0) {
              allPhoneNumbers = phoneData.data.map((phone: any) => ({
                id: phone.id,
                display_phone_number: phone.display_phone_number,
                verified_name: phone.verified_name,
                quality_rating: phone.quality_rating,
              }));
            }
            break;
          }
        }
      }
    }

    if (!wabaId || allPhoneNumbers.length === 0) {
      console.log('[META-EXCHANGE] No WABA or phone numbers found');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não foi possível encontrar a conta WhatsApp Business. Verifique se você completou o processo de compartilhamento.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Register and save ALL phone numbers
    console.log(`[META-EXCHANGE] Registering and saving ${allPhoneNumbers.length} phone numbers...`);
    
    for (const phone of allPhoneNumbers) {
      // Step 1: Register the phone number via Meta API (required after Embedded Signup)
      try {
        console.log(`[META-EXCHANGE] Registering phone number ${phone.id}...`);
        const registerResponse = await fetch(
          `https://graph.facebook.com/v24.0/${phone.id}/register`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              pin: '123456',
            }),
          }
        );
        const registerResult = await registerResponse.json();
        console.log(`[META-EXCHANGE] Register result for ${phone.id}:`, JSON.stringify(registerResult));
        
        if (!registerResponse.ok) {
          console.warn(`[META-EXCHANGE] Registration warning for ${phone.id}:`, registerResult.error?.message);
        }
      } catch (regError) {
        console.error(`[META-EXCHANGE] Registration error for ${phone.id}:`, regError);
      }

      // Step 2: Subscribe the WABA to our app's webhook
      // (only need to do once but it's idempotent)
      
      // Step 3: Save to database
      const { error: numberError } = await adminClient
        .from('meta_whatsapp_numbers')
        .upsert({
          user_id: userId,
          phone_number_id: phone.id,
          display_name: phone.verified_name || null,
          phone_number: phone.display_phone_number || null,
          waba_id: wabaId,
          quality_rating: phone.quality_rating || null,
          status: 'connected',
          is_active: true,
          connected_at: new Date().toISOString(),
        }, { onConflict: 'phone_number_id' });

      if (numberError) {
        console.error(`[META-EXCHANGE] Error saving phone number ${phone.id}:`, numberError);
      } else {
        console.log(`[META-EXCHANGE] Saved phone number: ${phone.display_phone_number} (${phone.id})`);
      }
    }

    // Subscribe WABA to app webhook (idempotent)
    try {
      console.log(`[META-EXCHANGE] Subscribing WABA ${wabaId} to app webhook...`);
      const subscribeResponse = await fetch(
        `https://graph.facebook.com/v24.0/${wabaId}/subscribed_apps`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const subscribeResult = await subscribeResponse.json();
      console.log(`[META-EXCHANGE] Subscribe result:`, JSON.stringify(subscribeResult));
    } catch (subError) {
      console.error(`[META-EXCHANGE] Subscribe error:`, subError);
    }

    // Save/update integrations table with access_token (use first phone as primary)
    const primaryPhone = allPhoneNumbers[0];
    
    const { error: upsertError } = await adminClient
      .from('integrations')
      .upsert({
        user_id: userId,
        provider: 'meta_whatsapp',
        credentials: {
          phone_number_id: primaryPhone.id,
          business_account_id: wabaId,
          access_token: accessToken,
          app_secret: appSecret,
          display_phone_number: primaryPhone.display_phone_number,
          business_name: primaryPhone.verified_name,
          all_phone_number_ids: allPhoneNumbers.map(p => p.id),
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
        phoneNumberId: primaryPhone.id,
        wabaId,
        displayPhoneNumber: primaryPhone.display_phone_number,
        businessName: primaryPhone.verified_name,
        allPhoneNumbers: allPhoneNumbers.map(p => ({
          phoneNumberId: p.id,
          displayPhoneNumber: p.display_phone_number,
          businessName: p.verified_name,
        })),
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
