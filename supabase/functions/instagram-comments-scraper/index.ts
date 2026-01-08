import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyCommentResult {
  id: string;
  text: string;
  ownerUsername: string;
  ownerFullName?: string;
  ownerProfilePicUrl?: string;
  ownerIsVerified?: boolean;
  likesCount?: number;
  timestamp?: string;
  repliesCount?: number;
  replies?: ApifyCommentResult[];
  inputUrl?: string;
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

    const { postUrls, resultsLimit = 100, includeReplies = true } = await req.json();

    if (!postUrls || !Array.isArray(postUrls) || postUrls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Informe ao menos uma URL de post' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 5 URLs per request and max 500 comments per post
    const limitedUrls = postUrls.slice(0, 5).map((u: string) => u.trim()).filter((u: string) => u.length > 0);
    const commentsLimit = Math.min(Math.max(1, resultsLimit), 500);
    
    console.log(`Scraping comments from ${limitedUrls.length} posts, limit: ${commentsLimit}, user: ${user.id}`);

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token da Apify não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for recently scraped results (last 24h) with same URLs
    const { data: existingResults } = await supabase
      .from('instagram_comments')
      .select('*')
      .eq('user_id', user.id)
      .in('post_url', limitedUrls)
      .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // If we have cached results for all URLs, return them
    if (existingResults && existingResults.length > 0) {
      const cachedUrls = new Set(existingResults.map(r => r.post_url));
      const allCached = limitedUrls.every(url => cachedUrls.has(url));
      
      if (allCached) {
        console.log(`Returning ${existingResults.length} cached comments`);
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
    }

    console.log(`Calling Apify for ${limitedUrls.length} posts`);
    
    // Prepare input for Apify actor - apify/instagram-comment-scraper
    const apifyInput = {
      directUrls: limitedUrls,
      resultsLimit: commentsLimit,
      includeNestedComments: includeReplies
    };

    console.log('Apify input:', JSON.stringify(apifyInput));

    // Call Apify Instagram Comment Scraper
    const apifyResponse = await fetch(
      'https://api.apify.com/v2/acts/apify~instagram-comment-scraper/run-sync-get-dataset-items?token=' + apifyToken,
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

    const apifyData: ApifyCommentResult[] = await apifyResponse.json();
    console.log(`Apify returned ${apifyData.length} comments`);

    const scrapedComments: any[] = [];

    // Process and save comments
    const processComment = async (item: ApifyCommentResult, postUrl: string, isReply: boolean = false, parentId: string | null = null) => {
      // Extract post ID from URL
      const postIdMatch = postUrl.match(/\/p\/([^\/]+)/);
      const postId = postIdMatch ? postIdMatch[1] : null;

      const commentData = {
        user_id: user.id,
        post_url: postUrl,
        post_id: postId,
        comment_id: item.id || `${Date.now()}-${Math.random()}`,
        comment_text: item.text || '',
        commenter_username: item.ownerUsername || 'unknown',
        commenter_full_name: item.ownerFullName || null,
        commenter_profile_pic: item.ownerProfilePicUrl || null,
        commenter_is_verified: item.ownerIsVerified || false,
        likes_count: item.likesCount || 0,
        timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : null,
        is_reply: isReply,
        parent_comment_id: parentId,
        raw_data: item,
        scraped_at: new Date().toISOString()
      };

      const { data: inserted, error: insertError } = await supabase
        .from('instagram_comments')
        .upsert(commentData, { onConflict: 'user_id,post_url,comment_id' })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting comment:', insertError);
      } else if (inserted) {
        scrapedComments.push(inserted);
      }

      // Process replies if present
      if (item.replies && item.replies.length > 0) {
        for (const reply of item.replies) {
          await processComment(reply, postUrl, true, item.id);
        }
      }
    };

    // Process all comments
    for (const item of apifyData) {
      const postUrl = item.inputUrl || limitedUrls[0];
      await processComment(item, postUrl);
    }

    console.log(`Saved ${scrapedComments.length} comments`);

    return new Response(
      JSON.stringify({
        success: true,
        data: scrapedComments,
        total: scrapedComments.length,
        fromCache: 0,
        newlyScraped: scrapedComments.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Instagram comments scraper error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
