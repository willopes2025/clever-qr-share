import { useState, useMemo } from "react";
import { useFormSubmissions, FormField } from "@/hooks/useForms";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, Filter, Pencil, Plus, X, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { EditSubmissionDialog } from "./EditSubmissionDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SubmissionsListProps {
  formId: string;
  fields: FormField[];
}

interface ColumnFilter {
  id: string;
  column: string;
  values: string[];
}

export const SubmissionsList = ({ formId, fields }: SubmissionsListProps) => {
  const { submissions, isLoading, updateSubmission } = useFormSubmissions(formId);
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [editingSubmission, setEditingSubmission] = useState<any>(null);

  const visibleFields = fields.filter(f => !['heading', 'paragraph', 'divider'].includes(f.field_type));

  // Resolve option values (e.g. "option1") to their display labels
  const resolveDisplayValue = (field: FormField, rawValue: any): string => {
    if (rawValue === undefined || rawValue === null) return '-';

    // Format date fields to DD/MM/YYYY
    if (field.field_type === 'date' && typeof rawValue === 'string' && rawValue.match(/^\d{4}-\d{2}-\d{2}/)) {
      const datePart = rawValue.split('T')[0];
      const [y, m, d] = datePart.split('-');
      return `${d}/${m}/${y}`;
    }

    const selectTypes = ['select', 'multi_select', 'radio', 'checkbox'];
    if (selectTypes.includes(field.field_type) && field.options && Array.isArray(field.options)) {
      const optionMap = new Map(field.options.map(o => [o.value, o.label]));

      if (Array.isArray(rawValue)) {
        return rawValue.map(v => optionMap.get(v) || v).join(', ');
      }
      if (typeof rawValue === 'string') {
        if (rawValue.startsWith('[')) {
          try {
            const arr = JSON.parse(rawValue);
            if (Array.isArray(arr)) {
              return arr.map((v: string) => optionMap.get(v) || v).join(', ');
            }
          } catch {}
        }
        return optionMap.get(rawValue) || rawValue;
      }
    }

    if (typeof rawValue === 'object') return JSON.stringify(rawValue);
    return String(rawValue);
  };

  // Build column options for filtering
  const columnOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "date", label: "Data" },
      { value: "contact", label: "Contato" },
      ...visibleFields.map(f => ({ value: f.id, label: f.label })),
    ];
    return opts;
  }, [visibleFields]);

  // Compute the displayed value for a submission/column
  const getCellValue = (sub: any, column: string): string => {
    if (column === "date") return format(new Date(sub.created_at), "dd/MM/yyyy");
    if (column === "contact") return sub.contacts?.name || sub.contacts?.phone || "Anônimo";
    const field = visibleFields.find(f => f.id === column);
    const raw = sub.data[column] ?? "";
    return field ? resolveDisplayValue(field, raw) : (typeof raw === "object" ? JSON.stringify(raw) : String(raw));
  };

  // Get unique values for a given column
  const getUniqueValues = (column: string): string[] => {
    if (!submissions) return [];
    const vals = new Set<string>();
    submissions.forEach(sub => {
      const v = getCellValue(sub, column);
      if (v && v !== "-") vals.add(v);
    });
    return Array.from(vals).sort();
  };

  // Filtered submissions: a submission must match ALL filters; within a filter, ANY of the selected values
  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    const active = filters.filter(f => f.column && f.values.length > 0);
    if (active.length === 0) return submissions;
    return submissions.filter(sub =>
      active.every(f => {
        const v = getCellValue(sub, f.column);
        return f.values.includes(v);
      })
    );
  }, [submissions, filters, visibleFields]);

  const addFilter = () => {
    setFilters(prev => [...prev, { id: crypto.randomUUID(), column: "", values: [] }]);
  };

  const updateFilterColumn = (id: string, column: string) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, column, values: [] } : f));
  };

  const toggleFilterValue = (id: string, value: string) => {
    setFilters(prev => prev.map(f => {
      if (f.id !== id) return f;
      const exists = f.values.includes(value);
      return { ...f, values: exists ? f.values.filter(v => v !== value) : [...f.values, value] };
    }));
  };

  const removeFilter = (id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => setFilters([]);

  const handleExportCSV = () => {
    if (!filteredSubmissions || filteredSubmissions.length === 0) return;
    const headers = ['Data', 'Contato', ...visibleFields.map(f => f.label)];
    const rows = filteredSubmissions.map(sub => {
      const contactName = sub.contacts?.name || sub.contacts?.phone || 'Anônimo';
      const fieldValues = visibleFields.map(f => {
        const value = sub.data[f.id] ?? sub.data[f.label] ?? '';
        return resolveDisplayValue(f, value);
      });
      return [
        format(new Date(sub.created_at), 'dd/MM/yyyy HH:mm'),
        contactName,
        ...fieldValues,
      ];
    });
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
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
            {filteredSubmissions.length} de {submissions.length} resposta{submissions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-start gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2 h-9">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filtros:</span>
        </div>

        {filters.map((filter) => {
          const uniqueValues = filter.column ? getUniqueValues(filter.column) : [];
          const columnLabel = columnOptions.find(c => c.value === filter.column)?.label;
          return (
            <div key={filter.id} className="flex items-center gap-1 bg-muted/50 rounded-md p-1 border">
              <Select value={filter.column} onValueChange={(v) => updateFilterColumn(filter.id, v)}>
                <SelectTrigger className="w-[180px] h-8 border-0 bg-transparent">
                  <SelectValue placeholder="Coluna..." />
                </SelectTrigger>
                <SelectContent>
                  {columnOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filter.column && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 min-w-[200px] justify-between"
                    >
                      <span className="truncate text-left">
                        {filter.values.length === 0
                          ? `Selecione ${columnLabel?.toLowerCase()}...`
                          : filter.values.length === 1
                            ? filter.values[0]
                            : `${filter.values.length} selecionados`}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 ml-1 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar..." />
                      <CommandList>
                        <CommandEmpty>Nenhum valor encontrado.</CommandEmpty>
                        <CommandGroup>
                          {uniqueValues.map(v => {
                            const checked = filter.values.includes(v);
                            return (
                              <CommandItem
                                key={v}
                                onSelect={() => toggleFilterValue(filter.id, v)}
                                className="cursor-pointer"
                              >
                                <div className={cn(
                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                  checked ? "bg-primary text-primary-foreground" : "opacity-50"
                                )}>
                                  {checked && <Check className="h-3 w-3" />}
                                </div>
                                <span className="flex-1 truncate">{v}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removeFilter(filter.id)}
                title="Remover filtro"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}

        <Button variant="outline" size="sm" onClick={addFilter} className="h-9">
          <Plus className="h-4 w-4 mr-1" />
          Adicionar filtro
        </Button>

        {filters.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9">
            Limpar
          </Button>
        )}
      </div>

      <ScrollArea className="w-full">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="w-[150px]">Data</TableHead>
                <TableHead className="w-[150px]">Contato</TableHead>
                {visibleFields.map((field) => (
                  <TableHead key={field.id} className="min-w-[150px]">
                    {field.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSubmission(submission)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(submission.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {submission.contacts ? (
                      <div>
                        <p className="font-medium text-sm">{submission.contacts.name || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground">{submission.contacts.phone}</p>
                      </div>
                    ) : (
                      <Badge variant="secondary">Anônimo</Badge>
                    )}
                  </TableCell>
                  {visibleFields.map((field) => {
                    const rawValue = submission.data[field.id] ?? submission.data[field.label] ?? '-';
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
        onSave={async (id, data) => {
          try {
            await updateSubmission(id, data);
            toast.success("Resposta atualizada com sucesso!");
          } catch {
            toast.error("Erro ao atualizar resposta.");
          }
        }}
      />
    </div>
  );
};
