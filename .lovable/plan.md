
# Correção: Políticas RLS do Funil para Organizações

## Problema Identificado

Nos logs do Postgres, encontrei o erro:
```
"new row violates row-level security policy for table \"funnel_deal_history\""
```

### Causa Raiz

As políticas RLS das tabelas de funil não consideram o contexto de **organização**. Membros da mesma organização conseguem **visualizar** os deals, mas não conseguem **modificar** ou criar registros de histórico.

**Políticas Problemáticas Atuais:**

| Tabela | Operação | Problema |
|--------|----------|----------|
| `funnel_deal_history` | INSERT | Só permite se `deal.user_id = auth.uid()` |
| `funnel_deal_history` | SELECT | Só permite se `deal.user_id = auth.uid()` |
| `funnel_deals` | UPDATE | Só permite se `user_id = auth.uid()` |
| `funnel_deals` | DELETE | Só permite se `user_id = auth.uid()` |
| `funnel_stages` | INSERT | Só permite se `funnel.user_id = auth.uid()` |

### Fluxo do Erro

```text
1. Membro "Matheus" (user_id: A) tenta mover um deal
2. Deal pertence a "Dono da Org" (user_id: B)
3. Matheus faz UPDATE no funnel_deals → BLOQUEADO (user_id != auth.uid())
4. Se passasse, tentaria INSERT no funnel_deal_history → BLOQUEADO
```

---

## Solução

Atualizar as políticas RLS para usar a função `get_organization_member_ids()` que já existe e é usada em outras políticas (como SELECT de funnel_deals).

### Políticas a Corrigir

#### 1. funnel_deal_history - INSERT (Principal)
```sql
-- DE:
WITH CHECK (EXISTS (
  SELECT 1 FROM funnel_deals
  WHERE funnel_deals.id = funnel_deal_history.deal_id 
  AND funnel_deals.user_id = auth.uid()
))

-- PARA:
WITH CHECK (EXISTS (
  SELECT 1 FROM funnel_deals
  WHERE funnel_deals.id = funnel_deal_history.deal_id 
  AND (funnel_deals.user_id = auth.uid() 
       OR funnel_deals.user_id IN (SELECT get_organization_member_ids(auth.uid())))
))
```

#### 2. funnel_deal_history - SELECT
```sql
-- Atualizar para incluir membros da organização
USING (EXISTS (
  SELECT 1 FROM funnel_deals
  WHERE funnel_deals.id = funnel_deal_history.deal_id 
  AND (funnel_deals.user_id = auth.uid() 
       OR funnel_deals.user_id IN (SELECT get_organization_member_ids(auth.uid())))
))
```

#### 3. funnel_deals - UPDATE
```sql
-- DE:
USING (auth.uid() = user_id)

-- PARA:
USING (user_id = auth.uid() 
       OR user_id IN (SELECT get_organization_member_ids(auth.uid())))
```

#### 4. funnel_deals - DELETE
```sql
-- DE:
USING (auth.uid() = user_id)

-- PARA:
USING (user_id = auth.uid() 
       OR user_id IN (SELECT get_organization_member_ids(auth.uid())))
```

#### 5. funnel_stages - INSERT
```sql
-- DE:
WITH CHECK (EXISTS (
  SELECT 1 FROM funnels
  WHERE funnels.id = funnel_stages.funnel_id 
  AND funnels.user_id = auth.uid()
))

-- PARA:
WITH CHECK (EXISTS (
  SELECT 1 FROM funnels
  WHERE funnels.id = funnel_stages.funnel_id 
  AND (funnels.user_id = auth.uid() 
       OR funnels.user_id IN (SELECT get_organization_member_ids(auth.uid())))
))
```

---

## Resumo das Alterações

| Tabela | Operação | Status Atual | Após Correção |
|--------|----------|--------------|---------------|
| `funnel_deal_history` | INSERT | Só dono | Dono + Org |
| `funnel_deal_history` | SELECT | Só dono | Dono + Org |
| `funnel_deals` | UPDATE | Só dono | Dono + Org |
| `funnel_deals` | DELETE | Só dono | Dono + Org |
| `funnel_stages` | INSERT | Só dono | Dono + Org |

---

## Resultado Esperado

Após a correção:
1. Qualquer membro da organização poderá mover leads no funil
2. O histórico de movimentação será registrado corretamente
3. A visualização continuará funcionando (já está ok)
4. A segurança é mantida (apenas membros da mesma organização)

---

## Seção Técnica

### Migração SQL Completa

```sql
-- 1. funnel_deal_history - DROP e CREATE novas políticas
DROP POLICY IF EXISTS "Users can create history for their deals" ON funnel_deal_history;
DROP POLICY IF EXISTS "Users can view history of their deals" ON funnel_deal_history;

CREATE POLICY "Org members can create history for org deals" ON funnel_deal_history
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM funnel_deals
  WHERE funnel_deals.id = funnel_deal_history.deal_id 
  AND (funnel_deals.user_id = auth.uid() 
       OR funnel_deals.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

CREATE POLICY "Org members can view history of org deals" ON funnel_deal_history
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM funnel_deals
  WHERE funnel_deals.id = funnel_deal_history.deal_id 
  AND (funnel_deals.user_id = auth.uid() 
       OR funnel_deals.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));

-- 2. funnel_deals - UPDATE e DELETE
DROP POLICY IF EXISTS "Users can update their own deals" ON funnel_deals;
DROP POLICY IF EXISTS "Users can delete their own deals" ON funnel_deals;

CREATE POLICY "Org members can update org deals" ON funnel_deals
FOR UPDATE TO authenticated
USING (user_id = auth.uid() 
       OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

CREATE POLICY "Org members can delete org deals" ON funnel_deals
FOR DELETE TO authenticated
USING (user_id = auth.uid() 
       OR user_id IN (SELECT get_organization_member_ids(auth.uid())));

-- 3. funnel_stages - INSERT
DROP POLICY IF EXISTS "Users can create stages in their funnels" ON funnel_stages;

CREATE POLICY "Org members can create stages in org funnels" ON funnel_stages
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM funnels
  WHERE funnels.id = funnel_stages.funnel_id 
  AND (funnels.user_id = auth.uid() 
       OR funnels.user_id IN (SELECT get_organization_member_ids(auth.uid())))
));
```

### Observação sobre TO authenticated

Todas as novas políticas usam `TO authenticated` explicitamente, seguindo a recomendação do Supabase para evitar que políticas sejam aplicadas ao role errado.
