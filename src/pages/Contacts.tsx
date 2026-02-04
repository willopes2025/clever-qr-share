import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/layouts/AppLayout";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
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
  Settings2,
  CheckSquare,
  Edit,
} from "lucide-react";
import { format, isToday, isYesterday, subDays, isSameMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useContacts, ContactWithDeals } from "@/hooks/useContacts";
import { useFunnels } from "@/hooks/useFunnels";
import { ContactFormDialog } from "@/components/contacts/ContactFormDialog";
import { ImportContactsDialogV2 } from "@/components/contacts/ImportContactsDialogV2";
import { TagManager } from "@/components/contacts/TagManager";
import { ContactsTableConfigurable } from "@/components/contacts/ContactsTableConfigurable";
import { ContactsColumnsConfig } from "@/components/contacts/ContactsColumnsConfig";
import { BulkTagDialog } from "@/components/contacts/BulkTagDialog";
import { BulkRemoveTagDialog } from "@/components/contacts/BulkRemoveTagDialog";
import { BulkEditDialog, BulkEditUpdates } from "@/components/shared/BulkEditDialog";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useSubscription } from "@/hooks/useSubscription";

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
    bulkUpdateContacts,
  } = useContacts();

  const { fieldDefinitions } = useCustomFields();
  const { subscription } = useSubscription();
  const { createDeal, funnels } = useFunnels();

  // Dialogs state
  const [showContactForm, setShowContactForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [showBulkRemoveTagDialog, setShowBulkRemoveTagDialog] = useState(false);
  const [showBulkOptOutConfirm, setShowBulkOptOutConfirm] = useState(false);
  const [showColumnsConfig, setShowColumnsConfig] = useState(false);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactWithDeals | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Columns configuration state
  const DEFAULT_VISIBLE_COLUMNS = ['contact_display_id', 'phone', 'name', 'tags', 'status', 'created_at'];
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [customFieldKey, setCustomFieldKey] = useState<string>("");
  const [customFieldValue, setCustomFieldValue] = useState<string>("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

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

      // Custom field filter
      const matchesCustomField = (() => {
        if (!customFieldKey || !customFieldValue) return true;
        const fieldVal = contact.custom_fields?.[customFieldKey];
        if (fieldVal === undefined || fieldVal === null) return false;
        return String(fieldVal).toLowerCase().includes(customFieldValue.toLowerCase());
      })();

      return matchesSearch && matchesStatus && matchesTag && matchesDate && matchesCustomField;
    });
  }, [contacts, searchQuery, statusFilter, tagFilter, dateFilter, customDateFrom, customDateTo, customFieldKey, customFieldValue]);

  // Pagination logic
  const totalPages = Math.ceil(filteredContacts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedContacts = filteredContacts.slice(startIndex, startIndex + pageSize);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, tagFilter, dateFilter, customDateFrom, customDateTo, customFieldKey, customFieldValue, pageSize]);

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select only contacts on current page
      setSelectedIds(paginatedContacts.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(filteredContacts.map((c) => c.id));
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
    custom_fields?: Record<string, unknown>;
    funnel_id?: string;
    stage_id?: string;
  }) => {
    const { funnel_id, stage_id, custom_fields, ...contactData } = data;
    
    // Convert custom_fields to expected type
    const typedCustomFields = custom_fields 
      ? Object.fromEntries(
          Object.entries(custom_fields).map(([k, v]) => [k, String(v ?? '')])
        )
      : undefined;
    
    createContact.mutate({ ...contactData, custom_fields: typedCustomFields }, {
      onSuccess: (createdContact) => {
        // If funnel and stage were selected, create the deal
        if (funnel_id && stage_id && createdContact?.id) {
          createDeal.mutate({
            funnel_id,
            stage_id,
            contact_id: createdContact.id,
            title: data.name || 'Novo Lead',
          });
        }
        setShowContactForm(false);
      },
    });
  };

  const handleUpdateContact = (data: {
    phone: string;
    name?: string;
    email?: string;
    notes?: string;
    custom_fields?: Record<string, unknown>;
    funnel_id?: string;
    stage_id?: string;
  }) => {
    if (!editingContact) return;
    
    const { funnel_id, stage_id, custom_fields, ...contactData } = data;
    
    // Convert custom_fields to expected type
    const typedCustomFields = custom_fields 
      ? Object.fromEntries(
          Object.entries(custom_fields).map(([k, v]) => [k, String(v ?? '')])
        )
      : undefined;
    
    updateContact.mutate(
      { id: editingContact.id, ...contactData, custom_fields: typedCustomFields },
      {
        onSuccess: () => {
          // Handle funnel/deal updates
          if (funnel_id && stage_id) {
            const existingDeal = editingContact.funnel_deals?.find(d => !d.closed_at);
            
            if (existingDeal) {
              // If deal exists and stage/funnel changed, update it
              if (existingDeal.funnel_id !== funnel_id || existingDeal.stage_id !== stage_id) {
                // Note: changing funnel requires creating a new deal
                if (existingDeal.funnel_id !== funnel_id) {
                  // Create new deal in new funnel
                  createDeal.mutate({
                    funnel_id,
                    stage_id,
                    contact_id: editingContact.id,
                    title: data.name || editingContact.name || 'Novo Lead',
                  });
                }
                // If only stage changed within same funnel, we can update the deal (handled by updateDeal if available)
              }
            } else {
              // No existing open deal, create one
              createDeal.mutate({
                funnel_id,
                stage_id,
                contact_id: editingContact.id,
                title: data.name || editingContact.name || 'Novo Lead',
              });
            }
          }
          
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

  // Handle bulk edit for contacts
  const handleBulkEditContacts = async (updates: BulkEditUpdates) => {
    if (selectedIds.length === 0) return;
    
    setIsBulkEditing(true);
    try {
      await bulkUpdateContacts.mutateAsync({
        contactIds: selectedIds,
        updates: {
          custom_field: updates.custom_field,
          funnel_assignment: updates.funnel_assignment,
        },
      });
      setShowBulkEditDialog(false);
      setSelectedIds([]);
    } finally {
      setIsBulkEditing(false);
    }
  };

  const handleExport = () => {
    // Collect all unique custom field keys used across contacts
    const allCustomFieldKeys = new Set<string>();
    filteredContacts.forEach((c) => {
      if (c.custom_fields) {
        Object.keys(c.custom_fields).forEach((key) => {
          if (c.custom_fields![key] !== null && c.custom_fields![key] !== '') {
            allCustomFieldKeys.add(key);
          }
        });
      }
    });

    const exportData = filteredContacts.map((c) => {
      // Get the most recent open deal, or the most recent closed deal
      const activeDeal = c.funnel_deals?.find((d) => !d.closed_at) || c.funnel_deals?.[0];

      // Build custom fields data
      const customFieldData: Record<string, string> = {};
      allCustomFieldKeys.forEach((key) => {
        const fieldDef = fieldDefinitions?.find((f) => f.field_key === key);
        const label = fieldDef?.field_name || key;
        const val = c.custom_fields?.[key];
        customFieldData[label] = val !== null && val !== undefined ? String(val) : "";
      });

      return {
        telefone: c.phone,
        nome: c.name || "",
        email: c.email || "",
        status: c.opted_out ? "bloqueado" : "ativo",
        tags: c.contact_tags?.map((ct) => ct.tags.name).join(", ") || "",
        // Funnel data
        funil: activeDeal?.funnels?.name || "",
        etapa: activeDeal?.funnel_stages?.name || "",
        valor_deal: activeDeal?.value?.toString() || "",
        data_entrada_etapa: activeDeal?.entered_stage_at
          ? format(new Date(activeDeal.entered_stage_at), "dd/MM/yyyy HH:mm")
          : "",
        previsao_fechamento: activeDeal?.expected_close_date
          ? format(new Date(activeDeal.expected_close_date), "dd/MM/yyyy")
          : "",
        deal_fechado_em: activeDeal?.closed_at
          ? format(new Date(activeDeal.closed_at), "dd/MM/yyyy HH:mm")
          : "",
        // Custom fields
        ...customFieldData,
      };
    });

    const headers = Object.keys(exportData[0] || {});
    const csv = [
      headers.join(";"),
      ...exportData.map((row) =>
        headers
          .map((h) => {
            const val = row[h as keyof typeof row];
            // Escape semicolons and quotes
            if (typeof val === "string" && (val.includes(";") || val.includes('"'))) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val ?? "";
          })
          .join(";")
      ),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout pageTitle="Contatos" className="p-4 md:p-8 cyber-grid">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2 text-glow-cyan">Contatos</h1>
          <p className="text-muted-foreground">
            {contacts.length} contatos cadastrados
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowColumnsConfig(true)} className="neon-border">
            <Settings2 className="h-4 w-4 mr-2" />
            Colunas
          </Button>
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

        {/* Custom field filter */}
        <Select value={customFieldKey || "none"} onValueChange={(v) => {
          const newKey = v === "none" ? "" : v;
          setCustomFieldKey(newKey);
          if (!newKey) setCustomFieldValue("");
        }}>
          <SelectTrigger className="w-[180px] bg-dark-800/50 border-neon-cyan/30">
            <SelectValue placeholder="Campo personalizado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {fieldDefinitions?.map((field) => (
              <SelectItem key={field.id} value={field.field_key}>
                {field.field_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {customFieldKey && (
          <Input
            placeholder="Valor do campo..."
            value={customFieldValue}
            onChange={(e) => setCustomFieldValue(e.target.value)}
            className="w-[150px] bg-dark-800/50 border-neon-cyan/30 focus:border-neon-cyan"
          />
        )}

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

        {/* Bulk select all filtered option */}
        {filteredContacts.length > 0 && selectedIds.length < filteredContacts.length && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSelectAllFiltered}
            className="neon-border"
          >
            <CheckSquare className="h-4 w-4 mr-1" />
            Selecionar todos ({filteredContacts.length})
          </Button>
        )}

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selecionado(s)
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Limpar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkTagDialog(true)} className="neon-border">
              <TagIcon className="h-4 w-4 mr-1" />
              Taguear
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkRemoveTagDialog(true)} className="neon-border">
              <TagsIcon className="h-4 w-4 mr-1" />
              Remover Tags
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkEditDialog(true)} className="neon-border">
              <Edit className="h-4 w-4 mr-1" />
              Editar Campos
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
        <div className="space-y-4">
          <ContactsTableConfigurable
            contacts={paginatedContacts}
            tags={tags}
            selectedIds={selectedIds}
            visibleColumns={visibleColumns}
            columnOrder={columnOrder}
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

          {/* Pagination controls */}
          <div className="flex items-center justify-between px-2 py-4 border-t border-border/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Itens por página:</span>
                <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[80px] bg-dark-800/50 border-neon-cyan/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1}-{Math.min(startIndex + pageSize, filteredContacts.length)} de {filteredContacts.length} contatos
                {filteredContacts.length !== contacts.length && (
                  <span className="ml-1">({contacts.length} total)</span>
                )}
              </span>
            </div>

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>

                  {/* First page */}
                  {currentPage > 2 && (
                    <PaginationItem>
                      <PaginationLink onClick={() => setCurrentPage(1)}>1</PaginationLink>
                    </PaginationItem>
                  )}

                  {currentPage > 3 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  {/* Current page neighborhood */}
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                    const page = Math.max(1, Math.min(currentPage - 1, totalPages - 2)) + i;
                    if (page < 1 || page > totalPages) return null;
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink 
                          onClick={() => setCurrentPage(page)}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  {currentPage < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  {/* Last page */}
                  {currentPage < totalPages - 1 && totalPages > 3 && (
                    <PaginationItem>
                      <PaginationLink onClick={() => setCurrentPage(totalPages)}>{totalPages}</PaginationLink>
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </div>
      )}

      {/* Columns config dialog */}
      <ContactsColumnsConfig
        open={showColumnsConfig}
        onOpenChange={setShowColumnsConfig}
        visibleColumns={visibleColumns}
        columnOrder={columnOrder}
        fieldDefinitions={fieldDefinitions || []}
        onSave={(visible, order) => {
          setVisibleColumns(visible);
          setColumnOrder(order);
        }}
      />

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
        currentDeal={editingContact?.funnel_deals?.find(d => !d.closed_at) ? {
          funnel_id: editingContact.funnel_deals.find(d => !d.closed_at)!.funnel_id,
          stage_id: editingContact.funnel_deals.find(d => !d.closed_at)!.stage_id,
        } : null}
      />

      <ImportContactsDialogV2
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={async (contacts, tagIds, newFields, deduplication, phoneNormalization) => {
          await importContacts.mutateAsync({ contacts, tagIds, newFields, deduplication, phoneNormalization });
          setShowImportDialog(false);
        }}
        isLoading={importContacts.isPending}
        tags={tags}
        existingFields={fieldDefinitions}
        currentContactCount={contacts.length}
        maxContacts={subscription?.max_contacts ?? null}
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

      {/* Bulk Edit Dialog */}
      <BulkEditDialog
        open={showBulkEditDialog}
        onOpenChange={(open) => {
          setShowBulkEditDialog(open);
          if (!open) setSelectedIds([]);
        }}
        mode="contacts"
        selectedCount={selectedIds.length}
        fieldDefinitions={fieldDefinitions || []}
        funnels={funnels || []}
        onConfirm={handleBulkEditContacts}
        isLoading={isBulkEditing}
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
    </AppLayout>
  );
};

export default Contacts;