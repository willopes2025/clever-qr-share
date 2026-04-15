

# Plano: Painel de Automações Asaas com Switches Individuais

## Contexto

O sistema já possui switches individuais para os **lembretes de cobrança** (emitido, 5 dias antes, dia do vencimento, etc.). O pedido é criar um painel unificado que mostre **todas as automações do Asaas** — incluindo a nova geração de cobrança PIX — com um switch para cada uma.

## O que será feito

### Novo Card "Automações Asaas" no `AsaasSettings.tsx`

Adicionar um card acima (ou substituindo) o card de "Lembretes de Cobrança" que agrupe todas as automações Asaas em uma lista visual com switches:

| Automação | Descrição | Switch |
|-----------|-----------|--------|
| Lembretes de cobrança | Envia mensagens automáticas sobre cobranças | ✅/❌ |
| ├ Boleto emitido | Ao criar cobrança | ✅/❌ |
| ├ 5 dias antes | Lembrete pré-vencimento | ✅/❌ |
| ├ Dia do vencimento | No dia | ✅/❌ |
| ├ 1 dia após | Atraso 1 dia | ✅/❌ |
| ├ 3 dias após | Atraso 3 dias | ✅/❌ |
| └ 5 dias após | Atraso 5 dias | ✅/❌ |
| Gerar cobrança PIX automática | Cria cobrança ao entrar no funil com pagamento PIX | ✅/❌ |

### Detalhes técnicos

- **Arquivo**: `src/components/settings/AsaasSettings.tsx`
- O switch master de "Lembretes de cobrança" já existe (`billingEnabled`) — será mantido
- Os switches individuais por tipo de lembrete já existem (`enabledReminders`) — serão mantidos
- Novo estado: `autoChargeEnabled` para a automação de geração de cobrança PIX
- Tudo salvo no campo `settings` da integração Asaas (já existente), adicionando a key `auto_charge_enabled`
- A lógica no backend (`process-funnel-automations`) checará esse flag antes de executar a geração de cobrança

### Layout

O card terá um design de lista com bordas entre itens, cada linha com:
- Ícone + nome da automação
- Descrição curta em texto menor
- Switch no lado direito
- Itens-filhos (sub-lembretes) com indentação visual

Isso mantém o padrão visual já usado no accordion atual, mas mais compacto e direto.

