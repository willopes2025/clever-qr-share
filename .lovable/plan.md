

## Análise da IA — Studio Aline Galacha

### Estado Atual

A IA "Assistente da Aline Galacha" está configurada mas **desativada** (`is_active: false`). Analisando os dados:

**Pontos positivos:**
- Prompt de personalidade bem escrito (tom acolhedor, linguagem de WhatsApp)
- Regras de handoff claras (passar para humano quando quer agendar unhas, fechar curso)
- Delay entre respostas configurado (8-30s) para parecer natural
- Mensagem de saudação e despedida configuradas

**Problemas encontrados:**

1. **Base de conhecimento com URLs vazias** — As duas URLs de landing page (`landingpage.alinegalacha.com.br` e `curso-profissional-nail--j4jm3qj.gamma.site`) têm `processed_content` vazio. A IA não aprendeu nada dessas páginas.

2. **Informações duplicadas** — "Valor da manutenção" aparece 2x como item de conhecimento separado.

3. **Falta informação sobre o curso** — Só tem o preço (10x R$175 ou R$1.500 à vista). Não tem: conteúdo dos módulos, duração, formato (online/presencial), certificado, diferenciais, depoimentos, próximas turmas.

4. **Fluxo de estágios incompleto** — Só existe 1 estágio ("Coletar Motivação") e não é final. Não há estágios de apresentação do curso, quebra de objeções, ou direcionamento para matrícula.

5. **Lógica de agendamento de unhas incompleta** — A regra diz "passar para humano", mas não instrui a IA a informar que "vai passar a informação para a Aline agendar".

### Plano de Melhorias

**1. Reprocessar URLs da base de conhecimento**
- Reexecutar o processamento das 2 URLs para extrair conteúdo real das landing pages
- Se as URLs estiverem fora do ar, remover e adicionar conteúdo manualmente

**2. Enriquecer a base de conhecimento**
- Adicionar item com detalhes do curso: módulos, duração, formato, certificado, público-alvo
- Adicionar item com diferenciais da Aline (experiência, resultados de alunas)
- Adicionar item com FAQ (dúvidas frequentes sobre o curso)
- Remover o item duplicado de "Valor da manutenção"

**3. Ajustar o prompt de personalidade e regras**
- Adicionar instrução explícita: quando o assunto for agendamento de unhas/manutenção, a IA deve responder algo como "Vou passar sua informação para a Aline agendar seu horário, tá bom? 😊" e fazer o handoff
- Reforçar que a IA deve saber responder sobre o curso com segurança usando a base de conhecimento
- Adicionar instrução para coletar nome e horário preferido antes de fazer handoff de agendamento

**4. Completar o fluxo de estágios**
- Estágio 1: Identificação (rapport + entender se quer curso ou serviço de unhas)
- Estágio 2: Qualificação (já trabalha na área? Experiência?)
- Estágio 3: Apresentação do curso (benefícios, preço, formato)
- Estágio 4: Quebra de objeções
- Estágio 5: Direcionamento (handoff para Aline fechar)

**5. Ativar a IA**
- Após as melhorias, ativar (`is_active: true`)

### Detalhes técnicos

- Atualizações no `ai_agent_configs`: campo `personality_prompt` e `behavior_rules`
- Novos registros em `ai_agent_knowledge_items` com `source_type: text`
- Novos registros em `ai_agent_stages` com estágios encadeados
- Remoção do item de conhecimento duplicado (id: `c31df066...`)
- Reprocessamento das URLs via edge function `process-knowledge-url`

