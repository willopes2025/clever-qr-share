## Diagnóstico

Verifiquei a configuração atual de instâncias da organização **Aliança Empresas** (`4533b774…`):

| Membro | Restrição? | Instância atribuída |
|---|---|---|
| cristiane.demarque | ✅ | Aquecimento Cristiane |
| francielle.siller | ✅ | Aquecimento Francielle Siller |
| joseluiz.dias | ✅ | Aquecimento José Luiz |
| karoline.cruz | ✅ | Karoline Aquecimento |
| tatiana.souza | ✅ | Aquecimento Tatiana |
| maristher (admin) | ❌ | (vê tudo) |
| supervisor (admin) | ❌ | (vê tudo) |

**A configuração está salva corretamente no banco.** Cada membro tem `team_member_instances` populado com sua instância, e `member_has_instance_restriction` retorna `true` para eles.

### Causa real do problema

O RLS de `conversations` usa a função `can_access_conversation_channel`. Quando uma conversa **não tem nem `instance_id` nem `meta_phone_number_id`**, a função retorna `true` para **qualquer membro da organização**, ignorando totalmente a restrição configurada:

```sql
IF _instance_id IS NULL AND _meta_phone_number_id IS NULL THEN
  RETURN v_in_org;  -- 🐛 brecha
END IF;
```

Encontrei **64 conversas** órfãs (sem `instance_id`) nessa organização, todas pertencentes à `francielle.siller` (provider `evolution`, criadas em 11/05 e 18/05). Como cada membro restrito da organização as enxerga, dá a impressão de que "voltaram a ver tudo do grupo".

## Correção

### 1. Migration: corrigir `can_access_conversation_channel`

Quando o membro **tem restrição** de instância ou meta, conversas sem canal só devem ser visíveis ao próprio dono (`_conversation_user_id = _user_id`). Para membros sem restrição (admins/owners) o comportamento atual se mantém.

```sql
-- Pseudo-mudança no final da função:
IF _instance_id IS NULL AND _meta_phone_number_id IS NULL THEN
  IF v_inst_restricted OR v_meta_restricted THEN
    RETURN _conversation_user_id = _user_id;
  END IF;
  RETURN v_in_org;
END IF;
```

### 2. Backfill das 64 conversas órfãs

Preencher `instance_id = '494c466d-3aba-4eff-8381-4acb20c74dad'` (Aquecimento Francielle Siller) nas conversas da francielle que estão com `instance_id IS NULL` e `provider = 'evolution'`. Isso garante:
- Higiene dos dados (conversas Evolution sempre referenciam uma instância).
- Que essas conversas continuem visíveis para a francielle pelo caminho "instance restrito" e fiquem ocultas para outros membros restritos.

### 3. Verificação final

Após as duas migrations, contar quantas conversas a tatiana (e os demais membros restritos) consegue ver — deve cair de ~64 conversas extras para zero.

## Detalhes técnicos

- Função afetada: `public.can_access_conversation_channel(uuid, uuid, uuid, text)` — `SECURITY DEFINER`, sem alteração de assinatura.
- Não há mudança em RLS policy nem em hooks/UI; a UI de configuração de instâncias já funciona corretamente.
- O backfill é seguro: limita a `user_id = francielle` + `provider = 'evolution'` + `instance_id IS NULL`.
- Não afeta admins (supervisor, maristher) — eles continuam vendo todas as conversas pelo caminho `v_in_org`.
