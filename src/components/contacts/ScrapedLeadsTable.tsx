import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserPlus, Trash2, Building2, Phone, Mail, MapPin } from "lucide-react";
import { ScrapedLead } from "@/hooks/useScrapedLeads";
import { Tag } from "@/hooks/useContacts";

interface ScrapedLeadsTableProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: ScrapedLead[];
  tags: Tag[];
  onImport: (leadIds: string[], tagId?: string) => void;
  onDelete: (leadIds: string[]) => void;
  isImporting: boolean;
}

export function ScrapedLeadsTable({
  open,
  onOpenChange,
  leads,
  tags,
  onImport,
  onDelete,
  isImporting,
}: ScrapedLeadsTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>("");

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(leads.map((l) => l.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const handleImport = () => {
    onImport(selectedIds, selectedTagId || undefined);
    setSelectedIds([]);
    setSelectedTagId("");
  };

  const handleDelete = () => {
    onDelete(selectedIds);
    setSelectedIds([]);
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] glass-card border-neon-cyan/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-glow-cyan">
            <Building2 className="h-5 w-5" />
            Leads Encontrados ({leads.length})
          </DialogTitle>
          <DialogDescription>
            Selecione os leads que deseja importar como contatos. Você pode aplicar uma tag automaticamente.
          </DialogDescription>
        </DialogHeader>

        {leads.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Nenhum lead encontrado. Faça uma busca primeiro.
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <Table>
                <TableHeader>
                  <TableRow className="border-neon-cyan/20">
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedIds.length === leads.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Porte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id} className="border-neon-cyan/10 hover:bg-neon-cyan/5">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(lead.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(lead.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {lead.nome_fantasia || lead.razao_social}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            CNPJ: {lead.cnpj}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {lead.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {formatPhone(lead.phone)}
                            </div>
                          )}
                          {lead.email && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </div>
                          )}
                          {!lead.phone && !lead.email && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {lead.city}, {lead.state}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm" title={lead.cnae_description || ""}>
                          {lead.cnae_description || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-neon-cyan/30">
                          {lead.porte || "N/A"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex items-center gap-4 pt-4 border-t border-neon-cyan/20">
              <div className="flex items-center gap-2 flex-1">
                <Label htmlFor="tag" className="whitespace-nowrap">
                  Aplicar tag:
                </Label>
                <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                  <SelectTrigger className="w-[200px] bg-dark-800/50 border-neon-cyan/30">
                    <SelectValue placeholder="Selecione uma tag (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selecionado(s)
              </span>
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir Selecionados
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="neon-border"
          >
            Fechar
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedIds.length === 0 || isImporting}
            className="bg-gradient-neon hover:opacity-90"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Importar como Contatos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
