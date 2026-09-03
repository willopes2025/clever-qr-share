# Correção: mensagens que chegam como "Aguardando mensagem" no WhatsApp do cliente

## O que esse erro significa

"Aguardando mensagem. Essa ação pode levar instantes" é a mensagem que o WhatsApp do destinatário mostra quando **recebeu um pacote que não conseguiu descriptografar**. Ou seja: o envio saiu do sistema, a Evolution API respondeu OK, mas o aparelho do cliente não tem a sessão de criptografia correspondente ao endereço para o qual criptografamos a mensagem. Ela nunca é "entregue" de verdade — por isso fica sem os dois tiques.

## Evidência levantada no banco (últimos 3 dias, envios via Evolution)

| Situação do contato | Ficaram travadas em "enviado" | Chegaram (entregue/lida) |
|---|---|---|
| Contato com LID **e** telefone | 969 | 3.115 |
| Contato só com LID (sem telefone) | 94 | 117 |
| Contato só com telefone | 21 | 12 |

Cerca de **1 em cada 4 mensagens nunca recebe confirmação de entrega**, em praticamente todas as instâncias (Mercearia, Vendas2, Soul Muscle, Centro de Saúde, Cobrança Seven). Isso é compatível com o relato de "Aguardando mensagem" — não é problema de uma instância isolada.

## Causa provável (a confirmar na 1ª etapa)

Hoje as conversas chegam pelo novo endereçamento do WhatsApp (`addressingMode: "lid"`, visto nos logs do webhook): o remetente é identificado por um LID e o telefone real vem em `remoteJidAlt`. No envio, porém, o sistema decide o endereço por outra regra:

- se o contato tem telefone válido → envia para `55DDDNUMERO` (endereço de telefone);
- só usa `LID@lid` quando **não** existe telefone.

Resultado: em conversas que o cliente iniciou em modo LID (a grande maioria — 4.084 de 4.148 envios), respondemos por um endereço diferente daquele em que a sessão de criptografia foi estabelecida. Quando as duas sessões divergem, o aparelho não decifra e mostra "Aguardando mensagem".

Fatores agravantes identificados no código de envio:
- o reenvio automático em erro 5xx (`fetchWithRetry`) pode reenviar uma mensagem que a Evolution já tinha processado, provocando dessincronização de chaves;
- não existe nenhum monitoramento: mensagem que fica em "enviado" para sempre não gera alerta nem reenvio.

## Plano de correção

### Etapa 1 — Confirmar a causa (antes de mudar o comportamento de envio)
- Registrar, em cada envio Evolution, qual endereço foi usado (`@lid` ou telefone), o `addressingMode` da última mensagem recebida na conversa e o id retornado.
- Cruzar, após 24h, quais desses envios receberam `DELIVERY_ACK`. Se a taxa de travamento se concentrar nos envios por telefone em conversas LID, a causa está confirmada.

### Etapa 2 — Alinhar o endereço de envio ao da conversa
- Guardar na conversa o modo de endereçamento e o JID exato usados pelo cliente na última mensagem recebida.
- No envio, usar **o mesmo endereço** em que a conversa está ativa: conversa em LID → enviar para `LID@lid`; conversa por telefone → enviar para o telefone. Só cair no telefone quando não houver LID conhecido.
- Manter o telefone real como dado do contato (funil, campanhas, buscas) — muda apenas o destino técnico do envio.

### Etapa 3 — Tornar o envio seguro contra duplicidade
- Não repetir automaticamente o `sendText` quando a Evolution responde 5xx sem corpo conclusivo; em vez disso marcar como "incerto" e conferir o status antes de reenviar.
- Manter os reenvios apenas para falhas de rede em que a requisição comprovadamente não chegou.

### Etapa 4 — Vigilância de entrega ("mensagem não chegou")
- Job periódico que procura mensagens de saída paradas em "enviado" há mais de 10 minutos em horário comercial.
- Marcar essas mensagens visualmente no chat (ícone de alerta "não confirmada") e permitir reenvio com um clique.
- Painel simples com a taxa de confirmação por instância, para detectar cedo instância com sessão degradada.

### Etapa 5 — Validação
- Testes reais em conversa LID e conversa por telefone, conferindo os dois tiques no aparelho do cliente.
- Comparar a taxa de "travadas em enviado" antes e depois nas mesmas instâncias.

## Detalhes técnicos

- Arquivos envolvidos: `supabase/functions/send-inbox-message/index.ts` (montagem do `remoteJid` e `fetchWithRetry`), `supabase/functions/send-inbox-media/index.ts` (mesma regra de endereço), `supabase/functions/receive-webhook/index.ts` (gravar `addressing_mode` e JID de origem), `src/components/inbox/` (indicador de mensagem não confirmada).
- Banco: novas colunas em `conversations` (`addressing_mode`, `remote_jid`) e em `inbox_messages` (`sent_to_jid`, `delivery_check_at`), com GRANTs e políticas seguindo o padrão da organização.
- Novo job agendado (10 em 10 minutos) para a vigilância de entrega.
