import { useFormSubmissions, FormField } from "@/hooks/useForms";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface SubmissionsListProps {
  formId: string;
  fields: FormField[];
}

export const SubmissionsList = ({ formId, fields }: SubmissionsListProps) => {
  const { submissions, isLoading } = useFormSubmissions(formId);

  const handleExportCSV = () => {
    if (!submissions || submissions.length === 0) return;

    // Build headers
    const headers = ['Data', 'Contato', ...fields.map(f => f.label)];
    
    // Build rows
    const rows = submissions.map(sub => {
      const contactName = sub.contacts?.name || sub.contacts?.phone || 'Anônimo';
      const fieldValues = fields.map(f => {
        const value = sub.data[f.id] ?? sub.data[f.label] ?? '';
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      });
      return [
        format(new Date(sub.created_at), 'dd/MM/yyyy HH:mm'),
        contactName,
        ...fieldValues,
      ];
    });

    // Create CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Download
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
            {submissions.length} resposta{submissions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      <ScrollArea className="w-full">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Data</TableHead>
                <TableHead className="w-[150px]">Contato</TableHead>
                {fields.filter(f => !['heading', 'paragraph', 'divider'].includes(f.field_type)).map((field) => (
                  <TableHead key={field.id} className="min-w-[150px]">
                    {field.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
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
                  {fields.filter(f => !['heading', 'paragraph', 'divider'].includes(f.field_type)).map((field) => {
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
    </div>
  );
};
