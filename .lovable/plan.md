
## Corrigir 3 problemas de uma vez: lista de funis, datas do popup e números no “Nova Conversa”

### 1) Coluna Telefone no formato de lista dos funis
Ajustar a tabela de `FunnelListView` para o campo telefone ter largura mínima própria e não ficar cortado quando houver muitas colunas.

**O que será feito**
- Criar largura específica por coluna na listagem, principalmente:
  - `contact`: largura flexível maior
  - `phone`: `min-width` fixa suficiente para o número completo
- Renderizar o telefone com:
  - `font-mono`/alinhamento estável
  - `title` com o valor completo
  - conteúdo sem corte indevido
- Manter o scroll horizontal da tabela, mas sem “espremer” a coluna de telefone.

**Arquivo**
- `src/components/funnels/FunnelListView.tsx`

---

### 2) Popup de edição mostrando datas em `YYYY-MM-DD`
O problema não parece ser só no campo padrão do deal, mas principalmente em campos personalizados que chegam como texto/data ISO e hoje são renderizados cruamente em alguns casos.

**O que será feito**
- Alinhar `DealCustomFieldsEditor` com o mesmo padrão já usado em outras áreas do sistema:
  - detectar campos de data por tipo (`date` / `datetime`)
  - detectar também campos `text` com nome de data (ex.: “Data da Entrada”, “Data da Consulta”)
- Usar os utilitários já existentes para:
  - interpretar `YYYY-MM-DD`, ISO e outros formatos válidos
  - exibir sempre em `dd/MM/yyyy`
- Salvar datas normalizadas no formato correto (`yyyy-MM-dd` para data simples), evitando voltar a aparecer em ISO bruto no popup.
- Revisar também o campo padrão de previsão/fechamento para manter consistência visual.

**Arquivos**
- `src/components/funnels/DealCustomFieldsEditor.tsx`
- `src/lib/date-utils.ts` (se precisar complementar helper reutilizável)

---

### 3) “Iniciar Nova Conversa” ainda mostrando números de outros assinantes
A correção precisa ser feita na origem do dado, não só no componente. Hoje a origem mais frágil é a resolução da organização do usuário nos hooks de canais.

**O que será feito**
- Refatorar a resolução de escopo organizacional para ficar determinística:
  - evitar depender de consultas soltas com `maybeSingle()` em vários hooks
  - centralizar a resolução da organização ativa do usuário em um único fluxo reutilizável
- Em `useWhatsAppInstances`:
  - priorizar filtro por `organization_id` da instância quando disponível
  - manter filtro adicional por permissões do membro (`allowedInstanceIds`) quando houver restrição individual
  - retornar lista vazia enquanto o escopo ainda não estiver resolvido, evitando qualquer “flash” com números errados
- Aplicar a mesma lógica de escopo aos hooks de números oficiais para deixar todos os seletores consistentes:
  - `useMetaNumbersMap`
  - `useMetaWhatsAppNumbers`
- Ajustar `NewConversationDialog` para:
  - só popular o select depois que a lista já vier filtrada
  - só auto-selecionar instância após o carregamento do escopo correto
  - mostrar estado vazio/carregando de forma segura

**Arquivos**
- `src/hooks/useChannelAccessScope.ts`
- `src/hooks/useWhatsAppInstances.ts`
- `src/hooks/useMetaNumbersMap.ts`
- `src/hooks/useMetaWhatsAppNumbers.ts`
- `src/components/inbox/NewConversationDialog.tsx`

---

### Validação final esperada
Depois da implementação:

1. No **Funil > Lista**, o telefone aparecerá completo.
2. No **popup de editar deal**, datas aparecerão em `dd/MM/yyyy`, inclusive nos campos personalizados de data.
3. Em **Iniciar Nova Conversa**, o usuário verá somente os números/instâncias autorizados da própria assinatura/organização.
4. A mesma regra de escopo ficará consistente nos demais seletores de canais do Inbox, reduzindo novos vazamentos parecidos.

### Detalhes técnicos
- Reaproveitar os helpers já existentes em `date-utils` em vez de criar parsing novo espalhado.
- Tratar carregamento de escopo antes do render dos selects para evitar vazamento visual temporário.
- Preferir escopo por organização real da instância (`organization_id`) quando existir; usar `user_id` apenas como fallback legado.
- Manter a camada de restrição individual por membro (`team_member_instances` / `team_member_meta_numbers`) por cima do escopo da organização.
