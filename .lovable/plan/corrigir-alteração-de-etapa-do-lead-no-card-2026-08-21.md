# Corrigir alteração de etapa do lead no card

## Objetivo
Fazer a mudança de etapa funcionar de forma imediata e confiável tanto no card do funil quanto no painel lateral do Inbox, sem congelar ou voltar para a etapa anterior.

## Plano
1. Reproduzir a troca de etapa no card com a sessão atual e capturar a requisição que falha, o retorno do banco e o estado visual após a seleção.
2. Corrigir o fluxo central de `updateDeal`, usado pelos dois cards:
   - validar separadamente a leitura do lead, o registro do histórico e a atualização da etapa;
   - impedir que tarefas secundárias, histórico ou notificações bloqueiem a alteração principal;
   - manter a atualização otimista e restaurar o estado somente quando a gravação da etapa realmente falhar;
   - exibir a mensagem real e compreensível quando houver erro.
3. Ajustar os seletores/drag-and-drop apenas se a reprodução mostrar conflito de evento, estado ou cache na interface.
4. Validar no banco que `stage_id`, `entered_stage_at` e o histórico ficaram consistentes e testar a mudança pelo Inbox e pelo Kanban.

## Estado verificado
- Inbox e Kanban usam a mesma mutação `updateDeal`.
- A interface já tenta atualizar a etapa de forma otimista.
- As automações e notificações já são disparadas em segundo plano.
- Existem políticas de acesso organizacional para atualizar leads e registrar histórico.
- Não há erro recente correspondente nos logs consultados, portanto a causa exata será confirmada pela reprodução antes da correção.

## Detalhes técnicos
A correção ficará concentrada no hook compartilhado e, se necessário, nos componentes `LeadPanelFunnelBar` e `FunnelKanbanView`, evitando mudanças nas automações ou regras de negócio que não estejam relacionadas ao erro.
