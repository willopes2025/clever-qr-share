import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  MoreHorizontal,
  Phone,
  Calendar,
  DollarSign,
  Clock,
  Trash2,
  Settings2,
  Filter,
  X,
  Edit,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { BulkEditFieldDialog } from "./BulkEditFieldDialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { Funnel, FunnelDeal, useFunnels } from "@/hooks/useFunnels";
import { useStageDealCounts, useLoadMoreDeals } from "@/hooks/useFunnelDeals";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { DealFormDialog } from "./DealFormDialog";
import { CloseDealDialog } from "./CloseDealDialog";
import { ColumnsConfigDialog, ColumnDefinition } from "./ColumnsConfigDialog";
import { BulkEditDialog, BulkEditUpdates } from "@/components/shared/BulkEditDialog";
import { formatForDisplay } from "@/lib/phone-utils";
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
import { toast } from "sonner";

/**
 * Convert Excel serial date number to a formatted date string (dd/MM/yyyy).
 * Also handles ISO date strings and other common date formats.
 */
function formatCustomFieldDate(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;

  // If it's a number, treat as Excel serial date
  if (typeof val === 'number' || (typeof val === 'string' && /^\d{4,5}(\.\d+)?$/.test(val.trim()))) {
    const serial = typeof val === 'number' ? val : parseFloat(val);
    if (serial > 25000 && serial < 100000) {
      // Excel serial: days since 1899-12-30
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + serial * 86400000);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  // If it's a string that looks like a date (ISO or dd/MM/yyyy)
  if (typeof val === 'string') {
    // Already formatted
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return val;
    // ISO format
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      const day = parsed.getDate().toString().padStart(2, '0');
      const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  return null;
}

interface FunnelListViewProps {
  funnel: Funnel;
  openDealId?: string | null;
  onDealOpened?: () => void;
}

type DealWithStage = FunnelDeal & {
  stageName: string;
  stageColor: string;
  isFinal: boolean;
  stage_id: string;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const FunnelListView = ({ funnel, openDealId, onDealOpened }: FunnelListViewProps) => {
  const { deleteDeal, updateDeal, closeReasons, deleteMultipleDeals, bulkUpdateDeals } = useFunnels();
  const { data: stageCounts = {} } = useStageDealCounts(funnel.id);
  const loadMoreDeals = useLoadMoreDeals();
  const { fieldDefinitions } = useCustomFields();
  const { members } = useTeamMembers();
  const [editingDeal, setEditingDeal] = useState<FunnelDeal | null>(null);
  const [closingDeal, setClosingDeal] = useState<FunnelDeal | null>(null);
  const [editingFieldDeal, setEditingFieldDeal] = useState<DealWithStage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Drag-to-scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [scrollLeftStart, setScrollLeftStart] = useState(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    setIsDragging(true);
    setDragStartX(e.pageX - container.offsetLeft);
    setScrollLeftStart(container.scrollLeft);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const container = scrollContainerRef.current;
    if (!container) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    container.scrollLeft = scrollLeftStart - walk;
  }, [isDragging, dragStartX, scrollLeftStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Column filters (key -> value)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Column configuration
  const defaultColumnIds = ["contact", "phone", "stage", "value", "time_in_stage", "expected_close"];
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultColumnIds);
  const [columnOrder, setColumnOrder] = useState<string[]>([...defaultColumnIds]);
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [isSavingColumns, setIsSavingColumns] = useState(false);
  const queryClient = useQueryClient();

  // Load saved column config from DB
  const { data: savedColumnConfig } = useQuery({
    queryKey: ['funnel-column-config', funnel.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('funnel_column_configs')
        .select('visible_columns, column_order')
        .eq('user_id', user.id)
        .eq('funnel_id', funnel.id)
        .maybeSingle();
      return data;
    },
  });

  // Apply saved config when loaded
  useEffect(() => {
    if (savedColumnConfig) {
      if (savedColumnConfig.visible_columns?.length > 0) {
        setVisibleColumns(savedColumnConfig.visible_columns);
      }
      if (savedColumnConfig.column_order?.length > 0) {
        setColumnOrder(savedColumnConfig.column_order);
      }
    }
  }, [savedColumnConfig]);

  // Bulk edit
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);

  // Calculate total deals vs loaded deals
  const totalDealsCount = useMemo(() => {
    return Object.values(stageCounts).reduce((sum, count) => sum + count, 0);
  }, [stageCounts]);

  const loadedDealsCount = useMemo(() => {
    return (funnel.stages || []).reduce((sum, stage) => sum + (stage.deals?.length || 0), 0);
  }, [funnel.stages]);

  const hasMoreDeals = totalDealsCount > loadedDealsCount;

  // Load more deals for all stages
  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      // Load more for each stage that has more deals
      const loadPromises = (funnel.stages || []).map(async (stage) => {
        const loadedCount = stage.deals?.length || 0;
        const totalCount = stageCounts[stage.id] || 0;
        
        if (loadedCount < totalCount) {
          await loadMoreDeals.mutateAsync({
            stageId: stage.id,
            funnelId: funnel.id,
            offset: loadedCount
          });
        }
      });
      
      await Promise.all(loadPromises);
    } finally {
      setLoadingMore(false);
    }
  };

  // Define all available columns
  const allColumns: ColumnDefinition[] = useMemo(() => {
    const defaultCols: ColumnDefinition[] = [
      { id: "contact", label: "Contato", type: "text", fixed: true },
      { id: "phone", label: "Telefone", type: "text" },
      { id: "stage", label: "Etapa", type: "select" },
      { id: "value", label: "Valor", type: "number" },
      { id: "time_in_stage", label: "Tempo na Etapa", type: "time" },
      { id: "expected_close", label: "Previsão", type: "date" },
    ];

    const customCols: ColumnDefinition[] = (fieldDefinitions || []).map((field) => ({
      id: `custom_${field.field_key}`,
      label: field.field_name,
      type: field.field_type,
    }));

    return [...defaultCols, ...customCols];
  }, [fieldDefinitions]);

  // Sync column order when new custom fields are added
  useEffect(() => {
    const allIds = allColumns.map((c) => c.id);
    const newIds = allIds.filter((id) => !columnOrder.includes(id));
    if (newIds.length > 0) {
      setColumnOrder((prev) => [...prev, ...newIds]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allColumns]); // Intentionally exclude columnOrder to prevent infinite loop

  // Flatten all deals from all stages
  const allDeals = useMemo(() => {
    return (funnel.stages || []).flatMap((stage) =>
      (stage.deals || []).map((deal) => ({
        ...deal,
        stageName: stage.name,
        stageColor: stage.color,
        isFinal: stage.is_final,
        stage_id: stage.id,
      }))
    );
  }, [funnel.stages]);

  const contactFilterRaw = columnFilters.contact?.trim() || "";
  const normalizedContactFilter = normalizeText(contactFilterRaw);
  const contactFilterDigits = contactFilterRaw.replace(/\D/g, "");
  const shouldSearchServerDeals = normalizedContactFilter.length >= 3 || contactFilterDigits.length >= 4;

  const { data: serverMatchedDeals = [] } = useQuery({
    queryKey: ["funnel-server-search", funnel.id, normalizedContactFilter, contactFilterDigits],
    enabled: shouldSearchServerDeals,
    queryFn: async () => {
      const matchingContactIds = new Set<string>();

      if (normalizedContactFilter.length >= 3) {
        const safeTerm = normalizedContactFilter.replace(/[,%]/g, " ");

        const { data: contactByName, error: nameError } = await supabase
          .from("contacts")
          .select("id")
          .or(`name.ilike.%${safeTerm}%,contact_display_id.ilike.%${safeTerm}%,phone.ilike.%${safeTerm}%`)
          .limit(1000);

        if (nameError) throw nameError;
        contactByName?.forEach((contact) => matchingContactIds.add(contact.id));
      }

      if (contactFilterDigits.length >= 4) {
        const { data: contactByPhone, error: phoneError } = await supabase
          .from("contacts")
          .select("id")
          .ilike("phone", `%${contactFilterDigits}%`)
          .limit(1000);

        if (phoneError) throw phoneError;
        contactByPhone?.forEach((contact) => matchingContactIds.add(contact.id));
      }

      const matchedContactIds = Array.from(matchingContactIds);
      if (matchedContactIds.length === 0) return [];

      const { data: dealsData, error: dealsError } = await supabase
        .from("funnel_deals")
        .select(`
          *,
          contact:contacts(id, name, phone, email),
          close_reason:funnel_close_reasons(*),
          stage:funnel_stages(name, color, is_final)
        `)
        .eq("funnel_id", funnel.id)
        .in("contact_id", matchedContactIds)
        .order("updated_at", { ascending: false })
        .limit(1000);

      if (dealsError) throw dealsError;

      return (dealsData || []).map((deal: any) => ({
        ...deal,
        stageName:
          deal.stage?.name || funnel.stages?.find((stage) => stage.id === deal.stage_id)?.name || "Sem etapa",
        stageColor:
          deal.stage?.color || funnel.stages?.find((stage) => stage.id === deal.stage_id)?.color || "#94A3B8",
        isFinal:
          deal.stage?.is_final || funnel.stages?.find((stage) => stage.id === deal.stage_id)?.is_final || false,
        stage_id: deal.stage_id,
      })) as DealWithStage[];
    },
    staleTime: 30000,
  });

  const searchableDeals = useMemo(() => {
    if (!shouldSearchServerDeals) return allDeals;

    const dealsMap = new Map<string, DealWithStage>();
    [...allDeals, ...serverMatchedDeals].forEach((deal) => {
      dealsMap.set(deal.id, deal);
    });

    return Array.from(dealsMap.values());
  }, [allDeals, serverMatchedDeals, shouldSearchServerDeals]);

  // Filtered deals based on column filters
  const filteredDeals = useMemo(() => {
    return searchableDeals.filter((deal) => {
      // Contact filter (name only)
      if (columnFilters.contact) {
        const normalizedDealName = normalizeText(deal.contact?.name || "");
        const normalizedDealTitle = normalizeText(deal.title || "");

        const matches =
          normalizedDealTitle.includes(normalizedContactFilter) ||
          normalizedDealName.includes(normalizedContactFilter);

        if (!matches) return false;
      }

      // Phone filter
      if (columnFilters.phone) {
        const phoneFilterDigits = columnFilters.phone.replace(/\D/g, "");
        const phoneDigits = (deal.contact?.phone || "").replace(/\D/g, "");
        if (phoneFilterDigits.length > 0 && !phoneDigits.includes(phoneFilterDigits)) return false;
        if (phoneFilterDigits.length === 0) {
          const normalizedPhone = normalizeText(deal.contact?.phone || "");
          if (!normalizedPhone.includes(normalizeText(columnFilters.phone))) return false;
        }
      }

      // Stage filter
      if (columnFilters.stage && columnFilters.stage !== "all") {
        if (deal.stage_id !== columnFilters.stage) return false;
      }

      // Value filter
      if (columnFilters.value && columnFilters.value !== "all") {
        const value = deal.value || 0;
        if (columnFilters.value === "0-1000" && value > 1000) return false;
        if (columnFilters.value === "1000-5000" && (value <= 1000 || value > 5000)) return false;
        if (columnFilters.value === "5000+" && value <= 5000) return false;
      }

      // Time in stage filter
      if (columnFilters.time_in_stage && columnFilters.time_in_stage !== "all") {
        const days = Math.floor(
          (Date.now() - new Date(deal.entered_stage_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (columnFilters.time_in_stage === "today" && days !== 0) return false;
        if (columnFilters.time_in_stage === "1-3days" && (days < 1 || days > 3)) return false;
        if (columnFilters.time_in_stage === "4-7days" && (days < 4 || days > 7)) return false;
        if (columnFilters.time_in_stage === "7+days" && days <= 7) return false;
      }

      // Custom field filters
      for (const [key, filterValue] of Object.entries(columnFilters)) {
        if (key.startsWith("custom_") && filterValue) {
          const fieldKey = key.replace("custom_", "");
          const fieldDef = fieldDefinitions?.find(f => f.field_key === fieldKey);
          let dealValue = deal.custom_fields?.[fieldKey];
          if ((dealValue === undefined || dealValue === null) && fieldDef?.entity_type === 'contact') {
            dealValue = (deal.contact as any)?.custom_fields?.[fieldKey];
          }
          if (dealValue === undefined || dealValue === null) return false;
          if (
            typeof dealValue === "string" &&
            !dealValue.toLowerCase().includes(filterValue.toLowerCase())
          ) {
            return false;
          }
          if (typeof dealValue !== "string" && String(dealValue) !== filterValue) {
            return false;
          }
        }
      }

      return true;
    });
  }, [searchableDeals, columnFilters, normalizedContactFilter, contactFilterDigits]);

  const getTimeInStage = (enteredAt: string) => {
    const days = Math.floor(
      (Date.now() - new Date(enteredAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return "Hoje";
    if (days === 1) return "1 dia";
    return `${days} dias`;
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredDeals.map((d) => d.id));
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

  const isAllSelected = filteredDeals.length > 0 && selectedIds.length === filteredDeals.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < filteredDeals.length;

  // Set column filter
  const setColumnFilter = (columnId: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [columnId]: value }));
  };

  const clearColumnFilter = (columnId: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
  };

  const hasActiveFilters = Object.keys(columnFilters).some(
    (key) => columnFilters[key] && columnFilters[key] !== "all"
  );

  const clearAllFilters = () => {
    setColumnFilters({});
  };

  // Helper to get responsible name
  const getResponsibleName = (responsibleId: string | null) => {
    if (!responsibleId) return "";
    const member = members?.find((m) => m.user_id === responsibleId);
    return member?.profile?.full_name || member?.email || "";
  };

  // Helper to get close reason name
  const getCloseReasonName = (closeReasonId: string | null) => {
    if (!closeReasonId) return "";
    const reason = closeReasons?.find((r) => r.id === closeReasonId);
    return reason?.name || "";
  };

  // Export handler - exports ALL available data
  const handleExport = () => {
    const dataToExport =
      selectedIds.length > 0
        ? filteredDeals.filter((d) => selectedIds.includes(d.id))
        : filteredDeals;

    if (dataToExport.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    // Collect all unique custom field keys from deals
    const dealCustomFieldKeys = new Set<string>();

    dataToExport.forEach((deal) => {
      if (deal.custom_fields) {
        Object.keys(deal.custom_fields).forEach((key) => dealCustomFieldKeys.add(key));
      }
      if ((deal.contact as any)?.custom_fields) {
        Object.keys((deal.contact as any).custom_fields).forEach((key) => dealCustomFieldKeys.add(key));
      }
    });

    // Build complete headers
    const headers = [
      "Nome",
      "Telefone",
      "Email",
      "ID do Contato",
      "Etapa",
      "Valor",
      "Moeda",
      "Origem",
      "Notas do Deal",
      "Responsável",
      "Próxima Ação Necessária",
      "Data Previsão Fechamento",
      "Tempo na Etapa",
      "Data Entrada na Etapa",
      "Data Criação do Deal",
      "Data Fechamento",
      "Motivo do Fechamento",
      ...Array.from(dealCustomFieldKeys).map((key) => {
        // Try to get a friendly label from field definitions
        const fieldDef = fieldDefinitions?.find(f => f.field_key === key);
        return fieldDef?.field_name || key;
      }),
    ];

    const rows = dataToExport.map((deal) => {
      return [
        deal.title || deal.contact?.name || "",
        deal.contact?.phone || "",
        deal.contact?.email || "",
        deal.contact?.id || "",
        deal.stageName,
        deal.value?.toString() || "0",
        deal.currency || "BRL",
        deal.source || "",
        deal.notes || "",
        getResponsibleName(deal.responsible_id),
        deal.next_action_required ? "Sim" : "Não",
        deal.expected_close_date
          ? format(new Date(deal.expected_close_date), "dd/MM/yyyy")
          : "",
        getTimeInStage(deal.entered_stage_at),
        format(new Date(deal.entered_stage_at), "dd/MM/yyyy HH:mm"),
        format(new Date(deal.created_at), "dd/MM/yyyy HH:mm"),
        deal.closed_at ? format(new Date(deal.closed_at), "dd/MM/yyyy HH:mm") : "",
        getCloseReasonName(deal.close_reason_id),
        ...Array.from(dealCustomFieldKeys).map((key) => {
          const fieldDef = fieldDefinitions?.find(f => f.field_key === key);
          let val = deal.custom_fields?.[key];
          if ((val === undefined || val === null) && fieldDef?.entity_type === 'contact') {
            val = (deal.contact as any)?.custom_fields?.[key];
          }
          if (val === undefined || val === null) return "";
          if (typeof val === "boolean") return val ? "Sim" : "Não";
          return String(val).replace(/;/g, ",");
        }),
      ].map((v) => (typeof v === "string" ? v.replace(/;/g, ",") : String(v)));
    });

    const csv = [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funil_${funnel.name.replace(/\s+/g, "_")}_completo_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`${dataToExport.length} registro(s) exportado(s) com sucesso!`);
  };

  // Get cell value for a deal and column
  const getCellValue = (deal: DealWithStage, columnId: string): string => {
    switch (columnId) {
      case "contact":
        return deal.title || deal.contact?.name || "Sem nome";
      case "phone":
        return deal.contact?.phone || "";
      case "stage":
        return deal.stageName;
      case "value":
        return `R$ ${Number(deal.value || 0).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}`;
      case "time_in_stage":
        return getTimeInStage(deal.entered_stage_at);
      case "expected_close":
        return deal.expected_close_date
          ? format(new Date(deal.expected_close_date), "dd/MM/yyyy")
          : "-";
      default:
        if (columnId.startsWith("custom_")) {
          const fieldKey = columnId.replace("custom_", "");
          const fieldDef = fieldDefinitions?.find(f => f.field_key === fieldKey);
          // Check deal custom_fields first, then contact custom_fields
          let val = deal.custom_fields?.[fieldKey];
          if ((val === undefined || val === null) && fieldDef?.entity_type === 'contact') {
            val = (deal.contact as any)?.custom_fields?.[fieldKey];
          }
          if (val === undefined || val === null) return "-";
          if (typeof val === "boolean") return val ? "Sim" : "Não";
          if (fieldDef && (fieldDef.field_type === 'date' || fieldDef.field_type === 'datetime')) {
            return formatCustomFieldDate(val) || String(val);
          }
          return String(val);
        }
        return "-";
    }
  };

  // Render cell content
  const renderCellContent = (deal: DealWithStage, columnId: string) => {
    switch (columnId) {
      case "contact":
        return (
          <p className="font-medium">{deal.title || deal.contact?.name || "Sem nome"}</p>
        );
      case "phone":
        return (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {formatForDisplay(deal.contact?.phone || "")}
          </p>
        );
      case "stage":
        return (
          <Badge
            variant="secondary"
            style={{ backgroundColor: `${deal.stageColor}20`, color: deal.stageColor }}
          >
            {deal.stageName}
          </Badge>
        );
      case "value":
        return (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            R$ {Number(deal.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
        );
      case "time_in_stage":
        return (
          <div className="flex items-center gap-1 text-sm">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {getTimeInStage(deal.entered_stage_at)}
          </div>
        );
      case "expected_close":
        return deal.expected_close_date ? (
          <div className="flex items-center gap-1 text-sm">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {format(new Date(deal.expected_close_date), "dd/MM/yyyy", { locale: ptBR })}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      default:
        if (columnId.startsWith("custom_")) {
          const fieldKey = columnId.replace("custom_", "");
          const fieldDef = fieldDefinitions?.find(f => f.field_key === fieldKey);
          let val = deal.custom_fields?.[fieldKey];
          if ((val === undefined || val === null) && fieldDef?.entity_type === 'contact') {
            val = (deal.contact as any)?.custom_fields?.[fieldKey];
          }
          if (val === undefined || val === null) return <span className="text-muted-foreground">-</span>;
          if (typeof val === "boolean") return val ? "Sim" : "Não";
          if (fieldDef && (fieldDef.field_type === 'date' || fieldDef.field_type === 'datetime')) {
            const formatted = formatCustomFieldDate(val);
            if (formatted) return formatted;
          }
          return String(val);
        }
        return "-";
    }
  };

  // Render column header with filter
  const renderColumnHeader = (columnId: string) => {
    const col = allColumns.find((c) => c.id === columnId);
    if (!col) return null;

    const hasFilter = columnFilters[columnId] && columnFilters[columnId] !== "all";

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 font-medium hover:bg-transparent flex items-center gap-1"
          >
            {col.label}
            {hasFilter ? (
              <Filter className="h-3 w-3 text-primary" />
            ) : (
              <ChevronDown className="h-3 w-3 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            <p className="text-sm font-medium">Filtrar por {col.label}</p>
            {renderFilterInput(columnId, col)}
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => clearColumnFilter(columnId)}
              >
                <X className="h-3 w-3 mr-1" />
                Limpar filtro
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  // Render filter input based on column type
  const renderFilterInput = (columnId: string, col: ColumnDefinition) => {
    switch (columnId) {
      case "contact":
        return (
          <Input
            placeholder="Buscar nome..."
            value={columnFilters.contact || ""}
            onChange={(e) => setColumnFilter("contact", e.target.value)}
          />
        );
      case "phone":
        return (
          <Input
            placeholder="Buscar telefone..."
            value={columnFilters.phone || ""}
            onChange={(e) => setColumnFilter("phone", e.target.value)}
          />
        );
      case "stage":
        return (
          <Select
            value={columnFilters.stage || "all"}
            onValueChange={(val) => setColumnFilter("stage", val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas etapas</SelectItem>
              {funnel.stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "value":
        return (
          <Select
            value={columnFilters.value || "all"}
            onValueChange={(val) => setColumnFilter("value", val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos valores</SelectItem>
              <SelectItem value="0-1000">Até R$ 1.000</SelectItem>
              <SelectItem value="1000-5000">R$ 1.000 - R$ 5.000</SelectItem>
              <SelectItem value="5000+">Acima de R$ 5.000</SelectItem>
            </SelectContent>
          </Select>
        );
      case "time_in_stage":
        return (
          <Select
            value={columnFilters.time_in_stage || "all"}
            onValueChange={(val) => setColumnFilter("time_in_stage", val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer tempo</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="1-3days">1-3 dias</SelectItem>
              <SelectItem value="4-7days">4-7 dias</SelectItem>
              <SelectItem value="7+days">Mais de 7 dias</SelectItem>
            </SelectContent>
          </Select>
        );
      default:
        // Custom fields - use text input for now
        return (
          <Input
            placeholder={`Filtrar ${col.label}...`}
            value={columnFilters[columnId] || ""}
            onChange={(e) => setColumnFilter(columnId, e.target.value)}
          />
        );
    }
  };

  // Handle bulk edit with new dialog
  const handleBulkEdit = async (updates: BulkEditUpdates) => {
    if (selectedIds.length === 0) return;

    setIsBulkEditing(true);
    try {
      await bulkUpdateDeals.mutateAsync({
        dealIds: selectedIds,
        updates: {
          value: updates.value,
          stage_id: updates.stage_id,
          responsible_id: updates.responsible_id,
          expected_close_date: updates.expected_close_date,
          custom_field: updates.custom_field,
        },
      });
      setBulkEditDialogOpen(false);
      setSelectedIds([]);
    } finally {
      setIsBulkEditing(false);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    await deleteMultipleDeals.mutateAsync(selectedIds);
    setSelectedIds([]);
    setBulkDeleteConfirm(false);
  };

  // Handle columns config save
  const handleColumnsConfigSave = useCallback(async (newVisible: string[], newOrder: string[], applyToMemberIds?: string[]) => {
    setVisibleColumns(newVisible);
    setColumnOrder(newOrder);
    setIsSavingColumns(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save for current user
      const userIds = [user.id, ...(applyToMemberIds || [])];
      
      for (const userId of userIds) {
        await supabase
          .from('funnel_column_configs')
          .upsert({
            user_id: userId,
            funnel_id: funnel.id,
            visible_columns: newVisible,
            column_order: newOrder,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,funnel_id' });
      }

      queryClient.invalidateQueries({ queryKey: ['funnel-column-config', funnel.id] });
      
      const toast = (await import("sonner")).toast;
      if (applyToMemberIds && applyToMemberIds.length > 0) {
        toast.success(`Colunas salvas e aplicadas para ${applyToMemberIds.length} integrante(s)`);
      } else {
        toast.success("Configuração de colunas salva");
      }
    } catch (error) {
      console.error("Error saving column config:", error);
    } finally {
      setIsSavingColumns(false);
      setColumnsDialogOpen(false);
    }
  }, [funnel.id, queryClient]);

  // Get ordered visible columns
  const orderedVisibleColumns = columnOrder.filter((id) => visibleColumns.includes(id));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setColumnsDialogOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Colunas
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selecionado(s)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkEditDialogOpen(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar em Massa
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredDeals.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Todos os Dados
          </Button>
        </div>
      </div>

      {/* Table with horizontal scroll */}
        <div className="rounded-xl border bg-card">
          <div
            ref={scrollContainerRef}
            className={`w-full whitespace-nowrap overflow-x-auto funnel-list-scroll ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="min-w-max">
              <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 sticky left-0 bg-card z-10">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Selecionar todos"
                  {...(isSomeSelected ? { "data-state": "indeterminate" } : {})}
                />
              </TableHead>
              {orderedVisibleColumns.map((colId) => (
                <TableHead key={colId} className="whitespace-nowrap">
                  {renderColumnHeader(colId)}
                </TableHead>
              ))}
              <TableHead className="w-[50px] sticky right-0 bg-card z-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDeals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={orderedVisibleColumns.length + 2}
                  className="text-center py-8 text-muted-foreground"
                >
                  {hasActiveFilters
                    ? "Nenhum deal encontrado com os filtros aplicados."
                    : "Nenhum deal neste funil"}
                </TableCell>
              </TableRow>
            ) : (
              filteredDeals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell className="sticky left-0 bg-card z-10">
                    <Checkbox
                      checked={selectedIds.includes(deal.id)}
                      onCheckedChange={(checked) => handleSelectOne(deal.id, !!checked)}
                      aria-label={`Selecionar ${deal.title || deal.contact?.name}`}
                    />
                  </TableCell>
                  {orderedVisibleColumns.map((colId) => (
                    <TableCell key={colId} className="whitespace-nowrap">
                      {renderCellContent(deal, colId)}
                    </TableCell>
                  ))}
                  <TableCell className="sticky right-0 bg-card z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingDeal(deal)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            Alterar Etapa
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {(funnel.stages || []).map((stage) => (
                              <DropdownMenuItem
                                key={stage.id}
                                disabled={stage.id === deal.stage_id}
                                onClick={() => {
                                  updateDeal.mutate({
                                    id: deal.id,
                                    stage_id: stage.id,
                                  });
                                }}
                              >
                                <div
                                  className="w-2 h-2 rounded-full mr-2 shrink-0"
                                  style={{ backgroundColor: stage.color || '#888' }}
                                />
                                {stage.name}
                                {stage.id === deal.stage_id && (
                                  <span className="ml-auto text-xs text-muted-foreground">atual</span>
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem onClick={() => setEditingFieldDeal(deal)}>
                          Alterar Campo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {!deal.isFinal && (
                          <DropdownMenuItem onClick={() => setClosingDeal(deal)}>
                            Fechar Deal
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteDeal.mutate(deal.id)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
            </TableBody>
          </Table>
            </div>
          </div>
        </div>

      {/* Load More Button */}
      {hasMoreDeals && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Carregando...
              </>
            ) : (
              <>
                Carregar mais ({totalDealsCount - loadedDealsCount} restantes)
              </>
            )}
          </Button>
        </div>
      )}

      {editingDeal && (
        <DealFormDialog
          open={!!editingDeal}
          onOpenChange={() => setEditingDeal(null)}
          funnelId={funnel.id}
          stageId={editingDeal.stage_id}
          deal={editingDeal}
        />
      )}

      {closingDeal && (
        <CloseDealDialog
          open={!!closingDeal}
          onOpenChange={() => setClosingDeal(null)}
          deal={closingDeal}
          stages={funnel.stages || []}
        />
      )}

      <ColumnsConfigDialog
        open={columnsDialogOpen}
        onOpenChange={setColumnsDialogOpen}
        columns={allColumns}
        visibleColumns={visibleColumns}
        columnOrder={columnOrder}
        onSave={handleColumnsConfigSave}
        teamMembers={members}
        isSaving={isSavingColumns}
      />

      <BulkEditDialog
        open={bulkEditDialogOpen}
        onOpenChange={setBulkEditDialogOpen}
        mode="deals"
        selectedCount={selectedIds.length}
        fieldDefinitions={fieldDefinitions || []}
        stages={funnel.stages || []}
        members={members || []}
        onConfirm={handleBulkEdit}
        isLoading={isBulkEditing}
      />

      <BulkEditFieldDialog
        open={!!editingFieldDeal}
        onOpenChange={(open) => { if (!open) setEditingFieldDeal(null); }}
        selectedCount={1}
        fieldDefinitions={(fieldDefinitions || []).filter(f => f.entity_type === 'lead')}
        onConfirm={async (fieldKey, value) => {
          if (!editingFieldDeal) return;
          const currentFields = (editingFieldDeal.custom_fields || {}) as Record<string, unknown>;
          updateDeal.mutate({
            id: editingFieldDeal.id,
            custom_fields: { ...currentFields, [fieldKey]: value },
          });
          setEditingFieldDeal(null);
        }}
      />

      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir leads selecionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir {selectedIds.length} lead(s) permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
