import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract email from biography text
function extractEmail(text: string | null): string | null {
  if (!text) return null;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}

// Extract phone from biography or wa.me URL
function extractPhone(text: string | null, url: string | null): string | null {
  // Try wa.me links first (most reliable)
  if (url) {
    const waMatch = url.match(/wa\.me\/(\d+)/i);
    if (waMatch) return waMatch[1];
    
    // Also check for api.whatsapp.com format
    const apiWaMatch = url.match(/api\.whatsapp\.com\/send\?phone=(\d+)/i);
    if (apiWaMatch) return apiWaMatch[1];
  }
  
  if (!text) return null;
  
  // Brazilian phone patterns
  const phonePatterns = [
    /\+55\s*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/g,  // +55 (XX) XXXXX-XXXX
    /whatsapp[:\s]*\(?\d{2}\)?\s*9?\d{4}[-.\s]?\d{4}/gi,  // WhatsApp: (XX) 9XXXX-XXXX
    /\(?\d{2}\)?\s*9\d{4}[-.\s]?\d{4}/g,  // (XX) 9XXXX-XXXX (mobile)
    /\d{2}\s*9\d{8}/g  // XX9XXXXXXXX
  ];
  
  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      // Clean and return only digits
      const digits = match[0].replace(/\D/g, '');
      // Ensure it's a valid Brazilian phone (10-13 digits)
      if (digits.length >= 10 && digits.length <= 13) {
        return digits;
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { profileIds } = await req.json();

    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Informe ao menos um perfil para enriquecer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 50 profiles per request
    const limitedIds = profileIds.slice(0, 50);
    
    console.log(`Enriching ${limitedIds.length} profiles for user: ${user.id}`);

    // Fetch the profiles to get usernames
    const { data: profiles, error: fetchError } = await supabase
      .from('instagram_scrape_results')
      .select('id, username')
      .in('id', limitedIds)
      .eq('user_id', user.id);

    if (fetchError || !profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Perfis não encontrados' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token da Apify não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare URLs for Apify
    const directUrls = profiles.map(p => `https://www.instagram.com/${p.username}/`);
    
    console.log(`Calling Apify for ${directUrls.length} profile URLs`);

    // Call Apify Instagram Scraper for profile details
    const apifyInput = {
      directUrls,
      resultsType: "details",
      resultsLimit: profiles.length,
      addParentData: false
    };

    console.log('Apify input:', JSON.stringify(apifyInput));

    const apifyResponse = await fetch(
      'https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=' + apifyToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyInput)
      }
    );

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('Apify error:', errorText);
      throw new Error(`Erro na API Apify: ${apifyResponse.status}`);
    }

    const apifyData: any[] = await apifyResponse.json();
    console.log(`Apify returned ${apifyData.length} enriched profiles`);

    // Debug: log first result structure
    if (apifyData.length > 0) {
      console.log('Sample Apify response (first item):', JSON.stringify(apifyData[0], null, 2));
    }

    const enrichedProfiles: any[] = [];
    const now = new Date().toISOString();

    // Create a map of username to profile id
    const usernameToId = new Map(profiles.map(p => [p.username.toLowerCase(), p.id]));

    // Update each profile with enriched data
    for (const item of apifyData) {
      // Handle different username field names
      const username = (item.username || item.ownerUsername || '')?.toLowerCase();
      const profileId = usernameToId.get(username);
      
      if (!profileId) {
        console.log(`Profile not found for username: ${username}`, 'Available keys:', Object.keys(item));
        continue;
      }

      // Get biography and external URL for extraction
      const biography = item.biography || item.bio || null;
      const externalUrl = item.externalUrl || item.external_url || item.website || null;

      // Extract email - API data first, then bio extraction
      const emailFromApi = item.publicEmail || item.email || item.businessEmail || item.business_email || null;
      const emailFromBio = extractEmail(biography);
      const email = emailFromApi || emailFromBio;

      // Extract phone - API data first, then bio/URL extraction
      const phoneFromApi = item.publicPhoneNumber || item.contactPhoneNumber || item.phone || item.businessPhoneNumber || item.business_phone_number || null;
      const phoneFromBioOrUrl = extractPhone(biography, externalUrl);
      let phone = phoneFromApi || phoneFromBioOrUrl;

      // Normalize Brazilian phone - add country code 55 if missing
      if (phone) {
        const digits = phone.replace(/\D/g, '');
        // If 10-11 digits (Brazilian national format without DDI), add 55
        if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
          phone = '55' + digits;
        } else {
          phone = digits;
        }
      }

      console.log(`Contact extraction for ${username}: email=${email} (api=${emailFromApi}, bio=${emailFromBio}), phone=${phone} (api=${phoneFromApi}, extracted=${phoneFromBioOrUrl})`);

      const updateData = {
        full_name: item.fullName || item.full_name || null,
        biography: biography,
        profile_pic_url: item.profilePicUrl || item.profilePicUrlHD || item.profile_pic_url || null,
        followers_count: item.followersCount ?? item.followers_count ?? 0,
        following_count: item.followsCount ?? item.followingCount ?? item.following_count ?? 0,
        posts_count: item.postsCount ?? item.posts_count ?? 0,
        is_business_account: item.isBusinessAccount ?? item.is_business_account ?? false,
        is_verified: item.isVerified ?? item.verified ?? item.is_verified ?? false,
        business_category: item.businessCategoryName || item.business_category || item.categoryName || null,
        external_url: externalUrl,
        email: email,
        phone: phone,
        enriched_at: now
      };

      console.log(`Updating profile ${profileId} with:`, JSON.stringify(updateData));

      const { data: updated, error: updateError } = await supabase
        .from('instagram_scrape_results')
        .update(updateData)
        .eq('id', profileId)
        .eq('user_id', user.id)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error('Error updating profile:', profileId, updateError);
      } else if (updated) {
        enrichedProfiles.push(updated);
        console.log(`Successfully updated profile: ${username}`);
      } else {
        console.log(`No rows updated for profile: ${profileId}`);
      }
    }

    console.log(`Enriched ${enrichedProfiles.length} profiles successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        data: enrichedProfiles,
        total: enrichedProfiles.length,
        requested: limitedIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Instagram enricher error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
