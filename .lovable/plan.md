

## Corrigir exclusão de instância e mensagens "aguardando mensagem" — cliente Gonçalves Dias

### Diagnóstico confirmado

**1. Não consegue excluir "Disparo Fevereiro 2026"**
A função `delete-instance` está falhando por **chave estrangeira não tratada**:
```
update or delete on table "whatsapp_instances" violates foreign key constraint
"inbox_messages_sent_via_instance_id_fkey" on table "inbox_messages"
```
A instância tem **429 mensagens** em `inbox_messages` apontando para ela. O código atual só limpa `campaigns` e `organizations`, mas não limpa as outras tabelas que referenciam `whatsapp_instances`:
- `inbox_messages.sent_via_instance_id` (429 registros)
- `conversations.instance_id`
- `chatbot_flows.instance_id`
- `team_member_instances.instance_id`
- `warming_activities`, `warming_pool`, `warming_schedules`
- `notification_preferences.notification_instance_id`

Além disso, na Evolution API a instância **já não existe** (`404 Not Found`), então sobrou só lixo no banco.

**2. "Aguardando mensagem. Essa ação pode levar alguns instantes"**
Essa mensagem aparece no celular do **destinatário** quando o WhatsApp dele recebe um pacote criptografado mas **não consegue descriptografar** porque a sessão Signal/Baileys do remetente está quebrada ou as pré-chaves se esgotaram. Sintomas que confirmam:
- A Evolution responde "instância não existe" para "Disparo Fevereiro 2026", mas mensagens recentes ainda foram marcadas como `sent` por outras instâncias.
- As instâncias `Kollaborah mkt01/02/03` aparecem como `connected` no banco mas **sem `phone_number`** — sinal de sessão dessincronizada.
- Mensagens saem do CRM com sucesso (status `sent`), mas o destinatário recebe o placeholder de criptografia.

### O que vou ajustar

#### Parte 1 — Corrigir `delete-instance` (resolve a exclusão de vez)

Arquivo: `supabase/functions/delete-instance/index.ts`

Antes do `DELETE` da `whatsapp_instances`, limpar **todas** as referências:

1. `inbox_messages` → `UPDATE SET sent_via_instance_id = NULL WHERE sent_via_instance_id = :id` (preserva o histórico das mensagens, só desvincula)
2. `conversations` → `UPDATE SET instance_id = NULL WHERE instance_id = :id`
3. `chatbot_flows` → `UPDATE SET instance_id = NULL WHERE instance_id = :id`
4. `team_member_instances` → `DELETE WHERE instance_id = :id`
5. `warming_activities`, `warming_pool`, `warming_schedules` → `DELETE WHERE instance_id = :id`
6. `notification_preferences` → `UPDATE SET notification_instance_id = NULL WHERE notification_instance_id = :id`
7. Já existentes (manter): `campaigns.instance_id`, `campaigns.instance_ids[]`, `organizations.notification_instance_id`

Tratar Evolution API `404` como sucesso (instância já não existe lá).

#### Parte 2 — Forçar limpeza imediata da instância "Disparo Fevereiro 2026"

Executar manualmente as mesmas limpezas + delete para destravar o cliente agora:
- 429 `inbox_messages` desvinculadas (histórico preservado)
- demais referências limpas
- registro de `whatsapp_instances` removido

#### Parte 3 — Tratar o "aguardando mensagem" do destinatário

Causa raiz: sessão Signal das instâncias `Kollaborah mkt01/02/03` está com pré-chaves dessincronizadas (instâncias marcadas `connected` mas sem `phone_number` no banco — webhook `connection.update` nunca confirmou o número).

Plano operacional (ações que o cliente precisa executar no aparelho + apoio técnico):

1. **Recarregar pré-chaves via Evolution API** — chamar `POST /chat/updateSessions/<instance>` (endpoint da Evolution que regenera pré-chaves Signal) para cada uma das três instâncias. Vou criar uma Edge Function utilitária `refresh-instance-session` para disparar isso pela UI.
2. **Botão "Recarregar sessão" no card da instância** — no `WhatsAppInstanceCard`, ao lado de "Ver QR Code"/lixeira, adicionar ação que chama essa nova função. Útil sempre que o cliente reportar "aguardando mensagem".
3. **Forçar atualização de `phone_number` e `profile_name`** — após `refresh`, chamar `GET /instance/fetchInstances` da Evolution e gravar `phone_number`/`profile_name` no banco. Hoje esses campos estão `NULL`, o que confirma sessão parcialmente quebrada.
4. **Recomendação ao cliente**: se após o "Recarregar sessão" o destinatário ainda ver "aguardando mensagem", desconectar o WhatsApp do aparelho (Aparelhos conectados → Sair) e ler o QR novamente. Isso recria a sessão Signal do zero e elimina o problema de descriptografia.

### Arquivos afetados

- `supabase/functions/delete-instance/index.ts` — limpeza completa de FKs antes do delete
- `supabase/functions/refresh-instance-session/index.ts` — **novo**, regenera sessão Signal e atualiza metadados
- `src/components/whatsapp/WhatsAppInstanceCard.tsx` (ou equivalente) — botão "Recarregar sessão"
- Operação manual no banco para destravar a instância "Disparo Fevereiro 2026" agora

### Resultado esperado

- Cliente conseguirá excluir qualquer instância sem erro 23503, mesmo com milhares de mensagens no histórico.
- A instância "Disparo Fevereiro 2026" será removida imediatamente.
- O cliente terá um botão para recarregar a sessão Signal das instâncias `Kollaborah` e parar de gerar o "aguardando mensagem" no destinatário.
- Caso a sessão esteja completamente perdida, o caminho de reconexão (sair do aparelho + ler QR de novo) está documentado.

