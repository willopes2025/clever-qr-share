import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstagramProfile {
  username: string;
  fullName?: string;
  biography?: string;
  profilePicUrl?: string;
  profilePicUrlHD?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  isBusinessAccount?: boolean;
  isVerified?: boolean;
  businessCategoryName?: string;
  externalUrl?: string;
  email?: string;
  phone?: string;
}

// Extract email and phone from biography using regex
function extractContactFromBio(bio: string): { email?: string; phone?: string } {
  const result: { email?: string; phone?: string } = {};
  
  if (!bio) return result;
  
  // Email regex
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = bio.match(emailRegex);
  if (emails && emails.length > 0) {
    result.email = emails[0];
  }
  
  // Brazilian phone regex (various formats)
  const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
  const phones = bio.match(phoneRegex);
  if (phones && phones.length > 0) {
    // Clean phone number
    result.phone = phones[0].replace(/[^\d+]/g, '');
  }
  
  return result;
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

    const { usernames, searchType = 'profiles' } = await req.json();

    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Informe ao menos um username' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 10 usernames per request
    const limitedUsernames = usernames.slice(0, 10);
    
    console.log(`Scraping ${limitedUsernames.length} Instagram profiles for user ${user.id}`);

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token da Apify não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for recently scraped profiles (last 24h)
    const { data: existingProfiles } = await supabase
      .from('instagram_scrape_results')
      .select('*')
      .eq('user_id', user.id)
      .in('username', limitedUsernames.map((u: string) => u.toLowerCase().replace('@', '')))
      .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const existingUsernames = new Set(existingProfiles?.map(p => p.username.toLowerCase()) || []);
    const newUsernames = limitedUsernames.filter((u: string) => 
      !existingUsernames.has(u.toLowerCase().replace('@', ''))
    );

    let scrapedProfiles: any[] = existingProfiles || [];

    // Only call Apify for new usernames
    if (newUsernames.length > 0) {
      console.log(`Calling Apify for ${newUsernames.length} new profiles`);
      
      // Prepare input for Apify actor
      const directUrls = newUsernames.map((u: string) => {
        const clean = u.replace('@', '').trim();
        return `https://www.instagram.com/${clean}/`;
      });

      const apifyInput = {
        directUrls,
        resultsType: 'details',
        resultsLimit: newUsernames.length,
        searchType: 'user',
        searchLimit: 1
      };

      // Call Apify Instagram Scraper
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

      const apifyData: InstagramProfile[] = await apifyResponse.json();
      console.log(`Apify returned ${apifyData.length} profiles`);

      // Process and save new profiles
      for (const profile of apifyData) {
        const contactInfo = extractContactFromBio(profile.biography || '');
        
        const profileData = {
          user_id: user.id,
          username: profile.username?.toLowerCase() || '',
          full_name: profile.fullName || null,
          biography: profile.biography || null,
          profile_pic_url: profile.profilePicUrlHD || profile.profilePicUrl || null,
          followers_count: profile.followersCount || 0,
          following_count: profile.followsCount || 0,
          posts_count: profile.postsCount || 0,
          is_business_account: profile.isBusinessAccount || false,
          is_verified: profile.isVerified || false,
          business_category: profile.businessCategoryName || null,
          external_url: profile.externalUrl || null,
          email: profile.email || contactInfo.email || null,
          phone: profile.phone || contactInfo.phone || null,
          raw_data: profile,
          scraped_at: new Date().toISOString()
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
    }

    console.log(`Returning ${scrapedProfiles.length} profiles`);

    return new Response(
      JSON.stringify({
        success: true,
        data: scrapedProfiles,
        total: scrapedProfiles.length,
        fromCache: existingProfiles?.length || 0,
        newlyScraped: newUsernames.length
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