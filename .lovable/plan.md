
# Plano: Botão de Exportação do Agente de IA

## Objetivo

Adicionar um botão de exportação no card do agente de IA que permite baixar todas as informações do agente nos formatos:
- **TXT (JSON)**: Formato estruturado para backup/importação
- **PDF**: Documento formatado para visualização/impressão
- **Word (DOCX)**: Documento editável para documentação

---

## Dados a Exportar

| Categoria | Campos |
|-----------|--------|
| **Identificação** | Nome do agente, template, status (ativo/inativo) |
| **Personalidade** | Prompt de personalidade, regras de comportamento |
| **Mensagens** | Saudação, despedida, fallback, keywords de handoff |
| **Configurações** | Delay min/max, horário ativo, máx interações, modo de resposta |
| **Emojis** | Emoji de pausa, emoji de retomada |
| **Base de Conhecimento** | Lista de itens (texto, PDFs, URLs) com conteúdo |
| **Variáveis** | Chave, valor e descrição de cada variável |
| **Etapas (Stages)** | Nome da etapa, prompt, condições |
| **Integrações** | Webhooks e APIs configuradas |

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/lib/ai-agent-export.ts` | **CRIAR** - Funções de exportação (JSON, PDF, DOCX) |
| `src/components/ai-agents/AIAgentCard.tsx` | **MODIFICAR** - Adicionar opção de exportação no dropdown |
| `src/components/ai-agents/AIAgentExportDialog.tsx` | **CRIAR** - Dialog para escolher formato de exportação |

---

## Implementação

### 1. Criar Utilitário de Exportação (`src/lib/ai-agent-export.ts`)

```typescript
// Estrutura do arquivo
export interface AgentExportData {
  agent: AIAgentConfig;
  knowledgeItems: KnowledgeItem[];
  variables: AgentVariable[];
  stages: AgentStage[];
  integrations: AgentIntegration[];
}

// Exportar JSON (TXT)
export function exportAgentAsJSON(data: AgentExportData): void {
  // Criar objeto JSON formatado
  // Gerar blob e download como .txt
}

// Exportar PDF
export function exportAgentAsPDF(data: AgentExportData): void {
  // Usar jsPDF (já instalado)
  // Header com nome do agente
  // Seções para cada categoria de dados
  // Footer com data de exportação
}

// Exportar Word (DOCX)
export function exportAgentAsWord(data: AgentExportData): void {
  // Gerar documento com formatting HTML
  // Converter para blob DOCX usando docx library ou HTML
  // Download
}
```

### 2. Criar Dialog de Exportação (`src/components/ai-agents/AIAgentExportDialog.tsx`)

O dialog terá:
- Título: "Exportar Agente"
- Descrição do agente selecionado
- 3 botões de formato (JSON, PDF, Word) com ícones
- Loading state durante busca dos dados relacionados
- Mensagem de sucesso após exportação

### 3. Modificar AIAgentCard.tsx

Adicionar nova opção no DropdownMenu:
```tsx
<DropdownMenuItem onClick={() => setShowExportDialog(true)}>
  <Download className="h-4 w-4 mr-2" />
  Exportar
</DropdownMenuItem>
```

---

## Formato do JSON Exportado

```json
{
  "exportVersion": "1.0",
  "exportedAt": "2026-01-29T10:00:00Z",
  "agent": {
    "name": "SDR Virtual",
    "templateType": "sdr",
    "isActive": true,
    "personalityPrompt": "...",
    "behaviorRules": "...",
    "greetingMessage": "...",
    "goodbyeMessage": "...",
    "fallbackMessage": "...",
    "handoffKeywords": ["humano", "atendente"],
    "responseMode": "text",
    "responseDelayMin": 3,
    "responseDelayMax": 8,
    "activeHoursStart": 8,
    "activeHoursEnd": 20,
    "maxInteractions": 15,
    "pauseEmoji": "🛑",
    "resumeEmoji": "✅"
  },
  "knowledgeBase": [
    {
      "title": "FAQ da Empresa",
      "sourceType": "text",
      "content": "..."
    }
  ],
  "variables": [
    {
      "key": "empresa_nome",
      "value": "TechSolutions",
      "description": "Nome da empresa"
    }
  ],
  "stages": [...],
  "integrations": [...]
}
```

---

## Formato do PDF

```text
┌────────────────────────────────────────────────┐
│  RELATÓRIO DO AGENTE DE IA                     │
│  Nome: SDR Virtual                             │
│  Exportado em: 29/01/2026 10:00                │
├────────────────────────────────────────────────┤
│  CONFIGURAÇÕES GERAIS                          │
│  Status: ✓ Ativo                               │
│  Template: SDR                                 │
│  Modo de resposta: Texto                       │
│  Horário: 08:00 - 20:00                        │
├────────────────────────────────────────────────┤
│  PERSONALIDADE                                 │
│  [texto do prompt]                             │
├────────────────────────────────────────────────┤
│  MENSAGENS                                     │
│  • Saudação: "Olá! Como posso ajudar?"         │
│  • Despedida: "Até mais!"                      │
│  • Fallback: "Não entendi..."                  │
├────────────────────────────────────────────────┤
│  BASE DE CONHECIMENTO (3 itens)                │
│  1. FAQ da Empresa (texto)                     │
│  2. Manual do Produto (PDF)                    │
├────────────────────────────────────────────────┤
│  VARIÁVEIS (2 itens)                           │
│  • {{empresa_nome}}: TechSolutions             │
├────────────────────────────────────────────────┤
│  Página 1 de 1                                 │
└────────────────────────────────────────────────┘
```

---

## Formato Word (DOCX)

O documento Word seguirá estrutura similar ao PDF, mas com:
- Cabeçalho estilizado
- Tabelas para dados estruturados
- Formatação editável
- Seções com títulos destacados

---

## Dependências

O projeto já possui:
- ✅ `jspdf` - Para geração de PDFs
- ✅ `date-fns` - Para formatação de datas

Para Word, utilizaremos HTML Blob convertido para download (não requer biblioteca adicional).

---

## Fluxo do Usuário

1. Usuário clica no menu (⋮) do card do agente
2. Seleciona "Exportar"
3. Dialog abre mostrando nome do agente
4. Usuário escolhe formato: JSON, PDF ou Word
5. Sistema busca dados completos (knowledge, variables, stages, integrations)
6. Arquivo é gerado e download inicia
7. Toast de sucesso é exibido

---

## Resultado Esperado

- Botão de exportação visível no dropdown de cada agente
- 3 formatos de exportação funcionando
- Todos os dados do agente incluídos
- Arquivos bem formatados e legíveis
- Suporte a backup e documentação dos agentes
