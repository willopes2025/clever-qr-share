import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Upload,
  Search,
  Tag as TagIcon,
  Trash2,
  Download,
  Users,
  Loader2,
  UserX,
  TagsIcon,
  CalendarIcon,
} from "lucide-react";
import { format, isToday, isYesterday, subDays, isSameMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useContacts, ContactWithTags } from "@/hooks/useContacts";
import { ContactFormDialog } from "@/components/contacts/ContactFormDialog";
import { ImportContactsDialog } from "@/components/contacts/ImportContactsDialog";
import { TagManager } from "@/components/contacts/TagManager";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { BulkTagDialog } from "@/components/contacts/BulkTagDialog";
import { BulkRemoveTagDialog } from "@/components/contacts/BulkRemoveTagDialog";

const Contacts = () => {
  const {
    contacts,
    tags,
    isLoading,
    createContact,
    updateContact,
    deleteContact,
    deleteMultipleContacts,
    importContacts,
    toggleOptOut,
    createTag,
    deleteTag,
    addTagToContact,
    removeTagFromContact,
    bulkAddTags,
    bulkRemoveTags,
    bulkOptOut,
  } = useContacts();

  // Dialogs state
  const [showContactForm, setShowContactForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [showBulkRemoveTagDialog, setShowBulkRemoveTagDialog] = useState(false);
  const [showBulkOptOutConfirm, setShowBulkOptOutConfirm] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactWithTags | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        contact.phone.includes(searchQuery) ||
        contact.name?.toLowerCase().includes(searchLower) ||
        contact.email?.toLowerCase().includes(searchLower);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !contact.opted_out) ||
        (statusFilter === "blocked" && contact.opted_out);

      const matchesTag =
        tagFilter === "all" ||
        (tagFilter === "no-tags" && (!contact.contact_tags || contact.contact_tags.length === 0)) ||
        contact.contact_tags?.some((ct) => ct.tag_id === tagFilter);

      // Date filter
      const matchesDate = (() => {
        if (dateFilter === "all") return true;
        
        const createdAt = new Date(contact.created_at);
        const today = startOfDay(new Date());
        
        switch (dateFilter) {
          case "today":
            return isToday(createdAt);
          case "yesterday":
            return isYesterday(createdAt);
          case "last7days":
            return createdAt >= subDays(today, 7);
          case "last30days":
            return createdAt >= subDays(today, 30);
          case "thisMonth":
            return isSameMonth(createdAt, today);
          case "lastMonth":
            return isSameMonth(createdAt, subMonths(today, 1));
          case "custom":
            if (customDateFrom && customDateTo) {
              return createdAt >= startOfDay(customDateFrom) && createdAt <= endOfDay(customDateTo);
            }
            if (customDateFrom) {
              return createdAt >= startOfDay(customDateFrom);
            }
            if (customDateTo) {
              return createdAt <= endOfDay(customDateTo);
            }
            return true;
          default:
            return true;
        }
      })();

      return matchesSearch && matchesStatus && matchesTag && matchesDate;
    });
  }, [contacts, searchQuery, statusFilter, tagFilter, dateFilter, customDateFrom, customDateTo]);

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredContacts.map((c) => c.id));
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

  const handleCreateContact = (data: {
    phone: string;
    name?: string;
    email?: string;
    notes?: string;
  }) => {
    createContact.mutate(data, {
      onSuccess: () => setShowContactForm(false),
    });
  };

  const handleUpdateContact = (data: {
    phone: string;
    name?: string;
    email?: string;
    notes?: string;
  }) => {
    if (!editingContact) return;
    updateContact.mutate(
      { id: editingContact.id, ...data },
      {
        onSuccess: () => {
          setEditingContact(null);
          setShowContactForm(false);
        },
      }
    );
  };

  const handleDeleteContact = () => {
    if (!deleteConfirm) return;
    deleteContact.mutate(deleteConfirm, {
      onSuccess: () => setDeleteConfirm(null),
    });
  };

  const handleBulkDelete = () => {
    deleteMultipleContacts.mutate(selectedIds, {
      onSuccess: () => {
        setSelectedIds([]);
        setBulkDeleteConfirm(false);
      },
    });
  };

  const handleExport = () => {
    const exportData = filteredContacts.map((c) => ({
      telefone: c.phone,
      nome: c.name || "",
      email: c.email || "",
      status: c.opted_out ? "bloqueado" : "ativo",
      tags: c.contact_tags?.map((ct) => ct.tags.name).join(", ") || "",
    }));

    const csv = [
      Object.keys(exportData[0] || {}).join(","),
      ...exportData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <DashboardLayout className="p-8 cyber-grid">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2 text-glow-cyan">Contatos</h1>
          <p className="text-muted-foreground">
            {contacts.length} contatos cadastrados
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTagManager(true)} className="neon-border">
            <TagIcon className="h-4 w-4 mr-2" />
            Tags
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)} className="neon-border">
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button onClick={() => setShowContactForm(true)} className="bg-gradient-neon hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por telefone, nome ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-dark-800/50 border-neon-cyan/30 focus:border-neon-cyan"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-dark-800/50 border-neon-cyan/30">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="blocked">Bloqueados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-[150px] bg-dark-800/50 border-neon-cyan/30">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tags</SelectItem>
            <SelectItem value="no-tags">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                Sem tags
              </div>
            </SelectItem>
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

        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[180px] bg-dark-800/50 border-neon-cyan/30">
            <CalendarIcon className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Data de criação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer data</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="yesterday">Ontem</SelectItem>
            <SelectItem value="last7days">Últimos 7 dias</SelectItem>
            <SelectItem value="last30days">Últimos 30 dias</SelectItem>
            <SelectItem value="thisMonth">Este mês</SelectItem>
            <SelectItem value="lastMonth">Mês passado</SelectItem>
            <SelectItem value="custom">Período customizado</SelectItem>
          </SelectContent>
        </Select>

        {dateFilter === "custom" && (
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(
                  "bg-dark-800/50 border-neon-cyan/30",
                  !customDateFrom && "text-muted-foreground"
                )}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {customDateFrom ? format(customDateFrom, "dd/MM/yy", { locale: ptBR }) : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDateFrom}
                  onSelect={setCustomDateFrom}
                  initialFocus
                  className="pointer-events-auto"
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(
                  "bg-dark-800/50 border-neon-cyan/30",
                  !customDateTo && "text-muted-foreground"
                )}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {customDateTo ? format(customDateTo, "dd/MM/yy", { locale: ptBR }) : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDateTo}
                  onSelect={setCustomDateTo}
                  initialFocus
                  className="pointer-events-auto"
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selecionado(s)
            </span>
            <Button variant="outline" size="sm" onClick={() => setShowBulkTagDialog(true)} className="neon-border">
              <TagIcon className="h-4 w-4 mr-1" />
              Taguear
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkRemoveTagDialog(true)} className="neon-border">
              <TagsIcon className="h-4 w-4 mr-1" />
              Remover Tags
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkOptOutConfirm(true)} className="neon-border">
              <UserX className="h-4 w-4 mr-1" />
              Marcar Saída
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir
            </Button>
          </div>
        )}

        {filteredContacts.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Exportar
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-neon-cyan" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-neon mb-6 pulse-neon">
            <Users className="h-10 w-10 text-dark-900" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Nenhum contato ainda</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Comece importando um arquivo CSV ou adicione contatos manualmente.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setShowImportDialog(true)} className="neon-border">
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
            <Button onClick={() => setShowContactForm(true)} className="bg-gradient-neon">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Contato
            </Button>
          </div>
        </div>
      ) : (
        <ContactsTable
          contacts={filteredContacts}
          tags={tags}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          onEdit={(contact) => {
            setEditingContact(contact);
            setShowContactForm(true);
          }}
          onDelete={(id) => setDeleteConfirm(id)}
          onToggleOptOut={(id, opted_out) => toggleOptOut.mutate({ id, opted_out })}
          onAddTag={(contactId, tagId) =>
            addTagToContact.mutate({ contactId, tagId })
          }
          onRemoveTag={(contactId, tagId) =>
            removeTagFromContact.mutate({ contactId, tagId })
          }
        />
      )}

      {/* Dialogs */}
      <ContactFormDialog
        open={showContactForm}
        onOpenChange={(open) => {
          setShowContactForm(open);
          if (!open) setEditingContact(null);
        }}
        onSubmit={editingContact ? handleUpdateContact : handleCreateContact}
        contact={editingContact}
        isLoading={createContact.isPending || updateContact.isPending}
      />

      <ImportContactsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={(contacts, tagIds) => {
          importContacts.mutate({ contacts, tagIds }, {
            onSuccess: () => setShowImportDialog(false),
          });
        }}
        isLoading={importContacts.isPending}
        tags={tags}
      />

      <TagManager
        open={showTagManager}
        onOpenChange={setShowTagManager}
        tags={tags}
        onCreateTag={(tag) => createTag.mutate(tag)}
        onDeleteTag={(id) => deleteTag.mutate(id)}
      />

      <BulkTagDialog
        open={showBulkTagDialog}
        onOpenChange={(open) => {
          setShowBulkTagDialog(open);
          if (!open) setSelectedIds([]);
        }}
        tags={tags}
        selectedCount={selectedIds.length}
        onApplyTags={(tagIds) => {
          bulkAddTags.mutate(
            { contactIds: selectedIds, tagIds },
            {
              onSuccess: () => {
                setShowBulkTagDialog(false);
                setSelectedIds([]);
              },
            }
          );
        }}
        isLoading={bulkAddTags.isPending}
      />

      <BulkRemoveTagDialog
        open={showBulkRemoveTagDialog}
        onOpenChange={(open) => {
          setShowBulkRemoveTagDialog(open);
          if (!open) setSelectedIds([]);
        }}
        tags={tags}
        selectedCount={selectedIds.length}
        onRemoveTags={(tagIds) => {
          bulkRemoveTags.mutate(
            { contactIds: selectedIds, tagIds },
            {
              onSuccess: () => {
                setShowBulkRemoveTagDialog(false);
                setSelectedIds([]);
              },
            }
          );
        }}
        isLoading={bulkRemoveTags.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="glass-card border-neon-magenta/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O contato será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContact}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent className="glass-card border-neon-magenta/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.length} contatos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os contatos selecionados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>
              Excluir todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk opt-out confirmation */}
      <AlertDialog open={showBulkOptOutConfirm} onOpenChange={setShowBulkOptOutConfirm}>
        <AlertDialogContent className="glass-card border-neon-magenta/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar {selectedIds.length} contatos como saídos?</AlertDialogTitle>
            <AlertDialogDescription>
              Os contatos selecionados serão marcados como "saídos do programa" e não receberão mais mensagens em campanhas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkOptOut.mutate(
                  { contactIds: selectedIds, opted_out: true },
                  {
                    onSuccess: () => {
                      setShowBulkOptOutConfirm(false);
                      setSelectedIds([]);
                    },
                  }
                );
              }}
            >
              {bulkOptOut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Contacts;