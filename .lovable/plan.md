

# Plano: Filtro Alfabético para Inicio de Nome em Disparos

## Resumo

Adicionar a capacidade de filtrar contatos pelo prefixo do nome (por exemplo: "Ai", "Ao", "Ma") ao criar ou editar uma campanha de disparo. Isso permite que você comece a disparar apenas para contatos cujos nomes iniciam com determinadas letras ou sílabas.

---

## Como Vai Funcionar

1. Na tela de criação/edição de campanha, nas **Configurações de Envio** (seção avançada), haverá um novo campo: **"Filtrar por início do nome"**
2. Você pode digitar um ou mais prefixos separados por vírgula (ex: "Ai, Ao, Ma")
3. Apenas contatos cujos nomes começam com esses prefixos serão incluídos no disparo
4. O filtro é aplicado **antes** de criar a fila de mensagens, então contatos que não correspondem nem entram na fila

---

## Mudanças Necessárias

### 1. Banco de Dados

Adicionar nova coluna na tabela `campaigns`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `name_prefix_filter` | `text[]` | Array de prefixos para filtrar nomes (ex: ["Ai", "Ao"]) |

### 2. Interface (Frontend)

**Arquivo:** `src/components/campaigns/CampaignFormDialog.tsx`

Adicionar na seção de Configurações de Envio:
- Novo campo de input para prefixos
- Instrução de uso (separar por vírgula)
- Estado local para gerenciar os prefixos

### 3. Hook de Campanhas

**Arquivo:** `src/hooks/useCampaigns.ts`

Atualizar para incluir o novo campo `name_prefix_filter` nas operações de criar/atualizar campanha.

### 4. Edge Function (Backend)

**Arquivo:** `supabase/functions/start-campaign/index.ts`

Adicionar lógica para filtrar contatos pelo prefixo do nome **antes** de criar os registros na fila:

```text
// Pseudocódigo
if (campaign.name_prefix_filter && campaign.name_prefix_filter.length > 0) {
  filteredContacts = contacts.filter(contact => {
    const name = (contact.name || '').toLowerCase().trim();
    return campaign.name_prefix_filter.some(prefix => 
      name.startsWith(prefix.toLowerCase().trim())
    );
  });
}
```

---

## Fluxo Visual

```text
Criação de Campanha
     |
     v
[Configurações Avançadas]
     |
     v
[Campo: Filtrar por início do nome]
     |  Input: "Ai, Ao, Ma"
     v
[Salvar Campanha]
     |
     v
[Iniciar Campanha] ---> start-campaign
     |
     v
[Buscar contatos da lista]
     |
     v
[Aplicar filtro de prefixo de nome] <-- NOVO
     |
     v
[Aplicar filtro de exclusão (same_template, etc)]
     |
     v
[Criar registros na fila apenas para contatos filtrados]
```

---

## Detalhes de Implementação

### Campo na Interface

```text
+------------------------------------------+
| Filtrar por Início do Nome (opcional)    |
+------------------------------------------+
| [  Ai, Ao, Ma                         ]  |
| Separe múltiplos prefixos por vírgula    |
+------------------------------------------+
```

### Exemplo de Uso

- Lista tem 1.000 contatos
- Usuário configura filtro: "Ai, Ao"
- Resultado: Apenas contatos como "Aída", "Airan", "Aoshi" serão incluídos
- Contatos como "Maria", "João" serão **excluídos** do disparo

---

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| Migração SQL | Criar | Adicionar coluna `name_prefix_filter` |
| `src/components/campaigns/CampaignFormDialog.tsx` | Modificar | Adicionar campo de input para prefixos |
| `src/hooks/useCampaigns.ts` | Modificar | Incluir novo campo nas operações |
| `supabase/functions/start-campaign/index.ts` | Modificar | Aplicar filtro de prefixo antes de criar fila |

---

## Resultado Esperado

1. Usuário pode configurar prefixos de nome ao criar campanha
2. Ao iniciar disparo, apenas contatos com nomes que começam com os prefixos entram na fila
3. Contagem de contatos reflete apenas os que serão enviados
4. Logs indicam quantos contatos foram filtrados pelo prefixo

