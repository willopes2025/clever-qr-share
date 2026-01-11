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

// Extract social media links from biography and external URL
function extractSocialLinks(text: string | null, url: string | null): Record<string, string> {
  const links: Record<string, string> = {};
  const combinedText = [text || '', url || ''].join(' ');
  
  // Social media patterns
  const socialPatterns: Record<string, RegExp[]> = {
    twitter: [
      /(?:twitter\.com|x\.com)\/(@?[\w]+)/gi,
      /@(\w+)(?:\s+(?:twitter|x\b))/gi
    ],
    tiktok: [
      /tiktok\.com\/@?([\w.]+)/gi,
      /@([\w.]+)(?:\s+tiktok)/gi
    ],
    youtube: [
      /youtube\.com\/(?:channel\/|c\/|@)([\w-]+)/gi,
      /youtu\.be\/([\w-]+)/gi
    ],
    telegram: [
      /t\.me\/([\w]+)/gi,
      /telegram\.me\/([\w]+)/gi
    ],
    linkedin: [
      /linkedin\.com\/in\/([\w-]+)/gi,
      /linkedin\.com\/company\/([\w-]+)/gi
    ],
    facebook: [
      /facebook\.com\/([\w.]+)/gi,
      /fb\.com\/([\w.]+)/gi
    ],
    threads: [
      /threads\.net\/@?([\w.]+)/gi
    ]
  };

  for (const [platform, patterns] of Object.entries(socialPatterns)) {
    for (const pattern of patterns) {
      const match = pattern.exec(combinedText);
      if (match && match[1]) {
        links[platform] = match[1];
        break;
      }
    }
  }

  return Object.keys(links).length > 0 ? links : {};
}

// Calculate engagement score
function calculateEngagementScore(
  followersCount: number,
  postsCount: number,
  avgLikes?: number,
  avgComments?: number
): number | null {
  if (!followersCount || followersCount === 0) return null;
  
  // If we have average likes/comments from posts, use them
  if (avgLikes !== undefined && avgComments !== undefined) {
    const engagement = ((avgLikes + avgComments) / followersCount) * 100;
    return Math.min(Math.round(engagement * 100) / 100, 100); // Cap at 100%
  }
  
  return null;
}

// Detect suspicious accounts (potential bots/fakes)
function detectSuspiciousAccount(profile: {
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isPrivate?: boolean;
  biography?: string | null;
  fullName?: string | null;
  profilePicUrl?: string | null;
}): { isSuspicious: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  // High following/followers ratio (likely bot)
  if (profile.followingCount > 0 && profile.followersCount > 0) {
    const ratio = profile.followingCount / profile.followersCount;
    if (ratio > 10) {
      reasons.push('Ratio seguindo/seguidores muito alto (>10x)');
    }
  }
  
  // Very few posts but many followers (potential fake)
  if (profile.followersCount > 1000 && profile.postsCount < 5) {
    reasons.push('Muitos seguidores mas poucos posts');
  }
  
  // No posts at all
  if (profile.postsCount === 0) {
    reasons.push('Nenhuma publicação');
  }
  
  // Private account with no bio (potential spam)
  if (profile.isPrivate && !profile.biography) {
    reasons.push('Conta privada sem bio');
  }
  
  // Very high follower count but no profile picture (unusual)
  if (profile.followersCount > 5000 && !profile.profilePicUrl) {
    reasons.push('Muitos seguidores sem foto de perfil');
  }
  
  // Following nobody but has followers (could be celebrity OR bot)
  if (profile.followingCount === 0 && profile.followersCount > 100) {
    reasons.push('Não segue ninguém');
  }
  
  return {
    isSuspicious: reasons.length >= 2,
    reasons
  };
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
      console.log('Sample Apify response (first item keys):', Object.keys(apifyData[0]));
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

      // Extract other social links
      const otherSocialLinks = extractSocialLinks(biography, externalUrl);

      // Get counts
      const followersCount = item.followersCount ?? item.followers_count ?? 0;
      const followingCount = item.followsCount ?? item.followingCount ?? item.following_count ?? 0;
      const postsCount = item.postsCount ?? item.posts_count ?? 0;
      const isPrivate = item.isPrivate ?? item.is_private ?? false;

      // Calculate engagement score from latest posts if available
      let engagementScore: number | null = null;
      const latestPosts = item.latestPosts || item.posts || null;
      if (latestPosts && Array.isArray(latestPosts) && latestPosts.length > 0) {
        const totalLikes = latestPosts.reduce((sum: number, post: any) => sum + (post.likesCount || post.likes || 0), 0);
        const totalComments = latestPosts.reduce((sum: number, post: any) => sum + (post.commentsCount || post.comments || 0), 0);
        const avgLikes = totalLikes / latestPosts.length;
        const avgComments = totalComments / latestPosts.length;
        engagementScore = calculateEngagementScore(followersCount, postsCount, avgLikes, avgComments);
      }

      // Detect suspicious accounts
      const suspiciousCheck = detectSuspiciousAccount({
        followersCount,
        followingCount,
        postsCount,
        isPrivate,
        biography,
        fullName: item.fullName || item.full_name || null,
        profilePicUrl: item.profilePicUrl || item.profilePicUrlHD || item.profile_pic_url || null
      });

      console.log(`Contact extraction for ${username}: email=${email}, phone=${phone}, socialLinks=${JSON.stringify(otherSocialLinks)}, engagement=${engagementScore}, suspicious=${suspiciousCheck.isSuspicious}`);

      const updateData: Record<string, any> = {
        full_name: item.fullName || item.full_name || null,
        biography: biography,
        profile_pic_url: item.profilePicUrl || item.profilePicUrlHD || item.profile_pic_url || null,
        followers_count: followersCount,
        following_count: followingCount,
        posts_count: postsCount,
        is_business_account: item.isBusinessAccount ?? item.is_business_account ?? false,
        is_verified: item.isVerified ?? item.verified ?? item.is_verified ?? false,
        business_category: item.businessCategoryName || item.business_category || item.categoryName || null,
        external_url: externalUrl,
        email: email,
        phone: phone,
        enriched_at: now,
        // New enhanced fields
        location_name: item.locationName || item.location?.name || null,
        location_id: item.locationId || item.location?.id || null,
        highlights_count: item.highlightsCount ?? item.highlights_count ?? null,
        reels_count: item.reelsCount ?? item.reels_count ?? null,
        igtv_count: item.igtvCount ?? item.igtv_count ?? null,
        fbid: item.fbid || item.facebookId || null,
        linked_facebook_page: item.linkedFacebookPage || item.connectedFbPage || null,
        other_social_links: Object.keys(otherSocialLinks).length > 0 ? otherSocialLinks : null,
        engagement_score: engagementScore,
        is_suspicious: suspiciousCheck.isSuspicious,
        suspicious_reasons: suspiciousCheck.reasons.length > 0 ? suspiciousCheck.reasons : null
      };

      // Only include latest_posts if available (and limit to 5)
      if (latestPosts && Array.isArray(latestPosts)) {
        updateData.latest_posts = latestPosts.slice(0, 5).map((post: any) => ({
          id: post.id || post.shortCode,
          shortCode: post.shortCode,
          type: post.type,
          caption: post.caption?.substring(0, 200),
          likesCount: post.likesCount || post.likes,
          commentsCount: post.commentsCount || post.comments,
          timestamp: post.timestamp,
          locationName: post.locationName
        }));
      }

      console.log(`Updating profile ${profileId} with enhanced data`);

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
