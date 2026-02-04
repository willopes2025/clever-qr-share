
# Plano: Exclusão por Tag nos Critérios de Duplicatas

## Resumo

Adicionar uma nova opção no **Critério de Exclusão** que permite excluir contatos que possuem uma tag específica. Isso é útil para evitar enviar campanhas para contatos que já receberam mensagens de campanhas anteriores (marcados com a tag "Tag de Entrega").

---

## Como Vai Funcionar

1. No dropdown "Critério de Exclusão", haverá uma nova opção: **"Contatos com Tag"**
2. Ao selecionar essa opção, aparece um segundo campo para **selecionar qual tag** usar como critério
3. Contatos que possuem essa tag serão excluídos do disparo
4. Exemplo: Se você aplicou a tag "Campanha Janeiro" em todos que receberam, na próxima campanha pode excluir quem tem essa tag

---

## Visual do Fluxo

```text
+------------------------------------------+
| Critério de Exclusão                     |
+------------------------------------------+
| [v] Contatos com Tag                     |
+------------------------------------------+

+------------------------------------------+
| Tag de Exclusão                          |
+------------------------------------------+
| [v] Campanha Janeiro  [●]                |
+------------------------------------------+
| Exclui contatos que possuem esta tag     |
+------------------------------------------+
```

---

## Mudanças Necessárias

### 1. Banco de Dados

Adicionar nova coluna na tabela `campaigns`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `skip_tag_id` | `uuid` (nullable) | ID da tag a ser usada como critério de exclusão |

### 2. Frontend - Formulário

**Arquivo:** `src/components/campaigns/CampaignFormDialog.tsx`

- Adicionar novo valor no `skip_mode`: `'has_tag'`
- Adicionar estado `skipTagId` para armazenar a tag selecionada
- Quando `skipMode === 'has_tag'`, exibir dropdown para selecionar a tag
- Atualizar interface `onSubmit` para incluir `skip_tag_id`

### 3. Frontend - Hook

**Arquivo:** `src/hooks/useCampaigns.ts`

- Adicionar `skip_tag_id` na interface `Campaign`
- Adicionar tipo `'has_tag'` no union type de `skip_mode`
- Incluir `skip_tag_id` nas operações de criar/atualizar

### 4. Backend - Edge Function

**Arquivo:** `supabase/functions/start-campaign/index.ts`

Adicionar lógica para filtrar contatos por tag:

```text
if (skipMode === 'has_tag' && campaign.skip_tag_id) {
  // Buscar IDs de contatos que têm a tag
  const { data: taggedContacts } = await supabase
    .from('contact_tags')
    .select('contact_id')
    .eq('tag_id', campaign.skip_tag_id);
  
  const taggedIds = new Set(taggedContacts.map(t => t.contact_id));
  
  // Excluir contatos que têm a tag
  filteredContacts = contacts.filter(c => !taggedIds.has(c.id));
}
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Adicionar coluna `skip_tag_id` |
| `src/components/campaigns/CampaignFormDialog.tsx` | Nova opção + seletor de tag |
| `src/hooks/useCampaigns.ts` | Incluir novo campo e tipo |
| `supabase/functions/start-campaign/index.ts` | Lógica de exclusão por tag |

---

## Comportamento Esperado

1. Usuário ativa "Evitar Duplicatas"
2. Seleciona "Contatos com Tag" no critério
3. Escolhe a tag (ex: "Já Recebeu Oferta")
4. Ao iniciar campanha, todos os contatos com essa tag são removidos da fila
5. O contador de "Duplicados" no card mostra quantos foram excluídos

---

## Observação Importante

O campo "Período (dias)" **não se aplica** quando o modo é "Contatos com Tag", pois a tag é permanente (não tem data de expiração). A interface vai ocultar esse campo quando o modo `has_tag` estiver selecionado.
