import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { BroadcastList, FilterCriteria } from "@/hooks/useBroadcastLists";
import { Tag } from "@/hooks/useContacts";

interface BroadcastListFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list?: BroadcastList | null;
  tags: Tag[];
  onSubmit: (data: {
    name: string;
    description?: string;
    type: "manual" | "dynamic";
    filter_criteria?: FilterCriteria;
  }) => void;
}

export const BroadcastListFormDialog = ({
  open,
  onOpenChange,
  list,
  tags,
  onSubmit,
}: BroadcastListFormDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"manual" | "dynamic">("manual");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [excludeOptedOut, setExcludeOptedOut] = useState(true);

  useEffect(() => {
    if (list) {
      setName(list.name);
      setDescription(list.description || "");
      setType(list.type);
      setSelectedTags(list.filter_criteria?.tags || []);
      setStatus(list.filter_criteria?.status || "all");
      setExcludeOptedOut(list.filter_criteria?.optedOut === false);
    } else {
      setName("");
      setDescription("");
      setType("manual");
      setSelectedTags([]);
      setStatus("all");
      setExcludeOptedOut(true);
    }
  }, [list, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const filterCriteria: FilterCriteria = {};
    if (type === "dynamic") {
      if (selectedTags.length > 0) filterCriteria.tags = selectedTags;
      if (status && status !== "all") filterCriteria.status = status;
      if (excludeOptedOut) filterCriteria.optedOut = false;
    }

    onSubmit({
      name,
      description: description || undefined,
      type,
      filter_criteria: type === "dynamic" ? filterCriteria : undefined,
    });
    onOpenChange(false);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {list ? "Editar Lista" : "Nova Lista de Transmissão"}
          </DialogTitle>
          <DialogDescription>
            {list ? "Edite as configurações da sua lista." : "Configure sua nova lista de transmissão para campanhas."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Lista</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Clientes VIP"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito desta lista..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Lista</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as "manual" | "dynamic")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="font-normal cursor-pointer">
                  Manual - Adicione contatos individualmente
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dynamic" id="dynamic" />
                <Label htmlFor="dynamic" className="font-normal cursor-pointer">
                  Dinâmica - Contatos filtrados automaticamente
                </Label>
              </div>
            </RadioGroup>
          </div>

          {type === "dynamic" && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium text-sm">Critérios de Filtro</h4>
              
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      style={{
                        backgroundColor: selectedTags.includes(tag.id) ? tag.color : "transparent",
                        borderColor: tag.color,
                        color: selectedTags.includes(tag.id) ? "white" : tag.color,
                      }}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                      {selectedTags.includes(tag.id) && (
                        <X className="ml-1 h-3 w-3" />
                      )}
                    </Badge>
                  ))}
                  {tags.length === 0 && (
                    <span className="text-sm text-muted-foreground">
                      Nenhuma tag disponível
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status do Contato</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="excludeOptedOut"
                  checked={excludeOptedOut}
                  onCheckedChange={(checked) => setExcludeOptedOut(!!checked)}
                />
                <Label htmlFor="excludeOptedOut" className="font-normal cursor-pointer">
                  Excluir contatos que optaram por sair
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{list ? "Salvar" : "Criar Lista"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
