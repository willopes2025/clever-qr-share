import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle, CheckCircle2, Download, Tag } from "lucide-react";
import { toast } from "sonner";

export interface TagOption {
  id: string;
  name: string;
  color: string;
}

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (
    contacts: { phone: string; name?: string; email?: string; notes?: string; custom_fields?: Record<string, string> }[],
    tagIds?: string[]
  ) => void;
  isLoading?: boolean;
  tags?: TagOption[];
}

interface ParsedContact {
  phone: string;
  name?: string;
  email?: string;
  notes?: string;
  custom_fields?: Record<string, string>;
  isValid: boolean;
  error?: string;
}

export const ImportContactsDialog = ({
  open,
  onOpenChange,
  onImport,
  isLoading,
  tags = [],
}: ImportContactsDialogProps) => {
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const validatePhone = (phone: string): { isValid: boolean; error?: string } => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      return { isValid: false, error: "Número muito curto" };
    }
    if (cleaned.length > 15) {
      return { isValid: false, error: "Número muito longo" };
    }
    return { isValid: true };
  };

  const downloadTemplate = () => {
    const headers = "telefone,nome,email,notas,empresa,produto,valor,data,link";
    const examples = [
      "5511999999999,João Silva,joao@email.com,Cliente VIP,TechCorp,Plano Pro,R$ 99,2024-01-15,https://loja.com",
      "5521988888888,Maria Santos,maria@email.com,Lead quente,StartupXYZ,Básico,R$ 49,2024-02-01,https://site.com",
      "5531977777777,Pedro Oliveira,,,Empresa ABC,Premium,R$ 199,,"
    ].join("\n");
    
    const csvContent = `${headers}\n${examples}`;
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_contatos.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = useCallback((text: string) => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return [];

    // Detect separator
    const separator = lines[0].includes(";") ? ";" : ",";

    // Parse header
    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(separator).map((h) => h.trim());

    const phoneIndex = headers.findIndex(
      (h) => h.includes("phone") || h.includes("telefone") || h.includes("número") || h.includes("numero")
    );
    const nameIndex = headers.findIndex(
      (h) => h.includes("name") || h.includes("nome")
    );
    const emailIndex = headers.findIndex(
      (h) => h.includes("email") || h.includes("e-mail")
    );
    const notesIndex = headers.findIndex(
      (h) => h.includes("notes") || h.includes("notas") || h.includes("observações") || h.includes("observacoes")
    );
    const empresaIndex = headers.findIndex((h) => h.includes("empresa") || h.includes("company"));
    const produtoIndex = headers.findIndex((h) => h.includes("produto") || h.includes("product"));
    const valorIndex = headers.findIndex((h) => h.includes("valor") || h.includes("value") || h.includes("preco") || h.includes("price"));
    const dataIndex = headers.findIndex((h) => h === "data" || h === "date" || h.includes("vencimento"));
    const linkIndex = headers.findIndex((h) => h.includes("link") || h.includes("url"));

    // If no header found, assume first column is phone
    const hasHeader = phoneIndex !== -1 || nameIndex !== -1;
    const startIndex = hasHeader ? 1 : 0;

    const contacts: ParsedContact[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const values = lines[i].split(separator).map((v) => v.trim().replace(/"/g, ""));
      
      const phone = phoneIndex !== -1 ? values[phoneIndex] : values[0];
      if (!phone) continue;

      const validation = validatePhone(phone);
      
      // Build custom_fields from extra columns
      const custom_fields: Record<string, string> = {};
      if (empresaIndex !== -1 && values[empresaIndex]?.trim()) custom_fields.empresa = values[empresaIndex].trim();
      if (produtoIndex !== -1 && values[produtoIndex]?.trim()) custom_fields.produto = values[produtoIndex].trim();
      if (valorIndex !== -1 && values[valorIndex]?.trim()) custom_fields.valor = values[valorIndex].trim();
      if (dataIndex !== -1 && values[dataIndex]?.trim()) custom_fields.data = values[dataIndex].trim();
      if (linkIndex !== -1 && values[linkIndex]?.trim()) custom_fields.link = values[linkIndex].trim();

      contacts.push({
        phone: phone.replace(/\D/g, ""),
        name: nameIndex !== -1 ? values[nameIndex] : values[1],
        email: emailIndex !== -1 ? values[emailIndex] : values[2],
        notes: notesIndex !== -1 ? values[notesIndex] : values[3],
        custom_fields: Object.keys(custom_fields).length > 0 ? custom_fields : undefined,
        isValid: validation.isValid,
        error: validation.error,
      });
    }

    return contacts;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      toast.error("Formato inválido", {
        description: "Por favor, envie um arquivo CSV ou TXT",
      });
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const contacts = parseCSV(text);
      setParsedContacts(contacts);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    const validContacts = parsedContacts
      .filter((c) => c.isValid)
      .map(({ phone, name, email, notes, custom_fields }) => ({ phone, name, email, notes, custom_fields }));

    if (validContacts.length === 0) {
      toast.error("Nenhum contato válido", {
        description: "Verifique o formato dos números",
      });
      return;
    }

    onImport(validContacts, selectedTagIds.length > 0 ? selectedTagIds : undefined);
    setParsedContacts([]);
    setFileName("");
    setSelectedTagIds([]);
  };

  const validCount = parsedContacts.filter((c) => c.isValid).length;
  const invalidCount = parsedContacts.filter((c) => !c.isValid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Contatos</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV com os contatos. O arquivo deve conter pelo menos uma coluna de telefone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download template button */}
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTemplate}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Baixar Modelo de Planilha
          </Button>

          {/* Upload area */}
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-border">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
              <p className="mb-1 text-sm text-muted-foreground">
                <span className="font-semibold">Clique para enviar</span> ou arraste
              </p>
              <p className="text-xs text-muted-foreground">CSV ou TXT</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".csv,.txt"
              onChange={handleFileChange}
            />
          </label>

          {/* File info */}
          {fileName && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">{fileName}</span>
            </div>
          )}

          {/* Preview */}
          {parsedContacts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  {validCount} válidos
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {invalidCount} inválidos
                  </div>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Telefone</th>
                      <th className="text-left p-2">Nome</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedContacts.slice(0, 10).map((contact, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono text-xs">{contact.phone}</td>
                        <td className="p-2">{contact.name || "-"}</td>
                        <td className="p-2">
                          {contact.isValid ? (
                            <span className="text-green-600 text-xs">Válido</span>
                          ) : (
                            <span className="text-destructive text-xs">
                              {contact.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedContacts.length > 10 && (
                  <p className="p-2 text-center text-xs text-muted-foreground border-t">
                    ... e mais {parsedContacts.length - 10} contatos
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tag selection */}
          {parsedContacts.length > 0 && tags.length > 0 && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Aplicar tags aos contatos importados (opcional)
              </Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                    onClick={() => toggleTag(tag.id)}
                    className="cursor-pointer transition-all hover:scale-105"
                    style={{
                      backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : "transparent",
                      borderColor: tag.color,
                      color: selectedTagIds.includes(tag.id) ? "#fff" : undefined,
                    }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
              {selectedTagIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedTagIds.length} tag(s) serão aplicadas aos contatos importados
                </p>
              )}
            </div>
          )}

          {/* Format help */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Formato esperado:</p>
            <code className="block p-2 bg-muted rounded text-xs">
              telefone,nome,email<br />
              5511999999999,João Silva,joao@email.com
            </code>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setParsedContacts([]);
                setFileName("");
                setSelectedTagIds([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={validCount === 0 || isLoading}
            >
              {isLoading
                ? "Importando..."
                : `Importar ${validCount} contatos`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
