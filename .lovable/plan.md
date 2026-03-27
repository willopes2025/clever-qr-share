

## Diagnóstico: Sistema vazio após login

### Causa Raiz Identificada

Os logs de autenticação revelam o problema principal: **o banco de dados está extremamente lento**, com requisições `/user` levando de **5 a 8 segundos** e muitas falhando com `timeout: context canceled` e status 500.

A função `_shared/auth.ts` usa `getUser(token)` que faz uma chamada de rede ao servidor de autenticação a cada invocação de Edge Function. Com o banco lento, essa chamada frequentemente dá timeout, causando:
1. Edge Functions retornam 401 ou timeout
2. O frontend não consegue carregar dados de assinatura, instâncias, equipe, etc.
3. O sistema aparece "zerado"

Os logs do `check-subscription` confirmam: `"connection closed before message completed"` - o cliente desiste antes da resposta chegar.

### Solução

**1. Trocar `getUser()` por `getClaims()` no `_shared/auth.ts`**

`getClaims(token)` valida o JWT **localmente** usando chaves de assinatura, sem depender do banco de dados. Isso elimina a dependência do banco para autenticação em Edge Functions.

```
getUser(token)   → chamada de rede ao DB (5-8s quando lento)
getClaims(token) → validação local do JWT (~1ms)
```

**2. Arquivo a modificar:** `supabase/functions/_shared/auth.ts`

Substituir o bloco `getUser` por `getClaims`:
- `getClaims(token)` retorna `{ claims: { sub, email, ... } }`
- `userId = claims.sub`
- `email = claims.email`
- Remover o retry loop (não necessário com validação local)

**3. Reimplantar as Edge Functions afetadas**

Todas as que importam `requireUser` de `_shared/auth.ts` serão automaticamente atualizadas no próximo deploy.

### Resultado Esperado

- Autenticação nas Edge Functions passa de ~5-8s para ~1ms
- Dados carregam normalmente mesmo com banco sob carga
- Sistema deixa de aparecer "zerado" após login

