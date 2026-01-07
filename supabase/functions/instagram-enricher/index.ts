import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyProfileResult {
  username: string;
  fullName?: string;
  biography?: string;
  externalUrl?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  isBusinessAccount?: boolean;
  businessCategoryName?: string;
  isVerified?: boolean;
  profilePicUrl?: string;
  email?: string;
  phone?: string;
  contactPhoneNumber?: string;
  publicEmail?: string;
  publicPhoneNumber?: string;
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

      // Extract email and phone with multiple fallbacks
      const email = item.publicEmail || item.email || item.businessEmail || item.business_email || null;
      const phone = item.publicPhoneNumber || item.contactPhoneNumber || item.phone || item.businessPhoneNumber || item.business_phone_number || null;

      const updateData = {
        full_name: item.fullName || item.full_name || null,
        biography: item.biography || item.bio || null,
        profile_pic_url: item.profilePicUrl || item.profilePicUrlHD || item.profile_pic_url || null,
        followers_count: item.followersCount ?? item.followers_count ?? 0,
        following_count: item.followsCount ?? item.followingCount ?? item.following_count ?? 0,
        posts_count: item.postsCount ?? item.posts_count ?? 0,
        is_business_account: item.isBusinessAccount ?? item.is_business_account ?? false,
        is_verified: item.isVerified ?? item.verified ?? item.is_verified ?? false,
        business_category: item.businessCategoryName || item.business_category || item.categoryName || null,
        external_url: item.externalUrl || item.external_url || item.website || null,
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
