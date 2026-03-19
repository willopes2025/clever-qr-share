

## Disparo em Massa a partir das Oportunidades

### O que será feito

Adicionar ao painel de Oportunidades do Funil:
1. **Checkboxes de seleção** em cada linha da tabela (+ "selecionar todos")
2. **Barra de ações** que aparece quando há oportunidades selecionadas, com botão "Disparar Mensagem"
3. **Dialog de configuração de disparo** com todas as opções da campanha (template, intervalos, horários, dias, controle de duplicatas, agente IA, tag no envio)
4. **Seleção de instância e modo de envio** (reutilizando o `SelectInstanceDialog` existente)

### Fluxo do usuário

1. Analisa oportunidades normalmente
2. Seleciona as oportunidades desejadas via checkbox
3. Clica em "Disparar Mensagem"
4. Configura template + opções de envio no dialog
5. Confirma e seleciona instância(s) WhatsApp
6. O sistema cria automaticamente uma lista de transmissão temporária com os contatos selecionados, cria a campanha vinculada a essa lista, e inicia o disparo

### Alterações técnicas

#### 1. `src/components/funnels/FunnelOpportunitiesView.tsx`
- Adicionar estado de seleção (`selectedDealIds: Set<string>`)
- Coluna de checkbox na tabela (header com "selecionar todos")
- Barra de ações flutuante quando há seleção (similar ao padrão de bulk edit existente)
- Botão "Disparar Mensagem" que abre o dialog

#### 2. Novo: `src/components/funnels/OpportunityBroadcastDialog.tsx`
- Dialog com formulário de configuração de campanha (extraindo a lógica do `CampaignFormDialog`)
- Campos: template, agendamento, intervalo min/max, limite diário, horários, dias, controle de duplicatas, tag no envio, agente IA
- Preview de quantos contatos serão atingidos
- No submit: cria lista manual temporária → insere contatos → cria campanha → abre `SelectInstanceDialog` → inicia campanha

#### 3. Reutilização de componentes existentes
- `SelectInstanceDialog` para seleção de instâncias e modo de envio
- `useMessageTemplates` para listar templates
- `useCampaignMutations` para criar e iniciar campanha
- `useBroadcastLists` para criar lista temporária

### Sem alterações no banco de dados
Tudo usa as tabelas e Edge Functions já existentes (`campaigns`, `broadcast_lists`, `broadcast_list_contacts`, `start-campaign`).

