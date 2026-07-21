## Objetivo

Duas melhorias no módulo de e-mail:
1. **Anexos** em campanhas, templates e envio avulso (`/email` → Compor).
2. **Editor visual "mala direta"** com blocos prontos (header, imagem, botão CTA, colunas, rodapé) para gerar HTML responsivo sem escrever código.

---

## 1. Anexos

### Storage
- Novo bucket privado `email-attachments` (via `storage_create_bucket`).
- RLS em `storage.objects`: leitura/escrita restrita à organização do usuário (path `<org_id>/<uuid>-<filename>`).
- Limite prático: 10 MB por arquivo, até 5 arquivos por e-mail (limite típico Gmail/SMTP: 25 MB total). Validação no frontend + na edge function.

### Schema
Nova tabela `email_campaign_attachments` (e reutilizar `email_attachments` que já existe para mensagens individuais):
- `id, campaign_id, storage_path, filename, content_type, size_bytes, created_at`
- GRANT + RLS por organização.
- Também aceitar anexos em `email_templates` via nova coluna `attachments jsonb` (lista de `{path, filename, content_type, size}`) para que o template já leve os anexos.

### UI
- **Compor (`/email`)**: botão "Anexar arquivo" que faz upload para `email-attachments` e mostra chips removíveis.
- **Templates**: mesma UI de anexos no `TemplateDialog`.
- **Nova campanha**: mesma UI; se um template for escolhido, herda os anexos e permite adicionar/remover.
- **Detalhe da campanha**: lista de anexos (nome + tamanho + download).

### Envio (edge functions)
- `email-send`, `email-campaign-dispatch`, `email-send-imap`: baixar cada anexo via service role, converter em base64 e:
  - **Gmail**: montar MIME `multipart/mixed` com `buildRawMime` estendido para aceitar `attachments: [{filename, contentType, base64}]`.
  - **Microsoft Graph**: array `attachments` com `@odata.type: #microsoft.graph.fileAttachment`.
  - **SMTP (IMAP)**: `buildSimpleMime` estendido para `multipart/mixed`.
- Erro claro se algum anexo ultrapassar o limite do provedor.

---

## 2. Editor "mala direta"

### Abordagem
Adicionar um **modo Visual** ao lado do modo HTML atual, tanto no `TemplateDialog` quanto no `CreateCampaignDialog`. Não substitui o HTML — gera HTML compatível com clientes de e-mail (tabelas inline, largura máx 600px, sem `<style>` externo).

### Blocos disponíveis
Estrutura JSON persistida em nova coluna `email_templates.design_json jsonb` (e `email_campaigns.design_json jsonb`):
- **Header** — logo + título + subtítulo, cor de fundo configurável.
- **Texto** — parágrafo com formatação básica (bold, itálico, link, `{{variáveis}}`).
- **Imagem** — upload para bucket `email-attachments` (reaproveitado) + alt + link opcional.
- **Botão CTA** — texto, URL, cor, alinhamento.
- **Divisor** — linha horizontal.
- **Colunas 2x** — duas colunas com texto/imagem.
- **Rodapé** — endereço, redes sociais, texto "descadastrar" já inserido pelo sistema.

### Preset "Programa Seven / mala direta"
Um template inicial pronto no botão "Novo template → Usar mala direta" que já traz: header verde da marca, saudação `{{nome}}`, bloco texto, botão CTA, rodapé. Basta editar textos.

### Compilação
Utilitário `compileDesignToHtml(design_json)` em `src/lib/email-design.ts`:
- Renderiza tabelas MSO-safe (usa `<table role="presentation">`, larguras fixas, estilos inline).
- Substitui variáveis `{{...}}` no dispatch (já existe).
- Salva o HTML compilado em `body_html` toda vez que salva (mantém retrocompatibilidade com envios que só olham `body_html`).

### UI
- Dialog em duas abas: **Visual** (drag-list de blocos, painel lateral de propriedades) | **HTML** (mostra o gerado, editável — se editar aqui, entra em "modo avançado" e desativa Visual).
- Preview ao vivo no lado direito (iframe sandbox).
- Bibliotecas: usar apenas Radix + Tailwind existentes; drag com `@dnd-kit/core` (já presente no projeto — confirmar em `package.json` no build).

---

## Rota / permissões / analytics
- Nenhum novo endpoint; tudo passa pelas funções `email-send*` e `email-campaign-dispatch` atualizadas.
- Reaproveita RLS existente (`email_channels`, `email_campaigns`, `email_templates`) já escopadas por org.

## Fora de escopo
- Editor de e-mail transacional (`_shared/transactional-email-templates`) continua em código (é infra).
- Split test A/B, agendamento futuro, tracking de abertura/clique — podem virar plano separado.

## Ordem de implementação
1. Bucket `email-attachments` + RLS.
2. Colunas `attachments`, `design_json` em `email_templates` e `email_campaigns`.
3. UI de anexos (Compor → Templates → Campanha) + edge functions com multipart.
4. `compileDesignToHtml` + preset "mala direta".
5. Aba Visual nos dialogs de template e campanha.

Ao final, o usuário consegue: montar um e-mail visual com blocos, anexar PDF/imagem, salvar como template, disparar em campanha com anexos + variáveis por contato.
