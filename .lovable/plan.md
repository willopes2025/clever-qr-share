Diagnóstico confirmado até agora:

- O CRM recebeu webhooks do número `+55 27 99633-7685` depois das 03:11, então a conexão Meta → CRM não está totalmente parada.
- Após 03:11 entraram apenas eventos de status de mensagem enviada (`sent`/`delivered`) e um evento administrativo de atualização de nome do número.
- Nenhuma mensagem inbound nova desse número chegou ao webhook depois de 03:11.
- O webhook está respondendo `200` e registrando `signature_valid=true` para os eventos recebidos.
- O envio outbound pelo CRM para esse número funcionou às 11:02 e foi entregue.
- A integração do número está ativa no banco, com token salvo e `phone_number_id = 1185575587976124`.

Plano:

1. Verificar o cadastro do webhook do Meta no código atual
   - Conferir se o endpoint usado pela Meta é o `meta-whatsapp-webhook` correto.
   - Confirmar se o webhook está preparado para registrar eventos administrativos e mensagens do mesmo WABA/phone number.

2. Melhorar o diagnóstico interno do webhook
   - Ajustar o log de eventos `account_update`, `phone_number_name_update` e outros eventos administrativos para tentar extrair o WABA/telefone e vincular ao número correto quando possível.
   - Isso facilita provar se a Meta está chamando o CRM mesmo quando não manda `messages`.

3. Criar uma verificação de saúde por número Meta
   - Mostrar no sistema/diagnóstico: última mensagem inbound, último status outbound, último evento administrativo, status HTTP do webhook e eventuais erros.
   - Para esse caso, deve ficar claro: webhook OK, outbound OK, inbound ausente desde 03:11.

4. Se necessário, ajustar o webhook para casos de payload incompleto
   - Se houver evento de mensagem sem `metadata.phone_number_id`, usar fallback por WABA/integração para não perder mensagem.
   - Manter segurança: não rejeitar eventos válidos por falta de metadado quando for possível associar com segurança.

5. Validar depois da implementação
   - Consultar novamente os eventos do número.
   - Confirmar se novos eventos aparecem vinculados corretamente.
   - Se ainda não houver inbound, a evidência final será que a Meta não está entregando mensagens inbound ao endpoint, apesar do endpoint estar ativo.