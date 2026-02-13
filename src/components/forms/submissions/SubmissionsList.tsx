import { useState, useMemo } from "react";
import { useFormSubmissions, FormField } from "@/hooks/useForms";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, Filter, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EditSubmissionDialog } from "./EditSubmissionDialog";
import { toast } from "sonner";

interface SubmissionsListProps {
  formId: string;
  fields: FormField[];
}

export const SubmissionsList = ({ formId, fields }: SubmissionsListProps) => {
  const { submissions, isLoading, updateSubmission } = useFormSubmissions(formId);
  const [filterColumn, setFilterColumn] = useState<string>("none");
  const [filterValue, setFilterValue] = useState("");
  const [editingSubmission, setEditingSubmission] = useState<any>(null);

  const visibleFields = fields.filter(f => !['heading', 'paragraph', 'divider'].includes(f.field_type));

  // Build column options for filtering
  const columnOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "date", label: "Data" },
      { value: "contact", label: "Contato" },
      ...visibleFields.map(f => ({ value: f.id, label: f.label })),
    ];
    return opts;
  }, [visibleFields]);

  // Get unique values for the selected column
  const uniqueValues = useMemo(() => {
    if (!submissions || filterColumn === "none") return [];
    const vals = new Set<string>();
    submissions.forEach(sub => {
      let val = "";
      if (filterColumn === "date") {
        val = format(new Date(sub.created_at), "dd/MM/yyyy");
      } else if (filterColumn === "contact") {
        val = sub.contacts?.name || sub.contacts?.phone || "Anônimo";
      } else {
        const raw = sub.data[filterColumn] ?? "";
        val = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      }
      if (val && val !== "-") vals.add(val);
    });
    return Array.from(vals).sort();
  }, [submissions, filterColumn]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    if (filterColumn === "none" || !filterValue) return submissions;
    return submissions.filter(sub => {
      let val = "";
      if (filterColumn === "date") {
        val = format(new Date(sub.created_at), "dd/MM/yyyy");
      } else if (filterColumn === "contact") {
        val = sub.contacts?.name || sub.contacts?.phone || "Anônimo";
      } else {
        const raw = sub.data[filterColumn] ?? "";
        val = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      }
      return val.toLowerCase().includes(filterValue.toLowerCase());
    });
  }, [submissions, filterColumn, filterValue]);

  const handleExportCSV = () => {
    if (!filteredSubmissions || filteredSubmissions.length === 0) return;
    const headers = ['Data', 'Contato', ...visibleFields.map(f => f.label)];
    const rows = filteredSubmissions.map(sub => {
      const contactName = sub.contacts?.name || sub.contacts?.phone || 'Anônimo';
      const fieldValues = visibleFields.map(f => {
        const value = sub.data[f.id] ?? sub.data[f.label] ?? '';
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      });
      return [
        format(new Date(sub.created_at), 'dd/MM/yyyy HH:mm'),
        contactName,
        ...fieldValues,
      ];
    });
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
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
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterColumn} onValueChange={(v) => { setFilterColumn(v); setFilterValue(""); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por coluna..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem filtro</SelectItem>
            {columnOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filterColumn !== "none" && (
          uniqueValues.length <= 20 ? (
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Selecione o valor..." />
              </SelectTrigger>
              <SelectContent>
                {uniqueValues.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="Digite para filtrar..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="w-[250px]"
            />
          )
        )}

        {filterValue && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterColumn("none"); setFilterValue(""); }}>
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
                    const value = submission.data[field.id] ?? submission.data[field.label] ?? '-';
                    return (
                      <TableCell key={field.id} className="text-sm max-w-[200px] truncate">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
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
