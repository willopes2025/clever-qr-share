## Objetivo

Transformar todas as etapas da aba **Treinamentos** em explicações **passo a passo no formato imperativo**, com **palavras-chave em negrito** (botões, telas, ações). Exemplo do estilo desejado:

> Para conectar uma instância, clique em **Instâncias** no menu lateral. Abrirá um **popup**. Em seguida, clique em **Nova instância**, digite o **nome**, escolha o **tipo** e aperte **Salvar**. Aguarde o **QR Code** e escaneie pelo WhatsApp em **Aparelhos conectados → Conectar um aparelho**.

## O que será alterado

### 1. Renderização com negrito (`src/pages/Treinamentos.tsx`)
Hoje a descrição é renderizada como texto simples (`whitespace-pre-line`), então `**negrito**` apareceria literal. Vou:
- Criar uma função utilitária `renderRichText(text)` que escapa HTML e converte `**xxx**` em `<strong>` (sem dependência externa, mesmo padrão já usado no `WhatsNewDialog`).
- Aplicar essa função no `<p>` da descrição da etapa.
- Suportar também quebras de linha em listas numeradas (`1.`, `2.`, `3.`) para virar uma `<ol>` quando a descrição for uma sequência de passos — opcional, sem mudar visual do resto.

### 2. Reescrita do conteúdo (`src/data/trainings.ts`)
Reescrever a `description` de **cada etapa** de todos os módulos no formato:

- Frase de contexto curta (1 linha).
- Sequência numerada de passos imperativos: "Clique em **X**…", "Abrirá um **popup**…", "Preencha o **campo Y**…", "Aperte **Salvar**".
- Negrito sempre em: nomes de botões, nomes de telas/abas, nomes de campos, atalhos e termos de ação.

Módulos cobertos (ordem atual mantida):
1. Primeiros passos (4 etapas)
2. Instâncias (3 etapas)
3. Inbox (3 etapas)
4. Funis (2 etapas)
5. Contatos (2 etapas)
6. Listas de transmissão (1 etapa)
7. Templates (1 etapa)
8. Campanhas (2 etapas)
9. Calendário (2 etapas)
10. Tarefas (1 etapa)
11. Chat interno (1 etapa)
12. Chatbots (1 etapa)
13. AI Agents (1 etapa)
14. Pesquisa de leads (2 etapas)
15. Aquecimento (1 etapa)
16. Análise (1 etapa)
17. Financeiro (2 etapas)
18. Webhooks (1 etapa)
19. Configurações (2 etapas)
20. Formulários (2 etapas)

Os blocos `buttons` e `tips` permanecem como estão (já cumprem outra função: mapa visual e dicas).

## O que NÃO muda
- Estrutura de tipos (`TrainingStep`, `TrainingModule`).
- IDs das etapas (manter progresso já salvo dos usuários).
- Layout, cards, vídeo, checkboxes, sidebar e demais módulos do sistema.

## Detalhes técnicos

`renderRichText` em `Treinamentos.tsx`:
```ts
function renderRich(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong class=\"text-foreground font-semibold\">$1</strong>");
  return { __html: escaped };
}
```
Uso: `<p ... dangerouslySetInnerHTML={renderRich(step.description)} />`. Como o input vem de arquivo fonte controlado (não de usuário), o uso de `dangerouslySetInnerHTML` é seguro.

## Confirmação antes de executar

A reescrita é extensa (~30 etapas). Vou manter o tom atual (didático, em português, sem emojis) e o mesmo nível de detalhe — só mudando para o **formato imperativo numerado com negrito**.