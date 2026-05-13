import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAPIDAPI_HOST = 'instagram120.p.rapidapi.com';

async function fetchFollowersOrFollowing(
  username: string,
  type: 'Followers' | 'Following',
  limit: number,
  apiKey: string
): Promise<any[]> {
  const endpoint = type === 'Followers' ? 'followers' : 'following';
  const all: any[] = [];
  let nextMaxId: string | null = null;
  let safety = 0;

  while (all.length < limit && safety < 20) {
    safety++;
    const url = new URL(`https://${RAPIDAPI_HOST}/api/instagram/${endpoint}`);
    url.searchParams.set('username', username);
    if (nextMaxId) url.searchParams.set('max_id', nextMaxId);

    const resp = await fetch(url.toString(), {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error(`RapidAPI ${endpoint} error [${resp.status}]:`, txt);
      throw new Error(`RapidAPI ${endpoint} falhou: ${resp.status}`);
    }

    const json = await resp.json();
    // Possible shapes: { users: [...] } or { data: { users: [...] } } or array
    const list: any[] =
      json?.users || json?.data?.users || json?.result || json?.data || (Array.isArray(json) ? json : []);

    if (!Array.isArray(list) || list.length === 0) break;
    all.push(...list);

    nextMaxId = json?.next_max_id || json?.data?.next_max_id || json?.pagination?.next_max_id || null;
    if (!nextMaxId) break;
  }

  return all.slice(0, limit);
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
      global: { headers: { Authorization: authHeader } },
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

    if (!['Followers', 'Following'].includes(scrapeType)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo de scrape inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const limitedUsernames: string[] = usernames.slice(0, 5).map((u: string) => u.trim().replace('@', ''));
    const resultsLimit = Math.min(Math.max(1, limit), 500);

    console.log(`[RapidAPI] Scraping ${scrapeType} for ${limitedUsernames.length} profiles, limit ${resultsLimit}, user ${user.id}`);

    const apiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'RAPIDAPI_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cache check (last 24h)
    const { data: existingResults } = await supabase
      .from('instagram_scrape_results')
      .select('*')
      .eq('user_id', user.id)
      .in('source_username', limitedUsernames)
      .eq('scrape_type', scrapeType.toLowerCase())
      .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (existingResults && existingResults.length > 0) {
      console.log(`Cache hit: ${existingResults.length} results`);
      return new Response(
        JSON.stringify({
          success: true,
          data: existingResults,
          total: existingResults.length,
          fromCache: existingResults.length,
          newlyScraped: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scrapedProfiles: any[] = [];

    for (const sourceUsername of limitedUsernames) {
      try {
        const items = await fetchFollowersOrFollowing(sourceUsername, scrapeType, resultsLimit, apiKey);
        console.log(`[${sourceUsername}] got ${items.length} ${scrapeType}`);

        for (const item of items) {
          const profileData = {
            user_id: user.id,
            username: (item.username || item.user_name || '')?.toLowerCase(),
            full_name: item.full_name || item.fullName || null,
            biography: null,
            profile_pic_url: item.profile_pic_url || item.profilePicUrl || null,
            followers_count: 0,
            following_count: 0,
            posts_count: 0,
            is_business_account: false,
            is_verified: item.is_verified ?? item.verified ?? false,
            business_category: null,
            external_url: null,
            email: null,
            phone: null,
            raw_data: item,
            scraped_at: new Date().toISOString(),
            source_username: sourceUsername.toLowerCase(),
            scrape_type: scrapeType.toLowerCase(),
            is_private: item.is_private ?? false,
          };

          if (!profileData.username) continue;

          const { data: inserted, error: insertError } = await supabase
            .from('instagram_scrape_results')
            .insert(profileData)
            .select()
            .single();

          if (insertError) {
            console.error('Insert error:', insertError.message);
          } else if (inserted) {
            scrapedProfiles.push(inserted);
          }
        }
      } catch (err) {
        console.error(`Error scraping ${sourceUsername}:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`Saved ${scrapedProfiles.length} profiles`);

    return new Response(
      JSON.stringify({
        success: true,
        data: scrapedProfiles,
        total: scrapedProfiles.length,
        fromCache: 0,
        newlyScraped: scrapedProfiles.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Instagram scraper error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno do servidor',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
