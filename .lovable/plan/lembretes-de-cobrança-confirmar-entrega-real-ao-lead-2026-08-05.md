# Lembretes de cobrança: confirmar entrega real ao lead

## O que foi verificado

A mensagem da imagem (R$ 125,00, vencimento 31/07/2026, "Último lembrete") existe e foi processada:

- Lembrete `after_5d`, agendado 05/08 13:00 UTC, marcado como **enviado** às 13:00:26 UTC (10:00 no horário local).
- Canal: número Meta **+55 27 99824-6204** (Seven Ótica), status conectado, qualidade GREEN.
- Toda a trilha do mesmo boleto saiu: `due_day` (31/07), `after_1d` (01/08), `after_3d` (03/08) e `after_5d` (05/08).
- Os 6 templates `cobranca_*` estão aprovados na Meta em pt_BR.

## Problema encontrado

Nenhuma dessas mensagens tem `whatsapp_message_id` gravado, e `delivered_at`/`read_at` estão vazios em todas elas. A função de disparo confirma apenas que a Meta respondeu HTTP 200 e descarta o ID retornado. Como os webhooks de status da Meta casam pelo ID da mensagem, nada nunca atualiza para "entregue"/"lido".

Consequência: hoje é impossível afirmar que o lead recebeu — só que a Meta aceitou o envio. Mensagens enviadas pela caixa de entrada (que gravam o ID) aparecem corretamente como "entregue".

Um efeito colateral relacionado: quando o envio falha, o `error_message` fica gravado mas o registro pode ser reenviado depois e marcado como "enviado" sem limpar o erro antigo (foi o caso do `before_5d` de 26/07, com erro de permissão e reenvio bem-sucedido em 27/07).

## Correção proposta

Em `supabase/functions/process-billing-reminders/index.ts`:

1. Capturar o `messages[0].id` da resposta da Meta nos dois caminhos de envio (template e texto de fallback) e também o ID retornado pela Evolution.
2. Gravar esse ID em `inbox_messages.whatsapp_message_id` ao inserir a mensagem, para que os webhooks de status atualizem `delivered_at`/`read_at` normalmente.
3. Ao marcar o lembrete como `sent`, limpar `error_message` de tentativas anteriores.
4. Registrar em log o ID da mensagem por lembrete, facilitando auditoria futura.

Nenhuma mudança de template, texto ou agendamento — apenas rastreabilidade da entrega.
