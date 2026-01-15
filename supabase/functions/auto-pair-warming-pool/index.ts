import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PAIRS_PER_INSTANCE = 5;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[AUTO-PAIR] Starting automatic pairing process...');

    // Buscar todas as entradas ativas no pool com status da instância
    const { data: entries, error: entriesError } = await supabase
      .from('warming_pool')
      .select(`
        *,
        instance:whatsapp_instances(id, instance_name, status)
      `)
      .eq('is_active', true);

    if (entriesError) {
      throw new Error(`Error fetching pool entries: ${entriesError.message}`);
    }

    if (!entries || entries.length === 0) {
      console.log('[AUTO-PAIR] No active pool entries found');
      return new Response(JSON.stringify({ message: 'No active pool entries' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filtrar apenas instâncias conectadas
    const connectedEntries = entries.filter(e => e.instance?.status === 'connected');
    console.log(`[AUTO-PAIR] Found ${connectedEntries.length} connected entries out of ${entries.length} total`);

    if (connectedEntries.length < 2) {
      console.log('[AUTO-PAIR] Not enough connected entries to create pairs');
      return new Response(JSON.stringify({ message: 'Not enough connected entries' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pairsCreated: { entry_a: string; entry_b: string }[] = [];

    // Para cada entrada, verificar se precisa de mais pares
    for (const entry of connectedEntries) {
      // Contar pares atuais desta entrada
      const { count: currentPairsCount } = await supabase
        .from('warming_pool_pairs')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .or(`pool_entry_a_id.eq.${entry.id},pool_entry_b_id.eq.${entry.id}`);

      const pairsCount = currentPairsCount || 0;
      const neededPairs = MAX_PAIRS_PER_INSTANCE - pairsCount;

      console.log(`[AUTO-PAIR] Entry ${entry.id} (${entry.instance?.instance_name}): has ${pairsCount} pairs, needs ${neededPairs}`);

      if (neededPairs <= 0) {
        continue;
      }

      // Buscar candidatos (outras instâncias de OUTROS usuários)
      const candidates = connectedEntries.filter(c => 
        c.user_id !== entry.user_id && // Deve ser de outro usuário
        c.id !== entry.id // Não pode ser a mesma entrada
      );

      console.log(`[AUTO-PAIR] Found ${candidates.length} candidates for entry ${entry.id}`);

      // Criar pares necessários
      let pairsAdded = 0;
      for (const candidate of candidates) {
        if (pairsAdded >= neededPairs) break;

        // Ordenar IDs para garantir unicidade (constraint unique_pair exige a_id < b_id)
        const [aId, bId] = [entry.id, candidate.id].sort();

        // Verificar se o par já existe
        const { data: existingPair } = await supabase
          .from('warming_pool_pairs')
          .select('id')
          .eq('pool_entry_a_id', aId)
          .eq('pool_entry_b_id', bId)
          .single();

        if (existingPair) {
          console.log(`[AUTO-PAIR] Pair already exists: ${aId} <-> ${bId}`);
          continue;
        }

        // Criar o par
        const { error: insertError } = await supabase
          .from('warming_pool_pairs')
          .insert({
            pool_entry_a_id: aId,
            pool_entry_b_id: bId,
            is_active: true,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
          });

        if (insertError) {
          console.error(`[AUTO-PAIR] Error creating pair: ${insertError.message}`);
          continue;
        }

        console.log(`[AUTO-PAIR] Created pair: ${aId} <-> ${bId}`);
        pairsCreated.push({ entry_a: aId, entry_b: bId });
        pairsAdded++;

        // Atualizar contador de pares feitos
        await supabase
          .from('warming_pool')
          .update({ 
            total_pairs_made: (entry.total_pairs_made || 0) + 1,
            last_paired_at: new Date().toISOString()
          })
          .eq('id', entry.id);

        await supabase
          .from('warming_pool')
          .update({ 
            total_pairs_made: (candidate.total_pairs_made || 0) + 1,
            last_paired_at: new Date().toISOString()
          })
          .eq('id', candidate.id);
      }
    }

    console.log(`[AUTO-PAIR] Process complete. Created ${pairsCreated.length} new pairs`);

    return new Response(JSON.stringify({ 
      success: true, 
      pairsCreated: pairsCreated.length,
      pairs: pairsCreated 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[AUTO-PAIR] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
