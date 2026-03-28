

## Template com modo IA dinâmico — mensagens únicas por contato no envio

### O que muda

Hoje o "Gerar com IA" no template cria uma mensagem estática uma vez. O que você quer é diferente: o template armazena um **prompt de IA**, e a cada disparo da campanha, a IA gera uma mensagem **única e personalizada** para cada contato, lendo os dados do lead (campos personalizados, etapa do funil, histórico de conversa) — igual ao modo "Mensagem IA" das oportunidades.

### Alterações

**1. Migração: adicionar campo `ai_prompt` na tabela `message_templates`**
- Novo campo `ai_prompt TEXT NULL` — quando preenchido, indica que o template é do tipo IA dinâmico
- O campo `content` existente continua para templates normais (texto estático com variáveis)

**2. Editar `src/components/templates/TemplateFormDialog.tsx`**
- O botão "Gerar com IA" (estático) fica como está para quem quer gerar uma vez
- Adicionar um **switch "Modo IA Dinâmico"** — quando ativado:
  - O campo de conteúdo vira somente leitura com texto explicativo ("A IA gerará mensagens únicas para cada contato no momento do disparo")
  - Mostra um textarea para o **prompt de instrução da IA** (o que a IA deve considerar ao gerar)
  - Mostra as variáveis e dados disponíveis (campos de contato, lead, histórico de conversa)
  - Salva o prompt no campo `ai_prompt` do template
- O campo `content` recebe um texto placeholder tipo "[Mensagem gerada por IA]" para identificação

**3. Editar `supabase/functions/start-campaign/index.ts`**
- Na seção de templates internos (linha ~674-714), detectar se o template tem `ai_prompt` preenchido
- Se sim: em vez de usar o `content` estático, chamar a OpenAI para cada contato (em batches), passando:
  - Dados do contato (nome, telefone, email, custom_fields)
  - Dados do deal/lead se o contato estiver em um funil (etapa, valor, campos do deal)
  - Últimas 20 mensagens da conversa (se houver)
  - O prompt de instrução do template (`ai_prompt`)
- Usar tool calling (igual `generate-opportunity-messages`) para gerar mensagens estruturadas
- Processar em batches de 10 contatos para não estourar limites da API

**4. Editar `src/hooks/useMessageTemplates.ts`**
- Adicionar `ai_prompt` ao tipo `MessageTemplate` e `CreateTemplateData`
- Incluir no select/insert/update queries

**5. Exibição na lista de templates**
- Templates com `ai_prompt` mostram um badge "IA Dinâmica" para diferenciá-los dos estáticos

### Fluxo
```text
Criação:
  Usuário ativa "Modo IA Dinâmico" → Escreve prompt de instrução
  → Seleciona variáveis/dados que a IA deve considerar
  → Salva template com ai_prompt preenchido

Disparo (start-campaign):
  Detecta template.ai_prompt → Para cada contato:
    → Busca dados do contato + deal + conversa
    → Chama OpenAI com prompt + contexto
    → Gera mensagem única personalizada
    → Insere em campaign_messages
```

### Resultado
Templates com modo IA dinâmico geram mensagens únicas para cada contato no momento do disparo, considerando todo o contexto do lead — exatamente como funciona o "Mensagem IA" nas oportunidades, mas disponível para qualquer campanha.

