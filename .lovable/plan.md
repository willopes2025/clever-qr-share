
Objetivo: revisar a configuração e a lógica de oportunidades para parar de reciclar os mesmos leads e abrir alternativas melhores de rotação e descoberta.

O que encontrei
- O problema principal não parece mais ser “reanálise não exclui os IDs atuais”. Essa exclusão existe.
- O gargalo real está na estratégia de seleção:
  - a função escaneia os deals por `created_at desc`, então sempre começa pelos mais novos;
  - ela interrompe cedo quando enche um pool mínimo, então tende a trabalhar sempre no mesmo pedaço do funil;
  - depois faz `shuffle`, mas embaralha quase sempre o mesmo subconjunto;
  - a reanálise exclui apenas os 30 atuais, mas na chamada seguinte o algoritmo volta ao topo da fila e escolhe outros leads do mesmo bloco “quente”.
- Também há um viés forte para deals com conversa recente, o que é bom, mas sem memória de rotação isso concentra demais nos mesmos contatos.
- A configuração atual do funil só permite:
  - prompt de oportunidade
  - janela de mensagens em dias
  Isso é pouco para controlar diversidade e reanálise.

Plano revisado

1. Reestruturar a seleção de candidatos no backend
- Trocar a lógica de “scan + stop early” por uma seleção em camadas:
  - camada A: deals com conversa recente e nunca exibidos recentemente
  - camada B: deals com conversa recente, mas exibidos há mais tempo
  - camada C: deals sem conversa recente, mas com sinais de atividade/dados
- Em vez de sempre começar do topo, usar rotação determinística por cursor/offset persistido por funil.

2. Adicionar memória de rotação por funil
- Criar persistência de estado de análise no backend, por exemplo:
  - último cursor analisado
  - últimos deals exibidos
  - timestamp da última rodada
- Na reanálise:
  - excluir os atuais
  - continuar da posição seguinte do cursor
  - só reciclar leads antigos quando todo o universo elegível tiver sido percorrido
- Se o universo acabar, retornar estado claro de “sem novos leads” em vez de repetir.

3. Incluir blacklist temporária de leads já mostrados
- Implementar uma janela de resfriamento, por exemplo:
  - “não mostrar novamente por X reanálises”
  ou
  - “não mostrar novamente por Y dias”
- Isso resolve o caso em que o mesmo lead continua elegível e reaparece cedo demais.

4. Melhorar a configuração da tela de oportunidades
- Expandir o painel de configurações para incluir opções práticas:
  - janela de mensagens
  - priorizar conversas recentes: forte / equilibrado / desligado
  - evitar repetir leads por N reanálises
  - tamanho da amostra por rodada
  - incluir leads sem conversa
  - estratégia de rotação: recente / equilibrada / explorar novos
- Isso te dá controle sem depender só do prompt.

5. Ajustar a heurística de “novos leads”
- Criar um modo “explorar novos” para reanálise:
  - prioriza deals nunca analisados
  - depois deals não mostrados recentemente
  - por último deals antigos
- Assim o botão “Re-analisar” passa a se comportar como descoberta de novos candidatos, não apenas novo ranking do mesmo grupo.

6. Preservar qualidade sem depender de trocar a IA
- Neste problema, trocar o modelo de IA não resolve sozinho.
- O erro está mais na curadoria dos candidatos enviados para a IA do que no modelo em si.
- Só depois da rotação ficar correta faz sentido revisar prompt/modelo para melhorar score e insight.

7. Ajustar o frontend para refletir melhor o estado da reanálise
- Exibir feedback específico:
  - “mostrando novos leads”
  - “sem novos leads disponíveis”
  - “última rotação concluída”
- Opcional: adicionar ação “reiniciar ciclo” para permitir reciclar manualmente apenas quando o usuário quiser.

Alternativas recomendadas
- Alternativa 1: Cursor persistente por funil
  - melhor custo/benefício
  - resolve repetição sequencial
  - mantém performance boa
- Alternativa 2: Histórico de exibição + cooldown
  - melhor para evitar repetição perceptível
  - ideal combinar com a alternativa 1
- Alternativa 3: Pool maior + amostragem estratificada
  - melhora variedade
  - mas sozinho não impede repetição
- Recomendação final:
  - combinar cursor persistente + histórico de exibição + modo “explorar novos”

Arquivos/áreas a revisar na implementação
- `supabase/functions/analyze-funnel-opportunities/index.ts`
- `src/components/funnels/FunnelOpportunitiesView.tsx`
- nova migração para armazenar estado de rotação/histórico
- possivelmente `funnels` para salvar novas preferências de configuração

Impacto esperado
- reanálise deixa de puxar sempre o mesmo bloco de leads
- oportunidades passam a variar de rodada para rodada
- o usuário consegue configurar a estratégia de descoberta
- a IA passa a analisar um conjunto realmente novo, aumentando a chance de achar oportunidades que hoje estão invisíveis

Detalhes técnicos
```text
Problema atual:
scan por created_at desc
 -> para cedo
 -> embaralha subconjunto pequeno
 -> exclui 30 atuais
 -> próxima rodada volta ao topo

Fluxo proposto:
estado do funil
 -> cursor persistido
 -> histórico recente de exibidos
 -> cooldown anti-repetição

reanálise
 -> continua do cursor
 -> remove atuais + recentes
 -> prioriza nunca analisados
 -> só recicla quando universo elegível acabar
```
