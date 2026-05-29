
# Treinamento completo — todos os módulos

Hoje o `src/data/trainings.ts` cobre só 5 áreas (Início, Instâncias, Inbox, Campanhas, Formulários). O sistema tem ~20 módulos. Vou expandir para cobrir **todos**, mantendo o mesmo padrão (descrição + lista numerada de botões + dicas), e marcar como "concluído" continua funcionando porque cada step tem `id` único.

## Módulos que serão adicionados

Baseado nas rotas reais em `src/App.tsx`:

1. **Início** *(já existe — manter)*
   - Dashboard, Perfil
   - **+ adicionar**: Configurações da organização, Tema/Idioma, Permissões/Equipe
2. **Instâncias** *(já existe — manter)*
   - **+ adicionar**: Configurações avançadas da instância (webhook, IA, horário)
3. **Inbox** *(já existe — manter)*
   - **+ adicionar**: Atribuir/transferir, Etiquetas, Notas internas, Agendamento, Tarefas vinculadas à conversa
4. **Funis (Kanban)** — *novo*
   - Visão do funil, criar/editar etapas, mover cards, automações de etapa, campos de cartão, filtros e busca
5. **Contatos** — *novo*
   - Listagem, busca, importação CSV, campos personalizados, edição em massa, mesclar duplicados, exportar
6. **Listas de Transmissão** — *novo*
   - Lista estática vs dinâmica, filtros por campo personalizado, adicionar contatos, histórico de envios
7. **Templates de Mensagem** — *novo*
   - Templates de texto, mídia, com variáveis, templates oficiais Meta, variações por IA, gerar áudio TTS
8. **Campanhas** *(já existe — manter)*
   - **+ adicionar**: Modo chatbot, distribuição entre instâncias, agente de IA da campanha
9. **Calendário** — *novo*
   - Visões dia/semana/mês, criar tarefa/evento, atribuir, tipos de tarefa, integração Google Calendar
10. **Tarefas** — *novo*
    - Lista de tarefas, filtros por responsável/tipo, criação rápida, conclusão, vínculo com contato/deal
11. **Chat Interno** — *novo*
    - Conversas entre membros da equipe, grupos, notificações, anexos
12. **Chatbots (Builder)** — *novo*
    - Criar fluxo, blocos (mensagem, pergunta, condição, delay, ação), Meta templates, publicar/testar
13. **Agentes de IA** — *novo*
    - Criar agente, base de conhecimento, ferramentas (create_task, send_template), templates de agente, teste, correção de mensagens, mídia por etapa
14. **Pesquisa de Leads** — *novo*
    - Buscar por CNAE/cidade, filtros IBGE, exportar resultados, enviar para funil
15. **Instagram Scraper** — *novo*
    - Buscar perfis, comentários de post, exportar, importar como contatos
16. **Aquecimento de Chip** — *novo*
    - Pool de contatos, pares de aquecimento, iniciar aquecimento, log de atividades, progresso
17. **Análise (Relatórios)** — *novo*
    - Relatórios de desempenho, score do atendente, exportar PDF, filtros de período
18. **Financeiro** — *novo*
    - Visão geral, integração Asaas, lembretes de cobrança, gestão de devedores
19. **Webhooks / Integrações Make** — *novo*
    - Criar conexão, copiar URL, ver logs, documentação dos eventos
20. **Configurações** — *novo (expandir)*
    - Organização, Equipe e permissões, Fuso horário, Integrações (Google, Meta, Asaas, ElevenLabs), Personalização de campos, Tokens de IA, Assinatura/Plano
21. **Formulários** *(já existe — manter)*
    - **+ adicionar**: Compartilhar link público, ver respostas, integração com funil

## Alterações de código

### 1) `src/data/trainings.ts`
- Adicionar **16 novos `TrainingModule`** (e expandir os 5 existentes onde marcado acima).
- Cada step segue o padrão atual: `id` estável, `title`, `description` (1 parágrafo explicando o fluxo), `buttons[]` (5–10 controles reais com label + descrição), `tips[]` (2–4 dicas).
- Sem `image` nos novos steps (o componente já trata isso e mostra um placeholder discreto, sem quebrar). Você poderá adicionar prints depois colocando em `/public/training/<modulo>/<n>.png` e adicionando a linha `image:`.
- IDs no formato `<modulo>-<n>` (ex.: `funis-1`, `tarefas-2`). Isso garante que o progresso já marcado nos módulos existentes continue válido.

### 2) `src/pages/Treinamentos.tsx`
- Nenhuma mudança estrutural necessária — o componente já renderiza `buttons`, `tips` e trata `image` ausente.
- Pequeno ajuste opcional: quando o módulo não tiver nenhuma imagem em nenhum step, esconder o aviso "Print ainda não disponível" e mostrar só o conteúdo textual (mais limpo enquanto não há prints).

### 3) Sem mudanças em
- Backend / Supabase
- `useTrainingProgress` (continua usando os mesmos IDs)
- Rotas / permissões

## Estimativa de conteúdo
- ~21 módulos × 2–4 steps = **~55 etapas** no total
- Cada etapa: ~6 botões + 2–3 dicas
- Arquivo `trainings.ts` final: ~1500–1800 linhas

## Fora do escopo
- Geração ou solicitação de novos prints (você adiciona depois quando quiser).
- Vídeos por módulo (`videoUrl` continua opcional, sem alteração).
- Sistema de busca dentro dos treinamentos.
- Refator do `Treinamentos.tsx` em componentes menores.

Quer que eu siga assim, ou prefere que eu cubra só um subconjunto dos módulos novos nesta primeira leva (ex.: priorizar Funis, Tarefas, Calendário, Chat Interno, Análise e Aquecimento que você citou)?
