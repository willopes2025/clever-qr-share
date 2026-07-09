import { useState, useMemo } from "react";
import { useFormSubmissions, FormField } from "@/hooks/useForms";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, FileText, Download, Filter, Pencil, X, Check, Trash2,
  ChevronDown, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { formatDateOnly, formatDateTimeFull } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { format, startOfDay, endOfDay } from "date-fns";
import { EditSubmissionDialog } from "./EditSubmissionDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DateRangeFilter = { from?: Date; to?: Date };

interface SubmissionsListProps {
  formId: string;
  fields: FormField[];
}

export const SubmissionsList = ({ formId, fields }: SubmissionsListProps) => {
  const { submissions, isLoading, updateSubmission, deleteSubmission } = useFormSubmissions(formId);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [columnSearch, setColumnSearch] = useState<Record<string, string>>({});
  const [dateFilters, setDateFilters] = useState<Record<string, DateRangeFilter>>({});
  const [sortConfig, setSortConfig] = useState<{ columnId: string; direction: "asc" | "desc" } | null>(null);
  const [editingSubmission, setEditingSubmission] = useState<any>(null);
  const [deletingSubmission, setDeletingSubmission] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const visibleFields = fields.filter(f => !["heading", "paragraph", "divider"].includes(f.field_type));

  const DATE_FIELD_TYPES = ["date", "datetime", "scheduling", "datetime-local", "time"];
  const isDateLikeField = (field?: FormField) =>
    !!field && DATE_FIELD_TYPES.includes(field.field_type);

  const isDateColumn = (columnId: string): boolean => {
    if (columnId === "date") return true;
    const field = visibleFields.find(f => f.id === columnId);
    return isDateLikeField(field);
  };

  const extractDateString = (raw: any): string | null => {
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    if (typeof raw === "object") {
      return raw.datetime || raw.date || raw.value || raw.start || null;
    }
    return null;
  };

  const getDateValue = (sub: any, columnId: string): Date | null => {
    if (columnId === "date") {
      const d = new Date(sub.created_at);
      return isNaN(d.getTime()) ? null : d;
    }
    const field = visibleFields.find(f => f.id === columnId);
    if (!field) return null;
    const raw = sub.data?.[columnId] ?? sub.data?.[field.label];
    const str = extractDateString(raw);
    if (!str) return null;
    const datePart = str.split("T")[0].split(" ")[0];
    const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };

  const resolveDisplayValue = (field: FormField, rawValue: any): string => {
    if (rawValue === undefined || rawValue === null || rawValue === "") return "-";
    if (isDateLikeField(field)) {
      const str = extractDateString(rawValue);
      if (str && str.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [datePart, timePartRaw] = str.includes("T") ? str.split("T") : str.split(" ");
        const [y, m, d] = datePart.split("-");
        const formatted = `${d}/${m}/${y}`;
        if (timePartRaw) {
          const time = timePartRaw.slice(0, 5);
          return `${formatted} ${time}`;
        }
        return formatted;
      }
    }
    const selectTypes = ["select", "multi_select", "radio", "checkbox"];
    if (selectTypes.includes(field.field_type) && field.options && Array.isArray(field.options)) {
      const optionMap = new Map(field.options.map(o => [o.value, o.label]));
      if (Array.isArray(rawValue)) return rawValue.map(v => optionMap.get(v) || v).join(", ");
      if (typeof rawValue === "string") {
        if (rawValue.startsWith("[")) {
          try {
            const arr = JSON.parse(rawValue);
            if (Array.isArray(arr)) return arr.map((v: string) => optionMap.get(v) || v).join(", ");
          } catch { /* ignore */ }
        }
        return optionMap.get(rawValue) || rawValue;
      }
    }
    if (typeof rawValue === "object") return JSON.stringify(rawValue);
    return String(rawValue);
  };

  const columns = useMemo(() => ([
    { id: "date", label: "Data" },
    { id: "contact", label: "Contato" },
    ...visibleFields.map(f => ({ id: f.id, label: f.label })),
  ]), [visibleFields]);

  const getCellValue = (sub: any, column: string): string => {
    if (column === "date") return formatDateOnly(sub.created_at);
    if (column === "contact") return sub.contacts?.name || sub.contacts?.phone || "Anônimo";
    const field = visibleFields.find(f => f.id === column);
    const raw = sub.data?.[column] ?? sub.data?.[field?.label ?? ""] ?? "";
    return field ? resolveDisplayValue(field, raw) : (typeof raw === "object" ? JSON.stringify(raw) : String(raw));
  };

  const getUniqueValues = (column: string): string[] => {
    if (!submissions) return [];
    const vals = new Set<string>();
    submissions.forEach(sub => {
      const v = getCellValue(sub, column);
      if (v && v !== "-") vals.add(v);
    });
    return Array.from(vals).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
  };


  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    let result = submissions.filter(sub => {
      // Date range filters
      for (const [col, range] of Object.entries(dateFilters)) {
        if (!range || (!range.from && !range.to)) continue;
        const v = getDateValue(sub, col);
        if (!v) return false;
        if (range.from && v < startOfDay(range.from)) return false;
        if (range.to && v > endOfDay(range.to)) return false;
      }
      // Value filters (non-date columns)
      return Object.entries(columnFilters).every(([col, values]) => {
        if (!values || values.length === 0) return true;
        return values.includes(getCellValue(sub, col));
      });
    });
    if (sortConfig) {
      const { columnId, direction } = sortConfig;
      const dateCol = isDateColumn(columnId);
      result = [...result].sort((a, b) => {
        if (dateCol) {
          const av = getDateValue(a, columnId);
          const bv = getDateValue(b, columnId);
          const at = av ? av.getTime() : -Infinity;
          const bt = bv ? bv.getTime() : -Infinity;
          const cmp = at - bt;
          return direction === "asc" ? cmp : -cmp;
        }
        const av = getCellValue(a, columnId);
        const bv = getCellValue(b, columnId);
        const cmp = av.localeCompare(bv, "pt-BR", { numeric: true, sensitivity: "base" });
        return direction === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [submissions, columnFilters, dateFilters, sortConfig, visibleFields]);

  const toggleFilterValue = (column: string, value: string) => {
    setColumnFilters(prev => {
      const current = prev[column] || [];
      const exists = current.includes(value);
      const next = exists ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [column]: next };
    });
  };

  const clearColumnFilter = (column: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
  };

  const clearDateFilter = (column: string) => {
    setDateFilters(prev => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
  };

  const selectAll = (column: string) => {
    setColumnFilters(prev => ({ ...prev, [column]: getUniqueValues(column) }));
  };

  const clearAll = () => {
    setColumnFilters({});
    setDateFilters({});
    setSortConfig(null);
  };

  const setSort = (columnId: string, direction: "asc" | "desc" | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ columnId, direction });
  };

  const hasActiveFilters =
    Object.values(columnFilters).some(v => v && v.length > 0) ||
    Object.values(dateFilters).some(r => r && (r.from || r.to)) ||
    !!sortConfig;

  const renderColumnHeader = (columnId: string, label: string) => {
    const activeValues = columnFilters[columnId] || [];
    const dateRange = dateFilters[columnId];
    const isDate = isDateColumn(columnId);
    const hasFilter = isDate
      ? !!(dateRange && (dateRange.from || dateRange.to))
      : activeValues.length > 0;
    const isSorted = sortConfig?.columnId === columnId;
    const sortDir = isSorted ? sortConfig!.direction : null;
    const uniqueValues = getUniqueValues(columnId);
    const search = (columnSearch[columnId] || "").toLowerCase();
    const filteredUnique = search
      ? uniqueValues.filter(v => v.toLowerCase().includes(search))
      : uniqueValues;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 font-medium hover:bg-transparent flex items-center gap-1"
          >
            {label}
            {sortDir === "asc" && <ArrowUp className="h-3 w-3 text-primary" />}
            {sortDir === "desc" && <ArrowDown className="h-3 w-3 text-primary" />}
            {!sortDir && (hasFilter
              ? <Filter className="h-3 w-3 text-primary" />
              : <ChevronDown className="h-3 w-3 opacity-50" />)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className={cn("p-3", isDate ? "w-auto" : "w-64")} align="start">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ordenar</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={sortDir === "asc" ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSort(columnId, "asc")}
                >
                  <ArrowUp className="h-3 w-3 mr-1" />
                  {isDate ? "Mais antigo" : "A → Z"}
                </Button>
                <Button
                  variant={sortDir === "desc" ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSort(columnId, "desc")}
                >
                  <ArrowDown className="h-3 w-3 mr-1" />
                  {isDate ? "Mais recente" : "Z → A"}
                </Button>
              </div>
              {isSorted && (
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => setSort(columnId, null)}>
                  <ArrowUpDown className="h-3 w-3 mr-1" />
                  Remover ordenação
                </Button>
              )}
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">Filtrar por {label}</p>

              {isDate ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {dateRange?.from
                        ? `${format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })}${dateRange.to ? ` → ${format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}` : ""}`
                        : "Selecione um intervalo"}
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:underline"
                      onClick={() => clearDateFilter(columnId)}
                    >
                      Limpar
                    </button>
                  </div>
                  <Calendar
                    mode="range"
                    locale={ptBR}
                    selected={dateRange as any}
                    onSelect={(range: any) =>
                      setDateFilters(prev => ({ ...prev, [columnId]: { from: range?.from, to: range?.to } }))
                    }
                    numberOfMonths={1}
                    initialFocus
                    className={cn("p-0 pointer-events-auto")}
                  />
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Buscar..."
                    value={columnSearch[columnId] || ""}
                    onChange={(e) => setColumnSearch(prev => ({ ...prev, [columnId]: e.target.value }))}
                    className="h-8"
                  />
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => selectAll(columnId)}
                    >
                      Selecionar todos
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:underline"
                      onClick={() => clearColumnFilter(columnId)}
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto border rounded-md">
                    {filteredUnique.length === 0 ? (
                      <p className="p-2 text-xs text-muted-foreground text-center">Nenhum valor</p>
                    ) : filteredUnique.map(v => {
                      const checked = activeValues.includes(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => toggleFilterValue(columnId, v)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted text-left"
                        >
                          <div className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-sm border border-primary shrink-0",
                            checked ? "bg-primary text-primary-foreground" : "opacity-50"
                          )}>
                            {checked && <Check className="h-3 w-3" />}
                          </div>
                          <span className="flex-1 truncate">{v}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const handleExportCSV = () => {
    if (!filteredSubmissions || filteredSubmissions.length === 0) return;
    const headers = ["Data", "Contato", ...visibleFields.map(f => f.label)];
    const rows = filteredSubmissions.map(sub => {
      const contactName = sub.contacts?.name || sub.contacts?.phone || "Anônimo";
      const fieldValues = visibleFields.map(f => {
        const value = sub.data[f.id] ?? sub.data[f.label] ?? "";
        return resolveDisplayValue(f, value);
      });
      return [formatDateTimeFull(sub.created_at), contactName, ...fieldValues];
    });
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `respostas-${formId}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Nenhuma resposta ainda</h3>
        <p className="text-muted-foreground max-w-sm">
          Quando alguém preencher este formulário, as respostas aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium">Respostas</h3>
          <p className="text-sm text-muted-foreground">
            {filteredSubmissions.length} de {submissions.length} resposta{submissions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]"></TableHead>
                <TableHead className="w-[150px]">{renderColumnHeader("date", "Data")}</TableHead>
                <TableHead className="w-[180px]">{renderColumnHeader("contact", "Contato")}</TableHead>
                <TableHead className="w-[160px]">Compartilhado por</TableHead>
                {visibleFields.map((field) => (
                  <TableHead key={field.id} className="min-w-[150px]">
                    {renderColumnHeader(field.id, field.label)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSubmission(submission)} title="Editar resposta">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeletingSubmission(submission)}
                        title="Excluir resposta"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDateTimeFull(submission.created_at)}</TableCell>
                  <TableCell>
                    {submission.contacts ? (
                      <div>
                        <p className="font-medium text-sm">{submission.contacts.name || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">{submission.contacts.phone}</p>
                      </div>
                    ) : (
                      <Badge variant="secondary">Anônimo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(submission as any).shared_by_name ? (
                      <span className="font-medium">{(submission as any).shared_by_name}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  {visibleFields.map((field) => {
                    const rawValue = submission.data[field.id] ?? submission.data[field.label] ?? "-";
                    return (
                      <TableCell key={field.id} className="text-sm max-w-[200px] truncate">
                        {resolveDisplayValue(field, rawValue)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <EditSubmissionDialog
        open={!!editingSubmission}
        onOpenChange={(open) => { if (!open) setEditingSubmission(null); }}
        submission={editingSubmission}
        fields={fields}
        hasLinkedDeal={!!editingSubmission?.deal_id}
        onSave={async (id, data) => {
          try {
            await updateSubmission(id, data, fields);
            toast.success(
              editingSubmission?.deal_id
                ? "Resposta e cartão do lead atualizados!"
                : "Resposta atualizada com sucesso!"
            );
          } catch {
            toast.error("Erro ao atualizar resposta.");
          }
        }}
      />

      <AlertDialog
        open={!!deletingSubmission}
        onOpenChange={(open) => { if (!open) setDeletingSubmission(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resposta?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSubmission?.deal_id
                ? "Esta resposta está vinculada a um cartão de lead. Ao excluir, o cartão correspondente também será removido do funil. Esta ação não pode ser desfeita."
                : "Esta ação não pode ser desfeita. A resposta será removida permanentemente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deletingSubmission) return;
                setDeleting(true);
                try {
                  await deleteSubmission(deletingSubmission.id);
                  toast.success(
                    deletingSubmission.deal_id
                      ? "Resposta e cartão do lead excluídos."
                      : "Resposta excluída."
                  );
                  setDeletingSubmission(null);
                } catch {
                  toast.error("Erro ao excluir resposta.");
                } finally {
                  setDeleting(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
