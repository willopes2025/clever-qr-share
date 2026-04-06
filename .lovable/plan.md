

## Plano: Criar templates oficiais Meta para lembretes de cobrança

### Problema
Atualmente os lembretes de cobrança usam mensagens de texto livre, mas para enviar via API oficial da Meta fora da janela de 24h, é necessário usar **templates aprovados**. Precisamos criar os 6 templates e enviá-los para aprovação automaticamente.

### O que será feito

**1. Botão "Criar Templates no Meta" na tela de configuração do Asaas**
- Adicionar um botão na seção de lembretes de cobrança que cria os 6 templates automaticamente na conta Meta selecionada
- O botão usa o número Meta selecionado para identificar o WABA ID correto
- Categoria: `UTILITY` (cobranças são utilitárias)
- Idioma: `pt_BR`

**2. Templates que serão criados**
Os templates usam variáveis no formato Meta (`{{1}}`, `{{2}}`, `{{3}}`, `{{4}}`):

| Nome do template | Corpo | Variáveis |
|---|---|---|
| `cobranca_emitida` | Olá {{1}}! Sua cobrança de R${{2}} foi gerada. Vencimento: {{3}}. Link: {{4}} | nome, valor, data, url |
| `cobranca_5dias_antes` | Lembrete: sua cobrança de R${{1}} vence em 5 dias ({{2}}). Link: {{3}} | valor, data, url |
| `cobranca_dia_vencimento` | Hoje é o vencimento da sua cobrança de R${{1}}. Evite juros! Link: {{2}} | valor, url |
| `cobranca_1dia_atraso` | Sua cobrança de R${{1}} venceu ontem ({{2}}). Regularize: {{3}} | valor, data, url |
| `cobranca_3dias_atraso` | Cobrança de R${{1}} em atraso há 3 dias (vencimento: {{2}}). Link: {{3}} | valor, data, url |
| `cobranca_5dias_atraso` | Último lembrete: cobrança de R${{1}} em atraso (vencimento: {{2}}). Link: {{3}} | valor, data, url |

**3. Atualizar `process-billing-reminders` para usar templates Meta**
- Quando o provedor configurado for Meta, enviar usando `meta-whatsapp-send` com o template name + parâmetros mapeados
- Cada `reminder_type` mapeia para o template correspondente
- Os valores das variáveis `{nome}`, `{valor}`, `{data}`, `{url}` são convertidos em parâmetros posicionais do template

**4. Feedback visual**
- Mostrar status de cada template (pendente, aprovado, rejeitado) na tela do Asaas
- Se os templates já existirem, mostrar o status atual em vez de recriar

### Arquivos alterados
- `src/components/settings/AsaasSettings.tsx` — botão de criação + status dos templates
- `supabase/functions/process-billing-reminders/index.ts` — envio via template Meta em vez de texto livre

