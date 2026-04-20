
## Corrigir a visibilidade das mensagens do telefone 6204

### Diagnóstico confirmado
O número **6204** está ativo no backend e os webhooks dele estão chegando normalmente. O problema não é a conexão do número.

O bloqueio atual acontece assim:
1. chega uma mensagem nova do **phone_number_id 1094594580394816** (telefone 6204);
2. o webhook procura uma conversa Meta já vinculada a esse mesmo número;
3. para alguns contatos, só existe uma conversa antiga do mesmo contato ligada a outro número Meta;
4. o código tenta criar uma nova conversa;
5. o banco rejeita a criação por causa da restrição **`UNIQUE(user_id, contact_id)`**;
6. a função interrompe o fluxo e a mensagem não é salva no Inbox.

Foi exatamente isso que aconteceu com o contato **Wil Lopes / 5527999400707**: o webhook recebeu a mensagem do 6204, encontrou o contato, mas falhou ao criar a conversa por conflito de chave única.

### O que vou ajustar
#### 1. Corrigir o roteamento no webhook da Meta
Arquivo:
- `supabase/functions/meta-whatsapp-webhook/index.ts`

Mudança:
- manter a busca prioritária por conversa Meta com o mesmo `meta_phone_number_id`;
- se não existir, procurar uma **conversa Meta já existente do mesmo contato**;
- se encontrar, **reaproveitar essa conversa** e atualizar o `meta_phone_number_id` para o número que realmente recebeu a mensagem (6204);
- **não** reutilizar conversa Evolution;
- só criar conversa nova quando realmente não existir nenhuma conversa Meta/contato compatível.

Isso resolve o erro sem quebrar o modelo atual do sistema, que hoje trabalha com **uma conversa por contato**.

#### 2. Tratar o erro de duplicidade sem perder a mensagem
Ainda no mesmo webhook:
- quando ocorrer erro `duplicate key value violates unique constraint "conversations_user_id_contact_id_key"`, fazer fallback automático:
  - recarregar a conversa existente do contato;
  - atualizar `provider = 'meta'` e `meta_phone_number_id` com o número recebido;
  - continuar salvando a mensagem em vez de abortar.

Assim, mesmo que o conflito aconteça, a mensagem não some mais.

#### 3. Sincronizar a conversa com o número Meta correto
Quando a mensagem inbound vier da Meta:
- garantir que a conversa fique com o `meta_phone_number_id` correto;
- limpar `instance_id` quando necessário para evitar a conversa continuar “presa” a um envio Evolution antigo;
- manter `provider: 'meta'`.

Isso ajuda a interface a mostrar a conversa com o número certo e evita a sensação de que “o número não aparece”.

#### 4. Validar a exibição no Inbox
Depois do ajuste:
- verificar que novas mensagens do **6204** entram normalmente no Inbox;
- confirmar que o rótulo `via Programa Seven / 6204` aparece na lista e na conversa;
- validar especificamente o caso do contato **Wil Lopes**;
- confirmar que conversas Evolution não são sequestradas pelo webhook da Meta.

### Arquivo principal afetado
- `supabase/functions/meta-whatsapp-webhook/index.ts`

### Resultado esperado
Após a correção:
- mensagens recebidas pelo telefone **6204** voltarão a aparecer;
- a conversa passará a refletir o número Meta correto;
- o sistema deixará de perder mensagens por conflito de conversa duplicada;
- o problema continuará resolvido mesmo após desconectar e reconectar o número.

### Detalhe técnico
O bug está na incompatibilidade entre:
- a regra atual do banco: `UNIQUE(user_id, contact_id)`
- e a lógica nova do webhook, que tenta separar a conversa por `meta_phone_number_id`.

Como o sistema hoje ainda é “1 conversa por contato”, a correção mais segura é:
- **reusar a conversa Meta existente do contato**,
- atualizar o número Meta dela,
- e salvar a nova mensagem normalmente.

Isso corrige o 6204 agora sem exigir refatoração estrutural no banco.
