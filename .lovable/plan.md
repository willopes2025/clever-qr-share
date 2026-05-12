## Objetivo
Permitir que um deal "anfitrião" (ex: card da pessoa que fechou o evento) injete valores de seus campos personalizados como UTMs no link do formulário público. Quando o lead preenche o formulário, esses valores caem automaticamente no card do novo lead, sem o lead digitar.

## Fluxo do usuário

1. **No formulário (editor)** — uma nova aba "UTMs / Pré-preenchimento" lista os campos personalizados do form e permite marcar cada um como "preenchível via UTM" + escolher a chave UTM (ex: `utm_local_evento`).
2. **No card do anfitrião** — botão "Gerar link do formulário" (e variável `{{form_link:slug}}` disponível em mensagens/chatbot) que constrói a URL do form anexando UTMs com os valores dos campos do deal anfitrião + `utm_host_deal_id=<id>`.
3. **No chatbot** — ao mover o anfitrião para "Agenda Marcada", o usuário monta o fluxo livremente; basta usar a variável `{{form_link:slug}}` em qualquer nó de mensagem. O motor resolve a variável no contexto do deal atual (anfitrião) e envia já com UTMs.
4. **No submit do formulário público** — a página lê `?utm_*` da URL, mescla com os campos digitados e cria um novo deal no funil configurado, gravando os valores das UTMs nos `custom_fields` correspondentes + `parent_deal_id` apontando para o anfitrião.
5. **No card do novo lead** — seção "Vinculado ao evento de [Nome do anfitrião]" com link para o card pai.

## Detalhes técnicos

### Banco
- `forms.utm_mapping jsonb` — array `[{ field_key, utm_key, source: 'host_deal' | 'host_contact' }]` definido no editor.
- `funnel_deals.parent_deal_id uuid` — FK self-reference, nullable, índice.
- `funnel_deals.source_form_id uuid` — para rastreio.

### Frontend
- **Editor de formulário** (`src/components/forms/...` + `useForms`): nova seção "Pré-preenchimento por UTM" com lista dos campos do form e `<Input>` para `utm_key` (auto-sugerido como `utm_<field_key>`), toggle on/off e seletor de origem (campo do deal anfitrião / contato anfitrião).
- **Card do deal** (painel lateral / kanban): botão "Copiar link do formulário" que abre dialog para escolher qual form usar; gera URL `https://app/.../f/<slug>?utm_host_deal_id=<id>&utm_local_evento=<value>&...`.
- **Variável de template** `{{form_link:<form_slug>}}`: resolver no envio (chatbot/templates) usando o deal de contexto. Implementar no motor de variáveis já existente.
- **Página pública do form** (`PublicFormPage.tsx`): no mount, ler `searchParams`; para cada UTM mapeada, preencher o campo e marcá-lo como hidden/readonly (configurável). Ao submeter, enviar UTMs como parte do payload.

### Edge function
- `submit-public-form` (existente ou novo): aplica `utm_mapping` para gravar valores em `funnel_deals.custom_fields`, define `parent_deal_id = utm_host_deal_id` (validando que o deal existe e pertence à mesma org do form), e cria/atualiza contato.

### Sem mudança no chatbot builder
O chatbot builder já tem nós de mensagem com variáveis dinâmicas; só adicionamos a variável `{{form_link:...}}` ao resolver. O usuário monta o gatilho "ao mover para Agenda Marcada" usando o sistema de automações de etapa já existente, com uma ação de iniciar fluxo de chatbot.

## Fora do escopo
- Atualizar deal existente em vez de criar novo (sempre cria novo lead vinculado).
- Rastreamento de cliques no link (analytics de conversão).
- UTMs vindas de mídia paga (Google/Meta Ads) — escopo é só herdança entre cards.

## Validação
- Criar form de teste com 2 campos UTM (`local_evento`, `endereco`).
- No card de anfitrião com esses campos preenchidos, copiar link → conferir querystring.
- Abrir link em aba anônima → campos vêm preenchidos → submeter → novo deal aparece com `parent_deal_id` correto e `custom_fields` herdados.