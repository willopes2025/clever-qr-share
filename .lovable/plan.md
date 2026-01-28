

# Plano: Criar Rota de Callback para Meta OAuth

## Objetivo
Criar uma nova rota `/auth/meta/callback` para processar o retorno da autenticação OAuth do Facebook/Meta após o login do usuário.

## Por que isso é necessário?
O Facebook Developer requer uma URL de callback válida para redirecionar os usuários após a autorização OAuth. Esta página irá:
1. Capturar o código de autorização da URL
2. Trocar o código pelo token de acesso (via Edge Function)
3. Mostrar feedback visual ao usuário
4. Redirecionar para a página de configurações

---

## Arquitetura da Solução

```text
+---------------------+     +----------------------+     +-------------------------+
|  Facebook OAuth     | --> | /auth/meta/callback  | --> | meta-exchange-token     |
|  (redirect com code)|     | (página React)       |     | (Edge Function)         |
+---------------------+     +----------------------+     +-------------------------+
                                     |                              |
                                     v                              v
                            Mostra feedback          Salva credenciais no DB
                            e redireciona
```

---

## Etapas de Implementação

### 1. Criar a página de callback
**Arquivo:** `src/pages/MetaAuthCallback.tsx`

A página irá:
- Capturar os parâmetros `code` e `state` da URL usando `useSearchParams`
- Mostrar um loading spinner durante o processamento
- Chamar a Edge Function `meta-exchange-token` para trocar o código pelo token
- Exibir mensagem de sucesso ou erro
- Redirecionar automaticamente para `/settings` após sucesso

### 2. Registrar a rota no App.tsx
**Arquivo:** `src/App.tsx`

Adicionar a nova rota como página pública (sem ProtectedRoute), pois o usuário pode não estar autenticado no momento do redirect:

```typescript
// Lazy load
const MetaAuthCallback = lazy(() => import("./pages/MetaAuthCallback"));

// Na seção de rotas públicas
<Route path="/auth/meta/callback" element={<MetaAuthCallback />} />
```

### 3. Atualizar hook useFacebookLogin (opcional)
**Arquivo:** `src/hooks/useFacebookLogin.ts`

Adicionar suporte para fluxo de redirect além do popup, caso necessário.

---

## Detalhes Técnicos

### Parâmetros esperados na URL
```
https://zap.wideic.com/auth/meta/callback?code=AUTHORIZATION_CODE&state=STATE_PARAM
```

### Fluxo da página MetaAuthCallback

```typescript
// 1. Captura o código da URL
const [searchParams] = useSearchParams();
const code = searchParams.get('code');
const errorParam = searchParams.get('error');

// 2. Se houver código, troca pelo token
useEffect(() => {
  if (code) {
    exchangeCodeForToken(code);
  }
}, [code]);

// 3. Chama a Edge Function existente
const exchangeCodeForToken = async (code: string) => {
  const { data, error } = await supabase.functions.invoke('meta-exchange-token', {
    body: { code }
  });
  // Processa resultado...
};

// 4. Redireciona após sucesso
navigate('/settings');
```

### Tratamento de erros
- Se `error` estiver presente na URL: exibir mensagem de erro do Facebook
- Se a troca de token falhar: exibir erro e botão para tentar novamente
- Timeout de 30 segundos para evitar loops infinitos

---

## Arquivos a serem criados/modificados

| Arquivo | Ação |
|---------|------|
| `src/pages/MetaAuthCallback.tsx` | **Criar** - Nova página de callback |
| `src/App.tsx` | **Modificar** - Adicionar nova rota |

---

## Configuração no Facebook Developer

Após criar a rota, adicione esta URL no campo **Valid OAuth Redirect URIs**:
```
https://zap.wideic.com/auth/meta/callback
```

E também a versão de preview se necessário:
```
https://clever-qr-share.lovable.app/auth/meta/callback
```

