import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2, Loader2 } from "lucide-react";
import { BroadcastList } from "@/hooks/useBroadcastLists";

interface ListContact {
  id: string;
  contact_id: string;
  added_at: string;
  contacts: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    status: string;
  } | null;
}

interface ListContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: BroadcastList;
  contacts: ListContact[];
  isLoading: boolean;
  onAddContacts: () => void;
  onRemoveContacts: (contactIds: string[]) => void;
}

export const ListContactsDialog = ({
  open,
  onOpenChange,
  list,
  contacts,
  isLoading,
  onAddContacts,
  onRemoveContacts,
}: ListContactsDialogProps) => {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredContacts = contacts.filter(
    (c) =>
      c.contacts?.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contacts?.phone.includes(search) ||
      c.contacts?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleContact = (contactId: string) => {
    setSelectedIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleRemove = () => {
    onRemoveContacts(selectedIds);
    setSelectedIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {list.name}
            <Badge variant={list.type === "dynamic" ? "secondary" : "outline"}>
              {list.type === "dynamic" ? "Dinâmica" : "Manual"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar contatos..."
                className="pl-10"
              />
            </div>
            {list.type === "manual" && (
              <Button onClick={onAddContacts}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            )}
          </div>

          {list.type === "manual" && selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selecionados
              </span>
              <Button variant="destructive" size="sm" onClick={handleRemove}>
                <Trash2 className="h-4 w-4 mr-1" />
                Remover
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[350px] border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredContacts.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted rounded-md"
                  >
                    {list.type === "manual" && (
                      <Checkbox
                        checked={selectedIds.includes(item.contact_id)}
                        onCheckedChange={() => toggleContact(item.contact_id)}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {item.contacts?.name || item.contacts?.phone}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {item.contacts?.phone}
                      </p>
                    </div>
                    <Badge
                      variant={item.contacts?.status === "active" ? "default" : "secondary"}
                    >
                      {item.contacts?.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                ))}
                {filteredContacts.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">
                    {contacts.length === 0
                      ? "Nenhum contato na lista"
                      : "Nenhum contato encontrado"}
                  </p>
                )}
              </div>
            </ScrollArea>
          )}

          <p className="text-sm text-muted-foreground text-center">
            {contacts.length} contatos na lista
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
