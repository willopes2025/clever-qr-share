import { useState } from "react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, List, Loader2 } from "lucide-react";
import { useBroadcastLists, BroadcastListWithContacts } from "@/hooks/useBroadcastLists";
import { useContacts } from "@/hooks/useContacts";
import { BroadcastListFormDialog } from "@/components/broadcasts/BroadcastListFormDialog";
import { BroadcastListCard } from "@/components/broadcasts/BroadcastListCard";
import { ListContactsDialog } from "@/components/broadcasts/ListContactsDialog";
import { AddContactsDialog } from "@/components/broadcasts/AddContactsDialog";
import { SendHistoryDialog } from "@/components/broadcasts/SendHistoryDialog";
import { useToast } from "@/hooks/use-toast";

const BroadcastLists = () => {
  const { toast } = useToast();
  const {
    lists,
    isLoading,
    useListContacts,
    useListSendHistory,
    createList,
    updateList,
    deleteList,
    addContactsToList,
    removeContactsFromList,
  } = useBroadcastLists();
  
  const { contacts, tags } = useContacts();

  // UI State
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<BroadcastListWithContacts | null>(null);
  const [viewingList, setViewingList] = useState<BroadcastListWithContacts | null>(null);
  const [historyList, setHistoryList] = useState<BroadcastListWithContacts | null>(null);
  const [addContactsOpen, setAddContactsOpen] = useState(false);
  const [deleteConfirmList, setDeleteConfirmList] = useState<BroadcastListWithContacts | null>(null);

  // Queries for viewing list
  const { data: listContacts = [], isLoading: contactsLoading } = useListContacts(viewingList?.id || "");
  const { data: sendHistory = [], isLoading: historyLoading } = useListSendHistory(historyList?.id || "");

  // Filter lists
  const filteredLists = lists.filter((list) => {
    const matchesSearch = list.name.toLowerCase().includes(search.toLowerCase()) ||
      list.description?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || list.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleCreateList = (data: Parameters<typeof createList.mutate>[0]) => {
    createList.mutate(data);
  };

  const handleUpdateList = (data: Parameters<typeof createList.mutate>[0]) => {
    if (!editingList) return;
    updateList.mutate({ id: editingList.id, ...data });
    setEditingList(null);
  };

  const handleDeleteList = () => {
    if (!deleteConfirmList) return;
    deleteList.mutate(deleteConfirmList.id);
    setDeleteConfirmList(null);
  };

  const handleAddContacts = (contactIds: string[]) => {
    if (!viewingList) return;
    addContactsToList.mutate({ listId: viewingList.id, contactIds });
  };

  const handleRemoveContacts = (contactIds: string[]) => {
    if (!viewingList) return;
    removeContactsFromList.mutate({ listId: viewingList.id, contactIds });
  };

  const handleSendMessage = (list: BroadcastListWithContacts) => {
    toast({
      title: "Em breve",
      description: "O módulo de envio de mensagens será implementado em seguida.",
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Listas de Transmissão</h1>
            <p className="text-muted-foreground">
              {lists.length} {lists.length === 1 ? "lista" : "listas"} criadas
            </p>
          </div>
          <Button onClick={() => setFormDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Lista
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar listas..."
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo de lista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="dynamic">Dinâmica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLists.length === 0 ? (
          <div className="text-center py-12">
            <List className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {lists.length === 0 ? "Nenhuma lista criada" : "Nenhuma lista encontrada"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {lists.length === 0
                ? "Crie sua primeira lista de transmissão para começar a enviar mensagens em massa."
                : "Tente ajustar os filtros de busca."}
            </p>
            {lists.length === 0 && (
              <Button onClick={() => setFormDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Lista
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLists.map((list) => (
              <BroadcastListCard
                key={list.id}
                list={list}
                onView={() => setViewingList(list)}
                onEdit={() => {
                  setEditingList(list);
                  setFormDialogOpen(true);
                }}
                onDelete={() => setDeleteConfirmList(list)}
                onSend={() => handleSendMessage(list)}
              />
            ))}
          </div>
        )}

        {/* Dialogs */}
        <BroadcastListFormDialog
          open={formDialogOpen}
          onOpenChange={(open) => {
            setFormDialogOpen(open);
            if (!open) setEditingList(null);
          }}
          list={editingList}
          tags={tags}
          onSubmit={editingList ? handleUpdateList : handleCreateList}
        />

        {viewingList && (
          <ListContactsDialog
            open={!!viewingList}
            onOpenChange={(open) => !open && setViewingList(null)}
            list={viewingList}
            contacts={listContacts}
            isLoading={contactsLoading}
            onAddContacts={() => setAddContactsOpen(true)}
            onRemoveContacts={handleRemoveContacts}
          />
        )}

        {viewingList && (
          <AddContactsDialog
            open={addContactsOpen}
            onOpenChange={setAddContactsOpen}
            contacts={contacts}
            existingContactIds={listContacts.map((c) => c.contact_id)}
            onAdd={handleAddContacts}
          />
        )}

        {historyList && (
          <SendHistoryDialog
            open={!!historyList}
            onOpenChange={(open) => !open && setHistoryList(null)}
            list={historyList}
            sends={sendHistory}
            isLoading={historyLoading}
          />
        )}

        <AlertDialog open={!!deleteConfirmList} onOpenChange={(open) => !open && setDeleteConfirmList(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a lista "{deleteConfirmList?.name}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteList} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default BroadcastLists;
