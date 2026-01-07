import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyFollowerResult {
  username_scrape: string;
  type: string;
  full_name: string | null;
  id: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url: string | null;
  username: string;
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

    const { usernames, scrapeType = 'Followers', limit = 100 } = await req.json();

    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Informe ao menos um username' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate scrapeType
    if (!['Followers', 'Following'].includes(scrapeType)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo de scrape inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 5 usernames per request and max 500 results per username
    const limitedUsernames = usernames.slice(0, 5).map((u: string) => u.trim().replace('@', ''));
    const resultsLimit = Math.min(Math.max(1, limit), 500);
    
    console.log(`Scraping ${scrapeType} for ${limitedUsernames.length} profiles, limit: ${resultsLimit}, user: ${user.id}`);

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token da Apify não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for recently scraped results (last 24h) with same source and type
    const cacheKey = `${limitedUsernames.join(',')}_${scrapeType}_${resultsLimit}`;
    const { data: existingResults } = await supabase
      .from('instagram_scrape_results')
      .select('*')
      .eq('user_id', user.id)
      .in('source_username', limitedUsernames)
      .eq('scrape_type', scrapeType.toLowerCase())
      .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // If we have cached results, return them
    if (existingResults && existingResults.length > 0) {
      console.log(`Returning ${existingResults.length} cached results`);
      return new Response(
        JSON.stringify({
          success: true,
          data: existingResults,
          total: existingResults.length,
          fromCache: existingResults.length,
          newlyScraped: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Calling Apify for ${limitedUsernames.length} profiles`);
    
    // Prepare input for Apify actor - scraping_solutions/instagram-scraper-followers-following-no-cookies
    const apifyInput = {
      Account: limitedUsernames,
      resultsLimit: resultsLimit,
      dataToScrape: scrapeType
    };

    console.log('Apify input:', JSON.stringify(apifyInput));

    // Call Apify Instagram Followers/Following Scraper
    const apifyResponse = await fetch(
      'https://api.apify.com/v2/acts/scraping_solutions~instagram-scraper-followers-following-no-cookies/run-sync-get-dataset-items?token=' + apifyToken,
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

    const apifyData: ApifyFollowerResult[] = await apifyResponse.json();
    console.log(`Apify returned ${apifyData.length} results`);

    const scrapedProfiles: any[] = [];

    // Process and save results
    for (const item of apifyData) {
      const profileData = {
        user_id: user.id,
        username: item.username?.toLowerCase() || '',
        full_name: item.full_name || null,
        biography: null,
        profile_pic_url: item.profile_pic_url || null,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        is_business_account: false,
        is_verified: item.is_verified || false,
        business_category: null,
        external_url: null,
        email: null,
        phone: null,
        raw_data: item,
        scraped_at: new Date().toISOString(),
        source_username: item.username_scrape?.toLowerCase() || null,
        scrape_type: scrapeType.toLowerCase(),
        is_private: item.is_private || false
      };

      const { data: inserted, error: insertError } = await supabase
        .from('instagram_scrape_results')
        .insert(profileData)
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting profile:', insertError);
      } else if (inserted) {
        scrapedProfiles.push(inserted);
      }
    }

    console.log(`Saved ${scrapedProfiles.length} profiles`);

    return new Response(
      JSON.stringify({
        success: true,
        data: scrapedProfiles,
        total: scrapedProfiles.length,
        fromCache: 0,
        newlyScraped: scrapedProfiles.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Instagram scraper error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
