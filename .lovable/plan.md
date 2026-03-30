

## Plano: Expandir Chatbot Builder com funcionalidades do Kommo

### Análise Comparativa

**O que já temos:**
- Enviar mensagem ✅, Pergunta ✅, Pausar/Delay ✅, Condição ✅, IA ✅, Início/Fim ✅
- Ações: Adicionar/Remover Tag ✅, Mover no Funil ✅, Definir Variável ✅, Transferir ✅, HTTP Request (webhook) ✅

**O que falta (relevante para o sistema):**

| Recurso Kommo | Prioridade | Tipo |
|---|---|---|
| Definir campo personalizado | Alta | Nova ação |
| Criar lead no funil | Alta | Nova ação |
| Mudar status do lead | Alta | Nova ação |
| Adicionar nota à conversa | Alta | Nova ação |
| Adicionar tarefa | Média | Nova ação |
| Alterar status da conversa | Média | Nova ação |
| Completar tarefas | Média | Nova ação |
| Mudar usuário responsável | Média | Nova ação |
| List Message (WhatsApp) | Alta | Novo nó |
| Validação de input | Média | Novo nó |
| Iniciar outro fluxo | Média | Novo nó |
| Round Robin (distribuir) | Baixa | Novo nó |

### Solução — Fase 1 (prioridade alta)

Implementar em 3 blocos: novos tipos de ação, novo nó List Message e novo nó Validação.

---

#### 1. Novos tipos de Ação (ActionNode)

Adicionar 8 novos subtipos ao nó de Ação existente:

**`src/components/chatbot-builder/ChatbotNodeConfig.tsx`**
- Adicionar opções no Select de `actionType`: `set_field`, `create_lead`, `change_lead_status`, `add_note`, `add_task`, `change_conversation_status`, `complete_tasks`, `change_responsible`
- Criar configuração de formulário para cada tipo:
  - **Definir campo**: Selector de campo personalizado + valor
  - **Criar lead**: Selector de funil + etapa destino
  - **Mudar status do lead**: Selector de funil + nova etapa
  - **Adicionar nota**: Textarea para conteúdo da nota
  - **Adicionar tarefa**: Título + descrição + prazo
  - **Alterar status da conversa**: Selector (aberta/pendente/resolvida)
  - **Completar tarefas**: Toggle para completar todas as tarefas pendentes
  - **Mudar usuário responsável**: Selector de membros da organização

**`src/components/chatbot-builder/nodes/ActionNode.tsx`**
- Adicionar ícones e labels para os novos tipos

**`src/components/chatbot-builder/ChatbotFlowSidebar.tsx`**
- Sem alteração (o nó "Ação" já existe, os subtipos são selecionados na configuração)

---

#### 2. Novo nó: List Message (WhatsApp)

Mensagem interativa com lista de opções (botão que abre um menu de seleção no WhatsApp).

**Novo arquivo: `src/components/chatbot-builder/nodes/ListMessageNode.tsx`**
- Visual com ícone do WhatsApp e preview das opções

**`src/components/chatbot-builder/ChatbotNodeConfig.tsx`**
- Configuração: título, descrição, texto do botão, e lista de seções com itens (título + descrição)
- Cada item gera uma saída (handle) para roteamento condicional

**`src/components/chatbot-builder/ChatbotFlowSidebar.tsx`**
- Adicionar na categoria "Mensagens"

**`src/components/chatbot-builder/ChatbotFlowEditor.tsx`**
- Registrar novo nodeType

---

#### 3. Novo nó: Validação

Valida a resposta do usuário (formato de email, telefone, CPF, número, texto não vazio) antes de prosseguir.

**Novo arquivo: `src/components/chatbot-builder/nodes/ValidationNode.tsx`**
- Visual verde com ícone de check

**`src/components/chatbot-builder/ChatbotNodeConfig.tsx`**
- Configuração: variável a validar, tipo de validação (email, telefone, CPF, número, não vazio, regex customizado), mensagem de erro
- Duas saídas: "Válido" e "Inválido"

---

#### 4. Novo nó: Iniciar outro Fluxo

Permite encadear fluxos, disparando outro chatbot a partir do atual.

**Novo arquivo: `src/components/chatbot-builder/nodes/SubFlowNode.tsx`**
- Selector do fluxo a ser disparado

---

#### 5. Novo nó: Round Robin

Distribui a conversa entre membros da equipe de forma rotativa.

**Novo arquivo: `src/components/chatbot-builder/nodes/RoundRobinNode.tsx`**
- Configuração: lista de usuários participantes do rodízio

---

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `ChatbotNodeConfig.tsx` | Adicionar configs para 8 novas ações + 3 novos nós |
| `ActionNode.tsx` | Novos ícones e labels |
| `ChatbotFlowSidebar.tsx` | 4 novos nós na sidebar |
| `ChatbotFlowEditor.tsx` | Registrar 4 novos nodeTypes |
| `nodes/ListMessageNode.tsx` | **Novo** |
| `nodes/ValidationNode.tsx` | **Novo** |
| `nodes/SubFlowNode.tsx` | **Novo** |
| `nodes/RoundRobinNode.tsx` | **Novo** |

### Observação

Esta fase cobre apenas o **frontend** (editor visual). A execução real dos novos nós no motor (`execute-chatbot-flow`) será implementada em uma fase posterior, pois cada novo tipo precisa de lógica de backend específica. O editor já ficará completo para o usuário montar fluxos com todos os recursos.

### Impacto
- Nenhuma alteração de banco de dados nesta fase
- 4 novos arquivos + 4 arquivos modificados
- Paridade funcional com o Kommo no editor visual

