import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { ContactWithTags } from "@/hooks/useContacts";

interface AddContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactWithTags[];
  existingContactIds: string[];
  onAdd: (contactIds: string[]) => void;
}

export const AddContactsDialog = ({
  open,
  onOpenChange,
  contacts,
  existingContactIds,
  onAdd,
}: AddContactsDialogProps) => {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const availableContacts = useMemo(() => {
    return contacts.filter(
      (c) =>
        !existingContactIds.includes(c.id) &&
        !c.opted_out &&
        (c.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search) ||
          c.email?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [contacts, existingContactIds, search]);

  const toggleContact = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === availableContacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(availableContacts.map((c) => c.id));
    }
  };

  const handleAdd = () => {
    onAdd(selectedIds);
    setSelectedIds([]);
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Contatos à Lista</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contatos..."
              className="pl-10"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {availableContacts.length} contatos disponíveis
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAll}
            >
              {selectedIds.length === availableContacts.length
                ? "Desmarcar todos"
                : "Selecionar todos"}
            </Button>
          </div>

          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-2 space-y-1">
              {availableContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                  onClick={() => toggleContact(contact.id)}
                >
                  <Checkbox
                    checked={selectedIds.includes(contact.id)}
                    onCheckedChange={() => toggleContact(contact.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {contact.name || contact.phone}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {contact.phone}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {contact.tags?.slice(0, 2).map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: tag.color, color: tag.color }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                    {(contact.tags?.length || 0) > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{contact.tags!.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {availableContacts.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum contato disponível
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={selectedIds.length === 0}>
            Adicionar {selectedIds.length > 0 && `(${selectedIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
