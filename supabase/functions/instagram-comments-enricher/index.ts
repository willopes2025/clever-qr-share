import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to extract email from text
function extractEmail(text: string | null): string | null {
  if (!text) return null;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches ? matches[0].toLowerCase() : null;
}

// Helper to extract phone from text or URL
function extractPhone(text: string | null, url: string | null): string | null {
  // Check WhatsApp URL first
  if (url) {
    const waMatch = url.match(/wa\.me\/(\d+)/);
    if (waMatch) return waMatch[1];
    
    const apiWaMatch = url.match(/api\.whatsapp\.com\/send\?phone=(\d+)/);
    if (apiWaMatch) return apiWaMatch[1];
  }
  
  if (!text) return null;
  
  // Common phone patterns
  const phonePatterns = [
    /(?:\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}/g,
    /\+\d{10,15}/g,
  ];
  
  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      return matches[0].replace(/\D/g, '');
    }
  }
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apifyToken = Deno.env.get('APIFY_API_TOKEN')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { commentIds } = await req.json();

    if (!commentIds || !Array.isArray(commentIds) || commentIds.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'commentIds is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Enriching ${commentIds.length} comments for user ${user.id}`);

    // Fetch comments to get unique usernames
    const { data: commentsData, error: fetchError } = await supabase
      .from('instagram_comments')
      .select('id, commenter_username')
      .in('id', commentIds)
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('Error fetching comments:', fetchError);
      throw new Error('Failed to fetch comments');
    }

    if (!commentsData || commentsData.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No comments found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get unique usernames
    const uniqueUsernames = [...new Set(commentsData.map(c => c.commenter_username))];
    console.log(`Found ${uniqueUsernames.length} unique usernames to enrich`);

    // Call Apify Instagram Scraper for profile details
    const apifyInput = {
      usernames: uniqueUsernames,
      resultsType: "details",
      resultsLimit: uniqueUsernames.length
    };

    console.log('Calling Apify with input:', JSON.stringify(apifyInput));

    const apifyResponse = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyInput)
      }
    );

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('Apify error:', errorText);
      throw new Error(`Apify API error: ${apifyResponse.status}`);
    }

    const apifyData = await apifyResponse.json();
    console.log(`Got ${apifyData.length} profile results from Apify`);

    // Create a map of username -> profile data
    const profileMap = new Map();
    for (const profile of apifyData) {
      const username = profile.username?.toLowerCase();
      if (!username) continue;

      const biography = profile.biography || null;
      const externalUrl = profile.externalUrl || profile.website || null;

      profileMap.set(username, {
        commenter_biography: biography,
        commenter_email: extractEmail(biography) || profile.publicEmail || null,
        commenter_phone: extractPhone(biography, externalUrl) || profile.publicPhoneNumber || null,
        commenter_followers_count: profile.followersCount || 0,
        commenter_following_count: profile.followsCount || 0,
        commenter_posts_count: profile.postsCount || 0,
        commenter_is_business: profile.isBusinessAccount || false,
        commenter_business_category: profile.businessCategoryName || null,
        commenter_external_url: externalUrl,
        enriched_at: new Date().toISOString()
      });
    }

    // Update all comments from the same username
    const enrichedComments = [];
    const updatePromises = [];

    for (const [username, enrichData] of profileMap) {
      updatePromises.push(
        supabase
          .from('instagram_comments')
          .update(enrichData)
          .eq('user_id', user.id)
          .ilike('commenter_username', username)
          .select()
      );
    }

    const results = await Promise.all(updatePromises);
    
    for (const result of results) {
      if (result.data) {
        enrichedComments.push(...result.data);
      }
    }

    console.log(`Updated ${enrichedComments.length} comments with enriched data`);

    return new Response(JSON.stringify({
      success: true,
      total: enrichedComments.length,
      uniqueProfiles: profileMap.size,
      data: enrichedComments
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Enricher error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
