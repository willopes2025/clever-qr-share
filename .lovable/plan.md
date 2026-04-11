

## Plano: Melhorar visualização de mensagens de localização no WhatsApp

### Problema
Quando um contato envia uma localização pelo WhatsApp, o sistema salva apenas o texto `[Localização: -23.xxx, -46.xxx]` e exibe como texto simples. Não há visualização amigável.

### Solução
Transformar mensagens de localização em um componente visual com miniatura de mapa (Google Static Maps ou OpenStreetMap) e link clicável para abrir no Google Maps, além de exibir o endereço quando disponível.

### Alterações

**1. Edge Function `meta-whatsapp-webhook/index.ts`**
- Enriquecer o conteúdo da mensagem de localização para incluir JSON com latitude, longitude, nome e endereço (dados já fornecidos pela API do WhatsApp)
- Formato: `{"type":"location","latitude":-23.5,"longitude":-46.6,"name":"Local","address":"Rua X"}`

**2. Componente `MessageBubble.tsx`**
- Adicionar tratamento para `message_type === 'location'`, similar ao que já existe para `contact`
- Parsear o conteúdo JSON da localização
- Renderizar:
  - Miniatura do mapa via imagem estática do OpenStreetMap (sem API key)
  - Nome do local e endereço (quando disponíveis)
  - Botão "Abrir no Google Maps" clicável
- Fallback: para mensagens antigas com formato texto `[Localização: lat, lng]`, extrair coordenadas via regex e exibir o mesmo componente

### Detalhes técnicos
- Miniatura via `https://staticmap.openstreetmap.de/staticmap.php?center=LAT,LNG&zoom=15&size=300x200&markers=LAT,LNG,red-pushpin`
- Link: `https://www.google.com/maps?q=LAT,LNG`
- Sem necessidade de API key externa
- Sem alteração de schema do banco

