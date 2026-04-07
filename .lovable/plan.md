

## Wil Assistant com Ferramentas de Execução (Tool Calling)

### Problema Atual
O Wil é apenas um chatbot de perguntas e respostas. Ele não pode executar nenhuma ação no sistema — apenas responde dúvidas.

### Solução
Transformar o Wil em um agente com **tool calling** (chamada de ferramentas), permitindo que ele execute ações reais no sistema do usuário via funções definidas. O modelo de IA receberá uma lista de ferramentas disponíveis e decidirá quando usá-las com base na conversa.

### Ferramentas Disponíveis (Fase 1)

| Ferramenta | Descrição |
|---|---|
| `create_automation` | Cria automação em um funil (trigger + ação) |
| `list_funnels` | Lista funis e etapas do usuário |
| `list_broadcast_lists` | Lista as listas de transmissão |
| `create_broadcast_list` | Cria lista de transmissão (manual ou dinâmica) |
| `list_contacts` | Busca contatos com filtros (tag, nome, telefone) |
| `list_templates` | Lista templates de mensagem disponíveis |
| `create_campaign` | Cria uma campanha de disparo |
| `list_instances` | Lista instâncias WhatsApp conectadas |
| `list_automations` | Lista automações existentes de um funil |
| `list_tags` | Lista tags disponíveis |

### Arquitetura Técnica

```text
Usuário → Wil Chat → Edge Function (wil-assistant)
                            │
                            ▼
                    OpenAI API (gpt-4.1-nano)
                    com tools[] definidas
                            │
                            ▼
                    Se tool_call retornado:
                      → Executa no Supabase (service role)
                      → Retorna resultado ao modelo
                      → Modelo gera resposta final
                            │
                            ▼
                    Stream da resposta para o frontend
```

### Mudanças

**1. Edge Function `wil-assistant/index.ts`** (principal mudança)
- Adicionar definições de `tools` no formato OpenAI para cada ferramenta
- Implementar loop de tool calling: quando o modelo retorna `tool_calls`, executar cada ferramenta no Supabase usando service role key, enviar resultados de volta ao modelo, e continuar até obter resposta final em texto
- Cada ferramenta será uma função que executa queries/inserts no Supabase
- O streaming será mantido para a resposta final de texto

**2. Frontend `useWilAssistant.ts`**
- Nenhuma mudança estrutural necessária — o streaming e a interface permanecem iguais
- O tool calling acontece inteiramente no backend; o frontend recebe apenas a resposta final em texto

**3. System prompt atualizado**
- Adicionar instruções sobre quando usar cada ferramenta
- Orientar o Wil a sempre confirmar com o usuário antes de executar ações destrutivas ou de criação
- Instruir a listar opções (funis, templates, etc.) antes de criar recursos

### Segurança
- Todas as operações são filtradas por `userId` — o Wil só acessa dados do próprio usuário
- Service role key é usada apenas no backend
- O Wil não pode alterar código, apenas manipular dados via Supabase client
- Ações de criação pedem confirmação ao usuário antes de executar

### Fluxo de Exemplo
1. Usuário: "Cria uma automação que quando o lead entrar no funil X, mova ele pra etapa Y"
2. Wil chama `list_funnels` → obtém funis e etapas
3. Wil chama `create_automation` com os parâmetros corretos
4. Wil responde: "Automação criada com sucesso no funil X!"

