

# Acesso Financeiro Configurável por Usuário

## Problema Identificado
Atualmente, o sistema trata **todos os admins** como tendo acesso total — incluindo o Financeiro. Na tela de permissões de um admin, aparece apenas a mensagem "Administradores têm acesso completo" sem opção de personalizar. Isso impede que você restrinja o acesso ao Financeiro para admins específicos como a Katia.

Além disso, se a Katia não está vendo o Financeiro no menu, pode ser porque o `hasPermission` retorna `true` genericamente para admins, mas a visualização depende também do `useIntegrationStatus` que consulta a edge function — e pode haver um problema de cache ou timing.

## Plano de Implementação

### 1. Permitir edição de permissões para admins (com exceção do owner)
**Arquivo:** `src/components/settings/MemberPermissionsDialog.tsx`
- Remover o bloco que bloqueia edição para admins (linhas 103-119)
- Permitir que o **owner** da organização edite permissões de qualquer membro, inclusive admins
- Admins continuam com todas as permissões marcadas por padrão, mas o owner pode desmarcar itens específicos (ex: Financeiro)

### 2. Alterar lógica de `checkPermission` para respeitar permissões salvas de admins
**Arquivo:** `src/hooks/useOrganization.ts` (função `checkPermission`)
- Manter que o **owner** sempre tem acesso total
- Para admins que **não são owner**, verificar as permissões salvas no banco ao invés de retornar `true` automaticamente
- Fallback: se não há permissão salva, usar `defaultForAdmin` (que é `true` para tudo)

### 3. Alterar `hasPermission` no config
**Arquivo:** `src/config/permissions.ts` (função `hasPermission`)
- Remover a linha que retorna `true` para todos os admins
- Tratar admin como role que usa `defaultForAdmin` como fallback quando não há permissão explícita

### 4. Atualizar edge function `asaas-api` para respeitar permissões individuais
**Arquivo:** `supabase/functions/asaas-api/index.ts`
- Atualmente, admins passam direto (linha 86-89)
- Alterar para verificar permissões salvas do membro, usando `defaultForAdmin` como fallback

### 5. Atualizar edge function `integration-status` para considerar permissão do membro
**Arquivo:** `supabase/functions/integration-status/index.ts`
- Verificar se o membro tem `view_finances` ativado nas permissões salvas
- Se o membro (mesmo admin) tem essa permissão desativada, retornar `asaas: false`

### Arquivos impactados
- `src/components/settings/MemberPermissionsDialog.tsx`
- `src/hooks/useOrganization.ts`
- `src/config/permissions.ts`
- `supabase/functions/asaas-api/index.ts`
- `supabase/functions/integration-status/index.ts`

### Resultado
O owner poderá abrir as permissões de qualquer membro (inclusive admins) e ativar/desativar o acesso ao Financeiro individualmente. O menu lateral e as rotas respeitarão essas configurações.

