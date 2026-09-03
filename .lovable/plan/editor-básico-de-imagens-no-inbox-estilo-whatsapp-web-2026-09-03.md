# Editor básico de imagens no Inbox (estilo WhatsApp Web)

Adicionar um editor de imagens em tela cheia, aberto a partir da miniatura do anexo, com desenho livre, corte, rotação, texto, formas/setas, cor e espessura, além de desfazer/refazer. Toda a edição acontece no navegador; o upload só acontece quando o usuário clica em Enviar.

## Situação atual

- `MediaUploadButton` faz o upload para o storage **imediatamente** ao selecionar o arquivo e devolve só a URL pública.
- `MessageView` guarda `pendingMedia = { url, type, name }` e mostra a miniatura com um único botão `X`.
- Colar imagem (`handlePasteFiles`) também sobe na hora via `uploadInboxMedia`.

Consequência: hoje não existe arquivo em memória para editar, e cada tentativa de edição geraria um arquivo órfão no storage.

## Etapa 1 — Mudar o anexo pendente para client-side

- Trocar o estado por `pendingMedia = { file: File, previewUrl: string, type, name }`, onde `previewUrl` vem de `URL.createObjectURL(file)` (nunca Base64/DataURL — evita strings gigantes em memória).
- `MediaUploadButton` deixa de subir no `onUpload`: passa a devolver o `File` (mantendo validação de tamanho e a compressão de vídeo, que continua client-side).
- `handlePasteFiles` passa a apenas registrar o `File` colado.
- O upload (`uploadInboxMedia`) migra para dentro do `handleSend`, antes de disparar a mensagem; loading no botão Enviar.
- Revogar o objectURL (`URL.revokeObjectURL`) ao descartar o anexo, ao substituir por uma versão editada e no unmount, para não vazar memória.

## Etapa 2 — Gatilho de edição na miniatura

- Na barra de anexo pendente, ao lado do `X`, adicionar botão de lápis (`Pencil`), visível apenas quando `type === 'image'`.
- Ao clicar, abre o editor em tela cheia com o `File` atual.

## Etapa 3 — Editor em tela cheia

Novo componente `src/components/inbox/image-editor/ImageEditorDialog.tsx` (Dialog do shadcn em modo fullscreen, fundo escuro):

- **Topo:** Cancelar (X) à esquerda; Desfazer / Refazer; Concluir à direita.
- **Barra de ferramentas (lateral direita ou topo, ícones lucide):** Caneta, Texto, Retângulo, Seta, Corte, Rotacionar 90°.
- **Rodapé contextual:** paleta de ~8 cores fixas + slider de espessura (2–24 px) e, no modo texto, tamanho da fonte.
- **Canvas central** ajustado ao viewport com `object-fit: contain`; edições sempre aplicadas nas coordenadas reais da imagem (escala calculada entre canvas exibido e bitmap original).

## Etapa 4 — Modelo de estado e histórico

- Estado = imagem base (`ImageBitmap`) + lista ordenada de operações: `{ type: 'stroke' | 'text' | 'rect' | 'arrow' | 'rotate' | 'crop', ...dados }`.
- Renderização: a cada mudança, redesenhar do zero (base → rotação/crop acumulados → anotações) em um canvas offscreen e copiar para o canvas visível. Redesenho completo mantém undo/redo trivial.
- **Undo/Redo:** dois arrays (`ops`, `redoStack`); desfazer move a última op para o redo; qualquer nova op limpa o redo. Atalhos Ctrl+Z / Ctrl+Shift+Z.
- Corte e rotação entram como operações no mesmo histórico (também são desfazíveis).

## Etapa 5 — Ferramentas

- **Caneta:** pointer events, coleta pontos, desenha com `lineJoin/lineCap = 'round'` e suavização quadrática.
- **Retângulo / Seta:** arrastar para definir início/fim; preview ao vivo em camada temporária; seta = linha + duas linhas da ponta.
- **Texto:** clique posiciona um input flutuante; ao confirmar, vira op `text` (fonte do sistema, cor e tamanho atuais); arrastável antes de confirmar.
- **Corte:** overlay com retângulo redimensionável (8 alças) e escurecimento fora da área; confirmar aplica a op.
- **Rotação:** botão gira 90° no sentido horário, ajustando largura/altura do canvas.

## Etapa 6 — Concluir / Cancelar

- **Concluir:** `canvas.toBlob(blob, 'image/jpeg', 0.92)` (PNG se a origem tiver transparência) → `new File([blob], nomeOriginal)` → substitui o `pendingMedia`, revoga o objectURL antigo e gera um novo. Nada vai ao servidor.
- **Cancelar:** fecha e descarta as ops; o `File` original permanece intacto.
- Reabrir o editor sempre parte do arquivo atualmente pendente (edições são cumulativas entre sessões, o histórico reinicia).

## Etapa 7 — Envio

- No `handleSend`, se houver anexo pendente: subir o `File` (original ou editado) via `uploadInboxMedia`, depois chamar o envio existente com a URL resultante e a legenda digitada. Erro no upload mantém o anexo na miniatura para nova tentativa.

## Detalhes técnicos

- **Sem biblioteca pesada.** Fabric.js (~300 kB) e Konva resolvem, mas o conjunto pedido (traço, texto, retângulo, seta, crop, rotação) cabe em ~400 linhas de Canvas 2D nativo, sem dependência nova, sem conflito com o bundle atual e com controle total do modelo de undo. Se depois surgir necessidade de manipular objetos já desenhados (selecionar/mover/redimensionar anotações antigas), aí sim vale migrar para Fabric.js.
- **Memória:** usar sempre `File`/`Blob` + `URL.createObjectURL`; nunca `FileReader.readAsDataURL` (o preview atual usa DataURL e será removido). Revogar todos os objectURLs criados.
- **Qualidade:** o canvas de trabalho usa as dimensões reais do bitmap (limitadas a 4096 px no maior lado) e `devicePixelRatio` apenas na camada de exibição.
- **Mobile:** pointer events cobrem mouse e toque; `touch-action: none` no canvas.
- Vídeos e documentos continuam sem editor — apenas o botão `X`.

## Arquivos afetados

- Novos: `src/components/inbox/image-editor/ImageEditorDialog.tsx`, `Toolbar.tsx`, `useImageEditor.ts`, `types.ts`, `draw.ts`.
- Alterados: `src/components/inbox/MessageView.tsx` (estado do anexo, miniatura com lápis, upload no envio), `src/components/inbox/MediaUploadButton.tsx` (devolver `File` em vez de URL).
