

## Plano: Lista de disparo a partir do funil + correção de dados de cidade nos formulários

### Problema 1: Gerar lista de disparo com leads selecionados no funil (lista view)

A visualização em lista do funil já tem seleção de checkboxes e botões de "Editar em Massa" e "Excluir", mas **não tem botão para criar lista de disparo**. A aba de Oportunidades já tem essa funcionalidade via `OpportunityBroadcastDialog`.

**Solução**: Reutilizar o `OpportunityBroadcastDialog` na `FunnelListView`, adicionando um botão "Criar Lista de Disparo" na barra de ações que aparece quando há leads selecionados.

**Arquivo**: `src/components/funnels/FunnelListView.tsx`
- Adicionar estado `showBroadcast` e computar `selectedContacts` a partir dos `selectedIds` (extrair `contact_id` e nome dos deals selecionados)
- Adicionar botão "Disparar (N)" ao lado de "Editar em Massa" quando há seleção
- Renderizar `OpportunityBroadcastDialog` com os contatos selecionados

---

### Problema 2: Edição de submissões de formulário não salva (RLS)

A tabela `form_submissions` tem políticas de SELECT, INSERT e DELETE, mas **nenhuma política de UPDATE**. Qualquer tentativa de editar uma submissão falha silenciosamente.

**Solução**: Criar migração SQL adicionando política de UPDATE.

**Migração SQL**:
```sql
CREATE POLICY "Users can update form submissions"
ON public.form_submissions FOR UPDATE
USING (user_id IN (SELECT get_organization_member_ids(auth.uid())))
WITH CHECK (user_id IN (SELECT get_organization_member_ids(auth.uid())));
```

---

### Problema 3: Cidade confusa entre formulário e funil

Os dados mostram que:
- Formulários mapeiam "Cidade" como `mapping_type = 'custom_field'` com `mapping_target = 'municipio'` (entidade **contato**)
- Alguns formulários mapeiam como `mapping_type = 'lead_field'` com `mapping_target = 'cidade_do_evento'` (entidade **lead/deal**)
- Os deals no funil mostram `cidade_do_evento = null` para a maioria, porque a cidade foi salva no **contato** (`contacts.custom_fields.municipio`), não no deal

O campo "Cidade" no funil lista view já resolve isso corretamente (linhas 465-467 e 670-673 verificam ambos `deal.custom_fields` e `contact.custom_fields`). Porém, se o campo no formulário está mapeado como `custom_field` → `municipio` (contato), o valor fica no contato e aparece corretamente na lista — **desde que a coluna `custom_municipio` esteja visível**.

**Não há bug no código de resolução**, mas há um problema de **consistência nos dados existentes**: formulários que salvam cidade como campo de contato (`municipio`) funcionam, mas formulários que salvam como campo de lead (`cidade_do_evento`) criam uma fragmentação.

**Nenhuma alteração de código necessária** para este item — a resolução já busca em ambos os locais. O sistema está funcionando como configurado nos formulários.

---

### Resumo de arquivos a modificar

1. **Migração SQL** — Adicionar política UPDATE em `form_submissions`
2. **`src/components/funnels/FunnelListView.tsx`** — Adicionar botão de disparo e integração com `OpportunityBroadcastDialog`

