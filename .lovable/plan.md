

## Mensagem IA com Dados do Asaas na Aba Templates

### Objetivo
Adicionar na aba Templates uma funcionalidade de "Mensagem IA" similar à das Oportunidades, onde a IA tem acesso aos dados financeiros do Asaas (faturas pendentes, vencidas, valores) para gerar mensagens de cobrança personalizadas por contato.

### O que será feito

**1. Novo modo no TemplateFormDialog: "IA com Asaas"**
- Adicionar um checkbox/switch "Incluir dados financeiros (Asaas)" dentro do modo IA Dinâmico já existente
- Quando ativado, a IA recebe no contexto de cada contato: status de pagamento, valor da fatura, data de vencimento, link de pagamento
- Badge adicional na lista de dados disponíveis: "Status pagamento Asaas", "Valor fatura", "Data vencimento", "Link de pagamento"

**2. Atualizar a edge function `start-campaign` (seção IA dinâmica)**
- Quando o template tem `ai_prompt` E o usuário tem integração Asaas ativa, buscar os dados financeiros do contato via API Asaas antes de montar o contexto
- Usar `asaas_customer_id` do contato para buscar faturas pendentes/vencidas
- Adicionar ao contexto do contato: status do pagamento, valor, vencimento e link do boleto/pix
- O prompt do sistema já instrui a IA a usar apenas dados presentes no contexto, então basta injetar os dados financeiros

**3. Nova edge function `get-asaas-customer-payments`**
- Recebe `contact_ids[]` e retorna dados financeiros agrupados por contato
- Busca `asaas_customer_id` dos contatos no banco
- Para cada customer_id, consulta a API Asaas por faturas PENDING e OVERDUE
- Retorna: `{ contact_id, payments: [{ status, value, dueDate, invoiceUrl, billingType }] }`
- Usado pelo `start-campaign` durante a geração IA dinâmica

**4. UI: indicador visual no TemplateFormDialog**
- No modo IA Dinâmico, adicionar seção colapsável "Dados financeiros (Asaas)"
- Switch para ativar/desativar inclusão dos dados Asaas
- Salvar essa preferência no template (novo campo `include_asaas_data: boolean` na tabela `message_templates`)

### Alterações por arquivo

| Arquivo | Alteração |
|---------|-----------|
| `src/components/templates/TemplateFormDialog.tsx` | Adicionar switch "Dados do Asaas" no modo IA Dinâmico + badges |
| `src/hooks/useMessageTemplates.ts` | Adicionar campo `include_asaas_data` na interface e mutations |
| `supabase/functions/start-campaign/index.ts` | Na seção IA dinâmica, buscar dados Asaas quando `include_asaas_data=true` e injetar no contexto |
| **Migração SQL** | Adicionar coluna `include_asaas_data boolean default false` em `message_templates` |

### Fluxo de execução
1. Usuário cria template com IA Dinâmica + "Dados Asaas" ativado
2. Ao disparar campanha, `start-campaign` detecta `ai_prompt` + `include_asaas_data`
3. Para cada lote de contatos, busca `asaas_customer_id` e consulta faturas na API Asaas
4. Injeta no contexto: "Dados financeiros: Fatura de R$ 350,00 vencida em 15/03/2026, status: OVERDUE, link: https://..."
5. IA gera mensagem de cobrança personalizada usando esses dados

### Dados Asaas injetados no contexto da IA
```text
Dados financeiros (Asaas):
- Fatura 1: R$ 350,00 | Vencimento: 15/03/2026 | Status: Vencida | Tipo: Boleto
  Link: https://www.asaas.com/b/pay/...
- Fatura 2: R$ 200,00 | Vencimento: 01/04/2026 | Status: Pendente | Tipo: PIX
  Link: https://www.asaas.com/b/pay/...
```

