

## Enviar Formulario Rastreavel pelo Inbox

### O que sera feito

Adicionar um botao na barra de ferramentas do chat (MessageView) que permite selecionar um formulario existente, gerar um link rastreavel com os dados do lead pre-vinculados, e enviar esse link diretamente na conversa. Quando o lead preencher o formulario, os dados serao automaticamente associados ao contato/lead existente.

### Como funciona o fluxo

1. O usuario clica no botao de formulario (icone de documento) na toolbar do chat
2. Um dialog abre listando os formularios publicados do usuario
3. O usuario seleciona um formulario
4. O sistema gera um link com parametros estaticos ocultos: `contact_id` e `conversation_id` do lead atual
5. O link e uma mensagem customizavel sao inseridos no campo de texto (ou enviados diretamente)
6. Quando o lead submete o formulario, o `submit-form` Edge Function ja recebe o `contact_id` via parametros estaticos, vinculando automaticamente os dados ao contato

### Alteracoes

**1. Novo componente: `src/components/inbox/FormLinkButton.tsx`**
- Botao com icone `FileText` que abre um Dialog/Popover
- Lista formularios publicados do usuario (usando `useForms`)
- Ao selecionar, gera o link: `/form/{slug}/contact_id={id}/conversation_id={id}`
- Campo editavel com mensagem padrao (ex: "Preencha este formulario: {link}")
- Botao para inserir no campo de mensagem ou copiar o link

**2. Atualizar `src/components/inbox/MessageView.tsx`**
- Importar e adicionar o `FormLinkButton` na toolbar de entrada de mensagem (ao lado do MediaUploadButton e EmojiPicker)
- Passar `conversation.contact_id` e `conversation.id` como props

**3. Atualizar `supabase/functions/submit-form/index.ts`**
- Na logica de busca/criacao de contato, verificar se existe um `_static_contact_id` nos parametros
- Se existir, usar diretamente esse `contact_id` ao inves de criar/buscar um novo contato
- Atualizar os dados do contato existente com as informacoes do formulario (nome, email, campos customizados)
- Se houver `_static_conversation_id`, salvar no metadata da submissao para rastreabilidade

### Detalhes tecnicos

- O link usa o formato de parametros estaticos ja existente (`/form/slug/key=value/key=value`) que o `public-form` Edge Function ja processa e envia como `_static_` prefixed fields ao `submit-form`
- O `submit-form` ja separa campos `_static_*` dos dados normais (linhas 67-76 do codigo atual), entao o `contact_id` chegara como `staticParams.contact_id`
- A prioridade sera: se `staticParams.contact_id` existir e for um UUID valido, usar diretamente; caso contrario, seguir o fluxo normal de busca por telefone/email
- Formularios com `target_funnel_id` configurado continuarao criando deals normalmente, agora vinculados ao contato correto

