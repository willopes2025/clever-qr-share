import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch profile picture from Evolution API
async function fetchProfilePicture(
  evolutionApiUrl: string, 
  evolutionApiKey: string, 
  instanceName: string, 
  phone: string
): Promise<string | null> {
  try {
    console.log(`[PROFILE-PIC] Fetching profile for ${phone} on instance ${instanceName}`);
    
    const response = await fetch(
      `${evolutionApiUrl}/chat/fetchProfile/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({ number: phone }),
      }
    );

    if (!response.ok) {
      console.log(`[PROFILE-PIC] Failed to fetch profile: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[PROFILE-PIC] Response:`, JSON.stringify(data));
    
    // Evolution API may return different structures
    const profilePictureUrl = data.profilePictureUrl || data.picture || data.imgUrl || data.profilePicUrl;
    
    if (profilePictureUrl) {
      console.log(`[PROFILE-PIC] Found profile picture URL for ${phone}`);
      return profilePictureUrl;
    }
    
    console.log(`[PROFILE-PIC] No profile picture found for ${phone}`);
    return null;
  } catch (error) {
    console.error(`[PROFILE-PIC] Error fetching profile:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { instanceName, phone, contactId, updateContact } = await req.json();

    if (!instanceName || !phone) {
      return new Response(JSON.stringify({ error: 'instanceName and phone are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean phone number (remove any non-digits)
    const cleanPhone = phone.replace(/\D/g, '');
    
    const profilePictureUrl = await fetchProfilePicture(evolutionApiUrl, evolutionApiKey, instanceName, cleanPhone);

    // If updateContact is true and we have a contactId, update the contact's avatar_url
    if (updateContact && contactId && profilePictureUrl) {
      const { error: updateError } = await supabase
        .from('contacts')
        .update({ avatar_url: profilePictureUrl })
        .eq('id', contactId);
      
      if (updateError) {
        console.error(`[PROFILE-PIC] Error updating contact avatar:`, updateError);
      } else {
        console.log(`[PROFILE-PIC] Updated avatar_url for contact ${contactId}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      profilePictureUrl 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[PROFILE-PIC] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
