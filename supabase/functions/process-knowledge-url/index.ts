import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple HTML to text converter
const htmlToText = (html: string): string => {
  // Remove script and style tags and their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  
  // Replace common block elements with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n');
  text = text.replace(/<(br|hr)[^>]*\/?>/gi, '\n');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n\s+/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text.trim();
};

// Extract main content from HTML
const extractMainContent = (html: string): string => {
  // Try to find main content areas
  const mainPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<body[^>]*>([\s\S]*?)<\/body>/i,
  ];
  
  for (const pattern of mainPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return htmlToText(match[1]);
    }
  }
  
  return htmlToText(html);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { knowledgeItemId } = await req.json();

    if (!knowledgeItemId) {
      throw new Error('knowledgeItemId is required');
    }

    console.log(`[PROCESS-URL] Processing knowledge item ${knowledgeItemId}`);

    // Fetch the knowledge item
    const { data: item, error: fetchError } = await supabase
      .from('ai_agent_knowledge_items')
      .select('*')
      .eq('id', knowledgeItemId)
      .single();

    if (fetchError || !item) {
      console.error('[PROCESS-URL] Knowledge item not found:', fetchError);
      throw new Error('Knowledge item not found');
    }

    if (item.source_type !== 'url' || !item.website_url) {
      throw new Error('Invalid knowledge item type or missing URL');
    }

    // Update status to processing
    await supabase
      .from('ai_agent_knowledge_items')
      .update({ status: 'processing' })
      .eq('id', knowledgeItemId);

    console.log(`[PROCESS-URL] Fetching URL: ${item.website_url}`);

    // Fetch the URL
    const response = await fetch(item.website_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`[PROCESS-URL] Fetched ${html.length} bytes`);

    // Extract text content
    let textContent = extractMainContent(html);
    
    // Limit content length to avoid token limits
    const maxLength = 50000;
    if (textContent.length > maxLength) {
      textContent = textContent.substring(0, maxLength) + '...[conteúdo truncado]';
    }

    console.log(`[PROCESS-URL] Extracted ${textContent.length} characters of text`);

    // Update the knowledge item with processed content
    const { error: updateError } = await supabase
      .from('ai_agent_knowledge_items')
      .update({
        processed_content: textContent,
        status: 'completed',
        last_synced_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', knowledgeItemId);

    if (updateError) {
      console.error('[PROCESS-URL] Failed to update knowledge item:', updateError);
      throw updateError;
    }

    console.log('[PROCESS-URL] Successfully processed URL');

    return new Response(
      JSON.stringify({ 
        success: true, 
        contentLength: textContent.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PROCESS-URL] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Try to update the knowledge item with error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { knowledgeItemId } = await req.json().catch(() => ({}));
      if (knowledgeItemId) {
        await supabase
          .from('ai_agent_knowledge_items')
          .update({
            status: 'failed',
            error_message: message,
          })
          .eq('id', knowledgeItemId);
      }
    } catch (e) {
      console.error('[PROCESS-URL] Failed to update error status:', e);
    }

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
