import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const APP_ID = '25248752291487782';
const GRAPH_API_VERSION = 'v24.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'Não autorizado');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return errorResponse(401, 'Token inválido');
    }

    const userId = claimsData.claims.sub as string;

    const { code, phone_number_id: sessionPhoneNumberId, waba_id: sessionWabaId, business_id: sessionBusinessId } = await req.json();
    
    if (!code) {
      return errorResponse(400, 'Código de autorização não fornecido');
    }

    const appSecret = Deno.env.get('META_WHATSAPP_APP_SECRET');
    if (!appSecret) {
      console.error('[META-EXCHANGE] META_WHATSAPP_APP_SECRET not configured');
      return errorResponse(500, 'App Secret não configurado');
    }

    // ── Step 1: Exchange code for access token ──
    console.log('[META-EXCHANGE] Exchanging code for access token...');

    const tokenUrl = `${GRAPH_BASE}/oauth/access_token?client_id=${APP_ID}&client_secret=${appSecret}&code=${code}`;
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[META-EXCHANGE] Token exchange error:', tokenData.error);
      return errorResponse(400, tokenData.error.message || 'Erro ao trocar código por token');
    }

    const accessToken = tokenData.access_token;
    console.log('[META-EXCHANGE] Access token obtained successfully');

    // ── Step 2: Resolve WABA ID ──
    // Priority: session data from message event > debug_token > fallback search
    let wabaId = sessionWabaId || null;
    let businessId = sessionBusinessId || null;

    if (!wabaId) {
      console.log('[META-EXCHANGE] No WABA from session, using debug_token...');
      const appAccessToken = `${APP_ID}|${appSecret}`;
      const debugResponse = await fetch(`${GRAPH_BASE}/debug_token?input_token=${accessToken}&access_token=${appAccessToken}`);
      const debugData = await debugResponse.json();
      
      console.log('[META-EXCHANGE] Debug token response:', JSON.stringify(debugData, null, 2));

      if (debugData.data?.granular_scopes) {
        for (const scopeName of ['whatsapp_business_management', 'whatsapp_business_messaging']) {
          const scope = debugData.data.granular_scopes.find((s: any) => s.scope === scopeName);
          if (scope?.target_ids?.length > 0) {
            wabaId = scope.target_ids[0];
            console.log(`[META-EXCHANGE] Found WABA from ${scopeName}:`, wabaId);
            break;
          }
        }
      }
    }

    // Fallback: search via /me/businesses
    if (!wabaId) {
      console.log('[META-EXCHANGE] Trying /me/businesses fallback...');
      const bizResponse = await fetch(`${GRAPH_BASE}/me/businesses?fields=id,name&access_token=${accessToken}`);
      const bizData = await bizResponse.json();
      
      for (const biz of bizData.data || []) {
        const wabaSearchResponse = await fetch(`${GRAPH_BASE}/${biz.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`);
        const wabaSearchData = await wabaSearchResponse.json();
        if (wabaSearchData.data?.length > 0) {
          wabaId = wabaSearchData.data[0].id;
          businessId = biz.id;
          break;
        }
      }
    }

    if (!wabaId) {
      return errorResponse(400, 'Não foi possível encontrar a conta WhatsApp Business. Verifique se completou o processo.');
    }

    console.log('[META-EXCHANGE] Using WABA ID:', wabaId);

    // ── Step 3: Get phone numbers from WABA ──
    // If we have phone_number_id from session, we can use it directly
    // But we still fetch all numbers to persist them
    const phoneUrl = `${GRAPH_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status,messaging_limit_tier,code_verification_status&access_token=${accessToken}`;
    const phoneResponse = await fetch(phoneUrl);
    const phoneData = await phoneResponse.json();
    
    console.log('[META-EXCHANGE] Phone numbers response:', JSON.stringify(phoneData, null, 2));

    interface PhoneInfo {
      id: string;
      display_phone_number: string;
      verified_name: string;
      quality_rating?: string;
      status?: string;
      messaging_limit_tier?: string;
      code_verification_status?: string;
    }

    let allPhoneNumbers: PhoneInfo[] = [];

    if (phoneData.data?.length > 0) {
      allPhoneNumbers = phoneData.data.map((phone: any) => ({
        id: phone.id,
        display_phone_number: phone.display_phone_number,
        verified_name: phone.verified_name,
        quality_rating: phone.quality_rating,
        status: phone.status,
        messaging_limit_tier: phone.messaging_limit_tier,
        code_verification_status: phone.code_verification_status,
      }));
    }

    // If session had a specific phone_number_id but we didn't find it in the WABA listing,
    // fetch it directly
    if (sessionPhoneNumberId && !allPhoneNumbers.find(p => p.id === sessionPhoneNumberId)) {
      console.log(`[META-EXCHANGE] Fetching session phone ${sessionPhoneNumberId} directly...`);
      const directPhoneResponse = await fetch(
        `${GRAPH_BASE}/${sessionPhoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,status,messaging_limit_tier&access_token=${accessToken}`
      );
      const directPhone = await directPhoneResponse.json();
      if (directPhone.id) {
        allPhoneNumbers.push({
          id: directPhone.id,
          display_phone_number: directPhone.display_phone_number,
          verified_name: directPhone.verified_name,
          quality_rating: directPhone.quality_rating,
          status: directPhone.status,
          messaging_limit_tier: directPhone.messaging_limit_tier,
        });
      }
    }

    if (allPhoneNumbers.length === 0) {
      return errorResponse(400, 'Nenhum número de telefone encontrado na conta WhatsApp Business.');
    }

    // ── Step 4: Register each phone number ──
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    
    console.log(`[META-EXCHANGE] Processing ${allPhoneNumbers.length} phone numbers...`);

    for (const phone of allPhoneNumbers) {
      // 4a: Register the phone number (required to move from PENDING to CONNECTED)
      console.log(`[META-EXCHANGE] Registering phone ${phone.id} (current status: ${phone.status})...`);
      
      try {
        const registerResponse = await fetch(`${GRAPH_BASE}/${phone.id}/register`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            pin: '123456',
          }),
        });
        const registerResult = await registerResponse.json();
        console.log(`[META-EXCHANGE] Register result for ${phone.id}:`, JSON.stringify(registerResult));
        
        if (registerResult.success) {
          console.log(`[META-EXCHANGE] ✅ Phone ${phone.id} registered successfully!`);
          phone.status = 'CONNECTED';
        } else if (registerResult.error) {
          // Error code 100 with subcode 2388093 means "already registered"
          if (registerResult.error.code === 100 || registerResult.error.message?.includes('already registered')) {
            console.log(`[META-EXCHANGE] Phone ${phone.id} already registered`);
            phone.status = 'CONNECTED';
          } else {
            console.warn(`[META-EXCHANGE] Registration warning for ${phone.id}:`, registerResult.error.message);
          }
        }
      } catch (regError) {
        console.error(`[META-EXCHANGE] Registration error for ${phone.id}:`, regError);
      }

      // 4b: Fetch updated status after registration
      try {
        const statusResponse = await fetch(
          `${GRAPH_BASE}/${phone.id}?fields=status,quality_rating,messaging_limit_tier&access_token=${accessToken}`
        );
        const statusData = await statusResponse.json();
        console.log(`[META-EXCHANGE] Updated status for ${phone.id}:`, JSON.stringify(statusData));
        
        if (statusData.status) phone.status = statusData.status;
        if (statusData.quality_rating) phone.quality_rating = statusData.quality_rating;
        if (statusData.messaging_limit_tier) phone.messaging_limit_tier = statusData.messaging_limit_tier;
      } catch (statusError) {
        console.error(`[META-EXCHANGE] Status fetch error for ${phone.id}:`, statusError);
      }

      // 4c: Save to database with real status
      const dbStatus = mapMetaStatus(phone.status);
      
      const { error: numberError } = await adminClient
        .from('meta_whatsapp_numbers')
        .upsert({
          user_id: userId,
          phone_number_id: phone.id,
          display_name: phone.verified_name || null,
          phone_number: phone.display_phone_number || null,
          waba_id: wabaId,
          business_account_id: businessId || null,
          quality_rating: phone.quality_rating || null,
          messaging_limit: phone.messaging_limit_tier || null,
          status: dbStatus,
          is_active: true,
          connected_at: new Date().toISOString(),
        }, { onConflict: 'phone_number_id' });

      if (numberError) {
        console.error(`[META-EXCHANGE] DB error for ${phone.id}:`, numberError);
      } else {
        console.log(`[META-EXCHANGE] ✅ Saved ${phone.display_phone_number} (${phone.id}) status=${dbStatus}`);
      }
    }

    // ── Step 5: Subscribe WABA to our app's webhooks ──
    try {
      console.log(`[META-EXCHANGE] Subscribing WABA ${wabaId} to app webhooks...`);
      const subscribeResponse = await fetch(`${GRAPH_BASE}/${wabaId}/subscribed_apps`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      const subscribeResult = await subscribeResponse.json();
      console.log(`[META-EXCHANGE] Subscribe result:`, JSON.stringify(subscribeResult));
      
      if (!subscribeResult.success) {
        console.warn(`[META-EXCHANGE] Webhook subscription warning:`, subscribeResult.error?.message);
      } else {
        console.log(`[META-EXCHANGE] ✅ WABA subscribed to webhooks`);
      }
    } catch (subError) {
      console.error(`[META-EXCHANGE] Subscribe error:`, subError);
    }

    // ── Step 6: Save integration credentials ──
    const primaryPhone = sessionPhoneNumberId 
      ? allPhoneNumbers.find(p => p.id === sessionPhoneNumberId) || allPhoneNumbers[0]
      : allPhoneNumbers[0];
    
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
      console.error('[META-EXCHANGE] Integration save error:', upsertError);
      return errorResponse(500, 'Erro ao salvar credenciais');
    }

    console.log('[META-EXCHANGE] ✅ Integration saved successfully!');

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
          status: p.status,
          qualityRating: p.quality_rating,
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

// Helper: Map Meta API status to our DB status
function mapMetaStatus(metaStatus?: string): string {
  if (!metaStatus) return 'pending';
  
  const statusMap: Record<string, string> = {
    'CONNECTED': 'connected',
    'READY': 'connected',
    'VERIFIED': 'connected',
    'PENDING': 'pending',
    'UNVERIFIED': 'pending',
    'DISCONNECTED': 'restricted',
    'BANNED': 'restricted',
    'FLAGGED': 'restricted',
    'RATE_LIMITED': 'restricted',
    'RESTRICTED': 'restricted',
  };
  
  return statusMap[metaStatus.toUpperCase()] || 'pending';
}

// Helper: Error response
function errorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
