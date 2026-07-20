## Problemas

1. **"Pendentes" inclui atrasadas.** Em `src/pages/Tasks.tsx` (linha 89), o filtro aplica apenas `!t.completed_at`, e como toda tarefa atrasada também é não-concluída, ela aparece tanto em "Pendentes" quanto em "Atrasadas". Correto: as duas categorias devem ser mutuamente exclusivas.
2. **Filtro de status é single-select.** Hoje o `Select` (linha ~190) só aceita um status por vez ("Pendentes" OU "Atrasadas" OU "Concluídas" OU "Todas"). O usuário quer poder marcar **0, 1 ou N** status simultaneamente (ex.: Pendentes + Atrasadas).

## Correção

### 1. `src/pages/Tasks.tsx` — trocar single-select por multi-select

- Substituir o state `statusFilter: "all" | "pending" | "overdue" | "completed"` por:
  ```
  const [statusFilters, setStatusFilters] = useState<Array<"pending" | "overdue" | "completed">>(["pending"]);
  ```
  Padrão inicial: `["pending"]` (mantém a experiência atual ao abrir a página). Array vazio = sem restrição de status (equivalente ao antigo "Todas").

- Trocar o componente `Select` de status por um **dropdown multi-select com checkboxes**, usando `DropdownMenu` + `DropdownMenuCheckboxItem` do shadcn (padrão já usado em outros filtros do projeto). Itens: Pendentes, Atrasadas, Concluídas. Botão trigger mostra "Status" + badge com contagem de selecionados (ou "Todas" quando vazio).

- Reescrever `filteredTasks` para aplicar união dos status escolhidos, garantindo exclusividade entre pending/overdue:
  ```
  if (statusFilters.length > 0) {
    result = result.filter(t => {
      const overdue = isOverdue(t);
      const completed = !!t.completed_at;
      const pending = !completed && !overdue;
      return (
        (statusFilters.includes("pending")  && pending)  ||
        (statusFilters.includes("overdue")  && overdue)  ||
        (statusFilters.includes("completed") && completed)
      );
    });
  }
  ```
  Isso já resolve o problema 1 (pending exclui overdue) e o problema 2 (múltiplos status simultâneos).

- Ajustar o contador do header ("X pendentes / Y atrasadas", linhas ~171–175) para usar listas derivadas coerentes:
  - `pendingNotOverdue = tasks.filter(t => !t.completed_at && !isOverdue(t))` para "pendentes";
  - `overdueTasks` continua como já é.

### 2. Sem alterações fora da UI
- Nada muda em `useAllTasks`, RLS, banco ou edge functions. `pendingTasks` retornado pelo hook segue como está (para não impactar outros consumidores); a página passa a derivar sua própria contagem.

### 3. Verificação
- Abrir `/tasks`: por padrão só "Pendentes" marcado; lista não mostra atrasadas nem concluídas.
- Marcar também "Atrasadas": lista passa a mostrar pendentes + atrasadas, sem duplicar.
- Desmarcar tudo: lista mostra todas (equivalente ao antigo "Todas").
- Marcar só "Concluídas": lista mostra apenas concluídas.
- Contadores do header refletem as novas categorias exclusivas.