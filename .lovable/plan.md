## Problema

O PDF chegava sem nome/extensão e sem mimetype, então o WhatsApp não abria. Isso já foi corrigido em dois lugares (inbox e campanhas), mas os demais fluxos de envio ainda podem repetir o erro.

Estado atual verificado nas funções de envio:

| Fluxo | Nome do arquivo | Mimetype |
|---|---|---|
| Inbox (`send-inbox-media`) | OK | OK |
| Campanhas (`send-campaign-messages`) | OK | OK |
| Relatórios (`dispatch-buyer-reports`, `send-scheduled-analysis`) | OK (fixo .pdf) | OK |
| Chatbot — mídia de nó (`execute-chatbot-flow`, Evolution) | só se vier `filename`, sem validar extensão | ausente |
| Chatbot — mídia de nó (Meta) | só se vier `filename` | n/a |
| Chatbot — mídia de template (Evolution e Meta) | **ausente** (nenhum `fileName`/`filename`) | ausente |
| Agente IA de campanha (`ai-campaign-agent`, mídia de estágio) | usa `m.name` (nome livre, geralmente sem extensão) | ausente |
| Agente IA — template com mídia | usa `media_filename` quando existe, senão nada | ausente |

Ou seja: o mesmo bug volta a acontecer em chatbot e nos disparos do agente de IA.

## O que fazer

1. **Criar helper compartilhado** `supabase/functions/_shared/media-filename.ts`, extraindo a lógica que já funciona no inbox:
   - `resolveDocName({ fileName, caption, url })` — usa o nome informado, senão o nome do arquivo na URL, senão `documento`; sanitiza e **garante extensão** (deduz pela URL, ou `.pdf` como padrão).
   - `resolveDocMime(name)` — mapa de extensões (pdf, doc/docx, xls/xlsx, ppt/pptx, txt, csv, zip…) com fallback `application/octet-stream`.

2. **Aplicar o helper nos pontos que ainda não têm**:
   - `execute-chatbot-flow`: no `sendMediaMessage` (Evolution: `fileName` + `mimetype`; Meta: `document.filename`) e no envio de mídia de template (ambos os provedores) — hoje sem nome nenhum.
   - `ai-campaign-agent`: envio de mídia de estágio (`m.name` → nome com extensão derivada de `media_url`/`mime_type`, + `mimetype`) e envio de mídia de template (`media_filename` com fallback pela URL, + `mimetype`).

3. **Refatorar** `send-inbox-media` e `send-campaign-messages` para usarem o mesmo helper, removendo as cópias duplicadas da lógica (mesmo comportamento, uma fonte só).

4. **Deploy** das funções alteradas: `send-inbox-media`, `send-campaign-messages`, `execute-chatbot-flow`, `ai-campaign-agent`.

## Detalhes técnicos

- Para a Evolution API, documentos exigem `mediatype: "document"` + `fileName` (com extensão) + `mimetype`.
- Para a Meta Cloud API, `document.filename` é o que define o nome exibido; sem ele o app mostra um arquivo genérico.
- Quando o registro tiver `mime_type` salvo (biblioteca de mídia do agente), ele tem prioridade sobre o mapa de extensões.
- Sem mudanças de banco e sem mudanças de UI.
