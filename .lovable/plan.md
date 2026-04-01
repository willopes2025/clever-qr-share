

## Editar nome do contato no funil + corrigir nome "Cliente" no Meta

### Problema
1. Não existe campo para editar o **nome do contato** no formulário de edição do deal no funil
2. Quando o contato tem nome "Cliente" (fallback padrão do sistema), esse valor é enviado como variável `{{1}}` para a Meta API — a mensagem chega no WhatsApp como "Opa, Cliente!" ao invés de um nome real

### Solução

**1. Adicionar campo "Nome do contato" no DealFormDialog**

No `DealFormDialog.tsx`, quando estiver editando um deal existente (`deal` prop presente):
- Adicionar um campo editável "Nome do contato" logo no topo do formulário
- Carregar o nome atual via `deal.contact?.name`
- No submit, se o nome foi alterado, atualizar a tabela `contacts` junto com o deal

**2. Tratar "Cliente" como nome vazio no envio Meta**

No `send-campaign-messages/index.ts`, nas linhas onde faz `message.contact_name || 'Cliente'`:
- Adicionar validação: se o nome é "Cliente" (o fallback genérico), tratar como vazio/usar string vazia ou o primeiro nome do telefone
- Criar função `isGenericName()` que detecta nomes genéricos ("Cliente", nomes que são só números, etc.)
- Quando o nome for genérico, usar string vazia `" "` ao invés de "Cliente" para que a mensagem Meta não fique estranha

### Alterações por arquivo

| Arquivo | Alteração |
|---------|-----------|
| `src/components/funnels/DealFormDialog.tsx` | Adicionar campo "Nome do contato" editável no topo; no submit, atualizar `contacts.name` se alterado |
| `supabase/functions/send-campaign-messages/index.ts` | Substituir fallback "Cliente" por validação inteligente — se nome é genérico, usar espaço vazio `" "` |

### Detalhes técnicos

**DealFormDialog.tsx:**
- Novo state `contactName` inicializado com `deal?.contact?.name || ""`
- Campo `Input` com label "Nome do contato" exibido quando `deal` existe (modo edição)
- No `handleSubmit`, se `contactName` mudou, chamar `supabase.from('contacts').update({ name: contactName.trim() || null }).eq('id', deal.contact_id)`
- Invalidar queries de `conversations` e `contacts` após salvar

**send-campaign-messages/index.ts:**
- Função auxiliar que valida se o nome é real (não é "Cliente", não é só dígitos, tem mais de 1 caractere)
- Aplicar nos 3 pontos onde `message.contact_name || 'Cliente'` aparece (linhas ~858, ~881)
- Quando nome não é válido, usar `" "` (espaço) como fallback para a Meta API aceitar

