import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  Send,
  MessageSquare,
  Merge,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GripVertical,
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
import { MultiSelect } from "@/components/ui/multi-select";

import { Funnel, FunnelDeal, useFunnels } from "@/hooks/useFunnels";
import { useStageDealCounts, useLoadMoreDeals } from "@/hooks/useFunnelDeals";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { DealFormDialog } from "./DealFormDialog";
import { CloseDealDialog } from "./CloseDealDialog";
import { ColumnsConfigDialog, ColumnDefinition } from "./ColumnsConfigDialog";
import { CustomFieldsManager } from "@/components/inbox/CustomFieldsManager";
import { RequiredFieldsCheckDialog } from "./RequiredFieldsCheckDialog";
import { useFieldRequiredRules } from "@/hooks/useFieldRequiredRules";
import { getMissingRequiredFields } from "@/lib/required-fields";
import type { CustomFieldDefinition } from "@/hooks/useCustomFields";
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
import { OpportunityBroadcastDialog } from "./OpportunityBroadcastDialog";
import { MergeDealsDialog } from "./MergeDealsDialog";

/**
 * Convert Excel serial date number to a formatted date string (dd/MM/yyyy).
 * Also handles ISO date strings and other common date formats.
 * Uses the shared utility from date-utils.
 */
import { formatDateValue, formatCustomFieldValue, isDateLikeFieldName } from "@/lib/date-utils";

function formatCustomFieldDate(val: any): string | null {
  return formatDateValue(val);
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
  const navigate = useNavigate();
  const { deleteDeal, updateDeal, closeReasons, deleteMultipleDeals, bulkUpdateDeals, funnels: allFunnels } = useFunnels();
  const { data: stageCounts = {} } = useStageDealCounts(funnel.id);
  const loadMoreDeals = useLoadMoreDeals();
  const { fieldDefinitions, leadFieldDefinitions, deleteField } = useCustomFields();
  const { rules: requiredRules } = useFieldRequiredRules();
  const { members } = useTeamMembers();
  const [editingDeal, setEditingDeal] = useState<FunnelDeal | null>(null);
  const [closingDeal, setClosingDeal] = useState<FunnelDeal | null>(null);
  const [editingFieldDeal, setEditingFieldDeal] = useState<DealWithStage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageSize, setPageSize] = useState<number>(50);

  // Validação de campos obrigatórios ao mover etapa
  const [pendingMove, setPendingMove] = useState<{
    deal: FunnelDeal;
    targetStageId: string;
    targetStageName: string;
    isFinal: boolean;
    missing: CustomFieldDefinition[];
  } | null>(null);

  /**
   * Tenta mover um deal para outra etapa. Se houver campos obrigatórios faltantes,
   * abre o dialog de validação. Caso contrário, faz o update direto.
   */
  const requestStageChange = (deal: FunnelDeal, targetStageId: string) => {
    const targetStage = funnel.stages?.find((s) => s.id === targetStageId);
    if (!targetStage) return;
    const missing = leadFieldDefinitions
      ? getMissingRequiredFields({
          funnelId: funnel.id,
          stageId: targetStageId,
          stages: funnel.stages || [],
          fieldDefinitions: leadFieldDefinitions,
          rules: requiredRules || [],
          values: (deal.custom_fields as Record<string, unknown>) || {},
        })
      : [];

    if (missing.length > 0) {
      setPendingMove({
        deal,
        targetStageId,
        targetStageName: targetStage.name,
        isFinal: !!targetStage.is_final,
        missing,
      });
      return;
    }
    updateDeal.mutate({
      id: deal.id,
      stage_id: targetStageId,
      ...(targetStage.is_final ? { closed_at: new Date().toISOString() } : { closed_at: null }),
    });
  };

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
  const [showBroadcast, setShowBroadcast] = useState(false);

  // Column filters (key -> value)
  const [columnFilters, setColumnFilters] = useState<Record<string, string | string[]>>({});

  // Column configuration
  const defaultColumnIds = ["contact", "phone", "stage", "value", "time_in_stage", "expected_close"];
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultColumnIds);
  const [columnOrder, setColumnOrder] = useState<string[]>([...defaultColumnIds]);
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [isSavingColumns, setIsSavingColumns] = useState(false);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [fieldsManagerOpen, setFieldsManagerOpen] = useState(false);
  const [fieldsManagerInitialId, setFieldsManagerInitialId] = useState<string | null>(null);
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

  // Sanitiza arrays de colunas: remove duplicatas e garante "phone" logo após "contact"
  const sanitizeColumnArray = useCallback((ids: string[]): string[] => {
    // Dedup preservando primeira ocorrência
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const id of ids) {
      if (id && !seen.has(id)) {
        seen.add(id);
        deduped.push(id);
      }
    }
    // Remove "phone" para reposicionar
    const withoutPhone = deduped.filter((id) => id !== "phone");
    const contactIdx = withoutPhone.indexOf("contact");
    if (contactIdx >= 0) {
      withoutPhone.splice(contactIdx + 1, 0, "phone");
    } else {
      withoutPhone.unshift("phone");
    }
    return withoutPhone;
  }, []);

  // Apply saved config when loaded
  useEffect(() => {
    if (savedColumnConfig) {
      if (savedColumnConfig.visible_columns?.length > 0) {
        setVisibleColumns(sanitizeColumnArray(savedColumnConfig.visible_columns));
      }
      if (savedColumnConfig.column_order?.length > 0) {
        setColumnOrder(sanitizeColumnArray(savedColumnConfig.column_order));
      }
    }
  }, [savedColumnConfig, sanitizeColumnArray]);

  // Bulk edit
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(null);

  const setSort = (columnId: string, direction: 'asc' | 'desc' | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ columnId, direction });
  };

  // Calculate total deals vs loaded deals
  const totalDealsCount = useMemo(() => {
    return Object.values(stageCounts).reduce((sum, count) => sum + count, 0);
  }, [stageCounts]);

  const loadedDealsCount = useMemo(() => {
    return (funnel.stages || []).reduce((sum, stage) => sum + (stage.deals?.length || 0), 0);
  }, [funnel.stages]);

  const hasMoreDeals = totalDealsCount > loadedDealsCount;

  // Load more deals for all stages
  const handleLoadMore = async (customLimit?: number) => {
    setLoadingMore(true);
    const limit = customLimit || pageSize;
    try {
      const loadPromises = (funnel.stages || []).map(async (stage) => {
        const loadedCount = stage.deals?.length || 0;
        const totalCount = stageCounts[stage.id] || 0;
        
        if (loadedCount < totalCount) {
          await loadMoreDeals.mutateAsync({
            stageId: stage.id,
            funnelId: funnel.id,
            offset: loadedCount,
            limit,
          });
        }
      });
      
      await Promise.all(loadPromises);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLoadAll = async () => {
    setLoadingMore(true);
    try {
      const loadPromises = (funnel.stages || []).map(async (stage) => {
        let loadedCount = stage.deals?.length || 0;
        const totalCount = stageCounts[stage.id] || 0;
        while (loadedCount < totalCount) {
          const batch = await loadMoreDeals.mutateAsync({
            stageId: stage.id,
            funnelId: funnel.id,
            offset: loadedCount,
            limit: 200,
          });
          loadedCount += batch.length;
          if (batch.length === 0) break;
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

    // Dedup custom fields by field_key (mesmo key em orgs distintas pode duplicar)
    const seenKeys = new Set<string>();
    const customCols: ColumnDefinition[] = [];
    for (const field of fieldDefinitions || []) {
      if (seenKeys.has(field.field_key)) continue;
      seenKeys.add(field.field_key);
      customCols.push({
        id: `custom_${field.field_key}`,
        label: field.field_name,
        type: field.field_type,
        customFieldId: field.id,
      });
    }

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

  // Open deal from global search - fetch from server if not loaded locally
  useEffect(() => {
    if (!openDealId) return;
    
    const localDeal = allDeals.find(d => d.id === openDealId);
    if (localDeal) {
      setEditingDeal(localDeal);
      onDealOpened?.();
      return;
    }

    // Deal not loaded locally - fetch from server
    const fetchDeal = async () => {
      const { data, error } = await supabase
        .from("funnel_deals")
        .select(`
          *,
          contact:contacts(id, name, phone, email, custom_fields),
          close_reason:funnel_close_reasons(*)
        `)
        .eq("id", openDealId)
        .maybeSingle();

      if (!error && data) {
        setEditingDeal(data as FunnelDeal);
      }
      onDealOpened?.();
    };

    fetchDeal();
  }, [openDealId, allDeals, onDealOpened]);

  const getFilterStr = (key: string): string => {
    const v = columnFilters[key];
    return typeof v === 'string' ? v : '';
  };
  const contactFilterRaw = getFilterStr('contact').trim();
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
      const phoneFilter = typeof columnFilters.phone === 'string' ? columnFilters.phone : '';
      if (phoneFilter) {
        const phoneFilterDigits = phoneFilter.replace(/\D/g, "");
        const phoneDigits = (deal.contact?.phone || "").replace(/\D/g, "");
        if (phoneFilterDigits.length > 0 && !phoneDigits.includes(phoneFilterDigits)) return false;
        if (phoneFilterDigits.length === 0) {
          const normalizedPhone = normalizeText(deal.contact?.phone || "");
          if (!normalizedPhone.includes(normalizeText(phoneFilter))) return false;
        }
      }

      // Stage filter (multi-select array or legacy single string)
      if (columnFilters.stage && columnFilters.stage !== "all") {
        const stageFilter = columnFilters.stage;
        if (Array.isArray(stageFilter)) {
          if (stageFilter.length > 0 && !stageFilter.includes(deal.stage_id)) return false;
        } else {
          if (deal.stage_id !== stageFilter) return false;
        }
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
      for (const [key, rawFilterValue] of Object.entries(columnFilters)) {
        if (key.startsWith("custom_") && rawFilterValue) {
          const filterValue = typeof rawFilterValue === 'string' ? rawFilterValue : '';
          if (!filterValue) continue;
          // Skip date range helper keys (they are handled below)
          if (key.endsWith('_from') || key.endsWith('_to')) {
            // Handle date range filters
            const baseKey = key.replace(/_from$|_to$/, '');
            const fieldKey = baseKey.replace("custom_", "");
            const fieldDef = fieldDefinitions?.find(f => f.field_key === fieldKey);
            let dealValue = deal.custom_fields?.[fieldKey];
            if ((dealValue === undefined || dealValue === null) && fieldDef?.entity_type === 'contact') {
              dealValue = (deal.contact as any)?.custom_fields?.[fieldKey];
            }
            // Deal has no date value — exclude it from the date range filter
            if (dealValue === undefined || dealValue === null) return false;

            // Parse the deal's date value to YYYY-MM-DD for comparison
            let dealDateStr = '';
            if (typeof dealValue === 'string') {
              if (/^\d{4}-\d{2}-\d{2}/.test(dealValue)) {
                dealDateStr = dealValue.split('T')[0];
              } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dealValue)) {
                const [d, m, y] = dealValue.split('/');
                dealDateStr = `${y}-${m}-${d}`;
              }
            }
            if (!dealDateStr) return false;

            // Validate range direction to avoid empty result sets
            if (key.endsWith('_from')) {
              const toValue = columnFilters[`${baseKey}_to`] as string | undefined;
              if (toValue && filterValue > toValue) return true; // invalid range — skip filter
              if (dealDateStr < filterValue) return false;
            }
            if (key.endsWith('_to')) {
              const fromValue = columnFilters[`${baseKey}_from`] as string | undefined;
              if (fromValue && fromValue > filterValue) return true; // invalid range — skip filter
              if (dealDateStr > filterValue) return false;
            }
            continue;
          }
          
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
  }, [searchableDeals, columnFilters, normalizedContactFilter, contactFilterDigits, fieldDefinitions]);

  // Apply sorting on top of filtering
  const sortedDeals = useMemo(() => {
    if (!sortConfig) return filteredDeals;
    const { columnId, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;

    const numericCols = new Set(['value']);
    const dateCols = new Set(['expected_close', 'time_in_stage']);

    const getSortKey = (deal: DealWithStage): { num: number | null; str: string } => {
      if (columnId === 'value') {
        return { num: Number(deal.value || 0), str: '' };
      }
      if (columnId === 'time_in_stage') {
        const t = new Date(deal.entered_stage_at).getTime();
        return { num: isNaN(t) ? null : t, str: '' };
      }
      if (columnId === 'expected_close') {
        if (!deal.expected_close_date) return { num: null, str: '' };
        const t = new Date(deal.expected_close_date).getTime();
        return { num: isNaN(t) ? null : t, str: '' };
      }
      if (columnId.startsWith('custom_')) {
        const fieldKey = columnId.replace('custom_', '');
        const fieldDef = fieldDefinitions?.find(f => f.field_key === fieldKey);
        let val: any = deal.custom_fields?.[fieldKey];
        if ((val === undefined || val === null) && fieldDef?.entity_type === 'contact') {
          val = (deal.contact as any)?.custom_fields?.[fieldKey];
        }
        if (val === undefined || val === null || val === '') return { num: null, str: '' };
        if (fieldDef?.field_type === 'number') {
          const n = Number(val);
          return { num: isNaN(n) ? null : n, str: '' };
        }
        const isDateField = fieldDef
          ? (fieldDef.field_type === 'date' || fieldDef.field_type === 'datetime')
          : isDateLikeFieldName(String(fieldKey));
        if (isDateField) {
          // Parse common formats
          let s = String(val);
          if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
            const [d, m, y] = s.split('/');
            s = `${y}-${m}-${d}`;
          }
          const t = new Date(s).getTime();
          return { num: isNaN(t) ? null : t, str: '' };
        }
        return { num: null, str: String(val) };
      }
      // Default: derive a sortable string from common columns
      let text = '';
      switch (columnId) {
        case 'contact':
          text = deal.title || deal.contact?.name || '';
          break;
        case 'phone':
          text = deal.contact?.phone || '';
          break;
        case 'stage':
          text = deal.stageName || '';
          break;
        default:
          text = '';
      }
      return { num: null, str: text };
    };

    const arr = [...filteredDeals];
    arr.sort((a, b) => {
      const ka = getSortKey(a);
      const kb = getSortKey(b);

      // Empty values always go to the end (regardless of direction)
      const aEmpty = ka.num === null && !ka.str;
      const bEmpty = kb.num === null && !kb.str;
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;

      if (ka.num !== null && kb.num !== null) {
        return (ka.num - kb.num) * dir;
      }
      return ka.str.localeCompare(kb.str, 'pt-BR', { sensitivity: 'base', numeric: true }) * dir;
    });
    return arr;
  }, [filteredDeals, sortConfig, fieldDefinitions]);

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
      setSelectedIds(sortedDeals.map((d) => d.id));
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

  const isAllSelected = sortedDeals.length > 0 && selectedIds.length === sortedDeals.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < sortedDeals.length;

  // Set column filter
  const setColumnFilter = (columnId: string, value: string | string[]) => {
    setColumnFilters((prev) => ({ ...prev, [columnId]: value }));
  };

  const clearColumnFilter = (columnId: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[columnId];
      // Also clear date range helpers
      delete next[`${columnId}_from`];
      delete next[`${columnId}_to`];
      return next;
    });
  };

  const hasActiveFilters = Object.keys(columnFilters).some((key) => {
    const v = columnFilters[key];
    if (Array.isArray(v)) return v.length > 0;
    return v && v !== "all";
  });

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

    const escapeCsvField = (v: string): string => {
      if (v.includes('"') || v.includes(';') || v.includes('\n') || v.includes('\r')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };

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
          return formatCustomFieldValue(val, fieldDef?.field_name || key, fieldDef?.field_type);
        }),
      ].map((v) => escapeCsvField(typeof v === "string" ? v : String(v)));
    });

    const csv = [
      headers.map(escapeCsvField).join(";"),
      ...rows.map((row) => row.join(";")),
    ].join("\n");

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
          if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(val)) {
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
      case "phone": {
        const phoneValue = deal.contact?.phone || "";
        if (!phoneValue) {
          return <span className="text-sm text-muted-foreground">-</span>;
        }
        const formatted = formatForDisplay(phoneValue);
        const display = formatted || phoneValue;
        return (
          <p
            className="text-sm text-muted-foreground flex items-center gap-1 font-mono tabular-nums whitespace-nowrap"
            title={display}
          >
            <Phone className="h-3 w-3 shrink-0" />
            <span className="whitespace-nowrap">{display}</span>
          </p>
        );
      }
      case "stage":
        return (
          <Select
            value={deal.stage_id}
            onValueChange={(newStageId) => {
              if (newStageId === deal.stage_id) return;
              requestStageChange(deal, newStageId);
            }}
          >
            <SelectTrigger className="h-7 w-auto min-w-[120px] border-none bg-transparent p-1 focus:ring-0">
              <Badge
                variant="secondary"
                style={{ backgroundColor: `${deal.stageColor}20`, color: deal.stageColor }}
              >
                {deal.stageName}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {funnel.stages?.filter(s => !s.is_final).map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.name}
                  </div>
                </SelectItem>
              ))}
              {funnel.stages?.some(s => s.is_final) && (
                <>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-1">
                    Fechar como
                  </div>
                  {funnel.stages?.filter(s => s.is_final).map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
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
          // Respect declared field_type; also use name heuristic to catch text fields named like dates
          const isDateField =
            (fieldDef && (fieldDef.field_type === 'date' || fieldDef.field_type === 'datetime')) ||
            isDateLikeFieldName(String(fieldKey)) ||
            (fieldDef?.field_name ? isDateLikeFieldName(String(fieldDef.field_name)) : false);
          if (isDateField) {
            const formatted = formatCustomFieldDate(val);
            if (formatted) return formatted;
          }
          // Fallback: format ISO-like date strings (YYYY-MM-DD) as DD/MM/YYYY even for text fields
          if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}(T|$)/.test(val)) {
            const formatted = formatCustomFieldDate(val);
            if (formatted) return formatted;
          }
          // Fallback: Excel serial date numbers (e.g. 46119) stored as number or numeric string
          const num = typeof val === 'number' ? val : (typeof val === 'string' && /^\d{4,6}(\.\d+)?$/.test(val.trim()) ? parseFloat(val) : NaN);
          if (!isNaN(num) && num > 25000 && num < 100000) {
            const formatted = formatCustomFieldDate(num);
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

    const filterVal = columnFilters[columnId];
    const filterIsActive = Array.isArray(filterVal)
      ? filterVal.length > 0
      : !!(filterVal && filterVal !== "all");
    const hasFilter = filterIsActive ||
      columnFilters[`${columnId}_from`] || columnFilters[`${columnId}_to`];

    const isSorted = sortConfig?.columnId === columnId;
    const sortDir = isSorted ? sortConfig!.direction : null;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 font-medium hover:bg-transparent flex items-center gap-1"
          >
            {col.label}
            {sortDir === 'asc' && <ArrowUp className="h-3 w-3 text-primary" />}
            {sortDir === 'desc' && <ArrowDown className="h-3 w-3 text-primary" />}
            {!sortDir && (hasFilter ? (
              <Filter className="h-3 w-3 text-primary" />
            ) : (
              <ChevronDown className="h-3 w-3 opacity-50" />
            ))}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ordenar</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={sortDir === 'asc' ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSort(columnId, 'asc')}
                >
                  <ArrowUp className="h-3 w-3 mr-1" />
                  A → Z
                </Button>
                <Button
                  variant={sortDir === 'desc' ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSort(columnId, 'desc')}
                >
                  <ArrowDown className="h-3 w-3 mr-1" />
                  Z → A
                </Button>
              </div>
              {isSorted && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => setSort(columnId, null)}
                >
                  <ArrowUpDown className="h-3 w-3 mr-1" />
                  Remover ordenação
                </Button>
              )}
            </div>
            <div className="border-t pt-3 space-y-2">
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
            value={getFilterStr("contact")}
            onChange={(e) => setColumnFilter("contact", e.target.value)}
          />
        );
      case "phone":
        return (
          <Input
            placeholder="Buscar telefone..."
            value={getFilterStr("phone")}
            onChange={(e) => setColumnFilter("phone", e.target.value)}
          />
        );
      case "stage": {
        const selected = Array.isArray(columnFilters.stage) ? columnFilters.stage : [];
        return (
          <MultiSelect
            options={(funnel.stages || []).map((s) => ({ value: s.id, label: s.name }))}
            value={selected}
            onChange={(vals) => setColumnFilter("stage", vals)}
            placeholder="Todas etapas"
          />
        );
      }
      case "value":
        return (
          <Select
            value={getFilterStr("value") || "all"}
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
            value={getFilterStr("time_in_stage") || "all"}
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
        // Custom fields - render input based on declared field_type
        if (columnId.startsWith("custom_")) {
          const fieldKey = columnId.replace("custom_", "");
          const fieldDef = fieldDefinitions?.find(f => f.field_key === fieldKey);

          // Respect declared field_type. Also fall back to name heuristic (key OR label)
          // so legacy/text-typed fields named "Data da Entrada" still get the date range filter.
          const fieldType = fieldDef?.field_type;
          const isDateField =
            fieldType === 'date' ||
            fieldType === 'datetime' ||
            isDateLikeFieldName(String(fieldKey)) ||
            (fieldDef?.field_name ? isDateLikeFieldName(String(fieldDef.field_name)) : false);

          if (isDateField) {
            return (
              <div className="space-y-2">
                <Input
                  type="date"
                  value={columnFilters[`${columnId}_from`] || ""}
                  onChange={(e) => setColumnFilter(`${columnId}_from`, e.target.value)}
                  placeholder="De"
                />
                <Input
                  type="date"
                  value={columnFilters[`${columnId}_to`] || ""}
                  onChange={(e) => setColumnFilter(`${columnId}_to`, e.target.value)}
                  placeholder="Até"
                />
                <p className="text-xs text-muted-foreground">
                  {columnFilters[`${columnId}_from`] || columnFilters[`${columnId}_to`]
                    ? `Filtrando: ${columnFilters[`${columnId}_from`] || '...'} → ${columnFilters[`${columnId}_to`] || '...'}`
                    : "Selecione um intervalo de datas"
                  }
                </p>
              </div>
            );
          }

          if (fieldType === 'number') {
            return (
              <Input
                type="number"
                placeholder={`Filtrar ${col.label}...`}
                value={getFilterStr(columnId)}
                onChange={(e) => setColumnFilter(columnId, e.target.value)}
              />
            );
          }

          if ((fieldType === 'select' || fieldType === 'multi_select') && fieldDef?.options?.length) {
            return (
              <Select
                value={getFilterStr(columnId) || "all"}
                onValueChange={(val) => setColumnFilter(columnId, val === "all" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Filtrar ${col.label}...`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {fieldDef.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }

          if (fieldType === 'boolean' || fieldType === 'switch') {
            return (
              <Select
                value={getFilterStr(columnId) || "all"}
                onValueChange={(val) => setColumnFilter(columnId, val === "all" ? "" : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Filtrar ${col.label}...`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Não</SelectItem>
                </SelectContent>
              </Select>
            );
          }
        }
        return (
          <Input
            placeholder={`Filtrar ${col.label}...`}
            value={getFilterStr(columnId)}
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
      // Handle standard deal updates
      const hasStandardUpdates = updates.value !== undefined || updates.stage_id || 
        updates.responsible_id !== undefined || updates.expected_close_date !== undefined || 
        updates.custom_field;
      
      if (hasStandardUpdates) {
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
      }

      // Handle tag assignment
      if (updates.tag_ids && updates.tag_ids.length > 0) {
        // Get contact_ids from selected deals
        const selectedDeals = allDeals.filter(d => selectedIds.includes(d.id));
        const contactIds = [...new Set(selectedDeals.map(d => d.contact_id).filter(Boolean))];
        
        if (contactIds.length > 0) {
          const inserts = contactIds.flatMap(contactId =>
            updates.tag_ids!.map(tagId => ({ contact_id: contactId, tag_id: tagId }))
          );
          
          await supabase
            .from("contact_tags")
            .upsert(inserts, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
        }
      }

      // Handle funnel assignment (move deals to another funnel + stage)
      if (updates.funnel_assignment) {
        const { funnel_id: targetFunnelId, stage_id: targetStageId } = updates.funnel_assignment;
        const BATCH_SIZE = 50;
        for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
          const batch = selectedIds.slice(i, i + BATCH_SIZE);
          // Insert history entries for each deal
          const historyEntries = batch.map(dealId => ({
            deal_id: dealId,
            from_stage_id: null as string | null,
            to_stage_id: targetStageId,
          }));
          // Fetch current stage_ids for history
          const { data: currentDeals } = await supabase
            .from('funnel_deals')
            .select('id, stage_id')
            .in('id', batch);
          if (currentDeals) {
            const histInserts = currentDeals
              .filter(d => d.stage_id !== targetStageId)
              .map(d => ({
                deal_id: d.id,
                from_stage_id: d.stage_id,
                to_stage_id: targetStageId,
              }));
            if (histInserts.length > 0) {
              await supabase.from('funnel_deal_history').insert(histInserts);
            }
          }
          await supabase
            .from('funnel_deals')
            .update({
              funnel_id: targetFunnelId,
              stage_id: targetStageId,
              entered_stage_at: new Date().toISOString(),
            })
            .in('id', batch);
        }
        queryClient.invalidateQueries({ queryKey: ['funnels'] });
        queryClient.invalidateQueries({ queryKey: ['stage-deal-counts'] });
        const toast = (await import("sonner")).toast;
        toast.success(`${selectedIds.length} lead(s) movido(s) para outro funil`);
      }

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
    const cleanVisible = sanitizeColumnArray(newVisible);
    const cleanOrder = sanitizeColumnArray(newOrder);
    setVisibleColumns(cleanVisible);
    setColumnOrder(cleanOrder);
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
            visible_columns: cleanVisible,
            column_order: cleanOrder,
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
  }, [funnel.id, queryClient, sanitizeColumnArray]);

  // Persist only the column order (used by drag-and-drop reordering)
  const persistColumnOrder = useCallback(async (newOrder: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('funnel_column_configs')
        .upsert({
          user_id: user.id,
          funnel_id: funnel.id,
          visible_columns: visibleColumns,
          column_order: newOrder,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,funnel_id' });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['funnel-column-config', funnel.id] });
    } catch (error) {
      console.error("Error persisting column order:", error);
      toast.error("Erro ao salvar ordem das colunas");
    }
  }, [funnel.id, visibleColumns, queryClient]);

  // Drag-and-drop handlers for column reordering
  const handleColumnDragStart = (e: React.DragEvent<HTMLTableCellElement>, columnId: string) => {
    setDraggedColumnId(columnId);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', columnId); } catch {}
  };

  const handleColumnDragOver = (e: React.DragEvent<HTMLTableCellElement>, columnId: string) => {
    if (!draggedColumnId || draggedColumnId === columnId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnId !== columnId) setDragOverColumnId(columnId);
  };

  const handleColumnDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleColumnDrop = (e: React.DragEvent<HTMLTableCellElement>, targetColumnId: string) => {
    e.preventDefault();
    const sourceId = draggedColumnId;
    setDraggedColumnId(null);
    setDragOverColumnId(null);
    if (!sourceId || sourceId === targetColumnId) return;

    const currentOrder = orderedVisibleColumns.slice();
    const fromIdx = currentOrder.indexOf(sourceId);
    const toIdx = currentOrder.indexOf(targetColumnId);
    if (fromIdx === -1 || toIdx === -1) return;

    currentOrder.splice(fromIdx, 1);
    const insertAt = currentOrder.indexOf(targetColumnId);
    // Insert before target if dragging from right; after target if from left
    const newIndex = fromIdx < toIdx ? insertAt + 1 : insertAt;
    currentOrder.splice(newIndex, 0, sourceId);

    // Merge with hidden columns to keep their positions appended at the end (or where they were)
    const hidden = columnOrder.filter((id) => !orderedVisibleColumns.includes(id));
    const mergedOrder = sanitizeColumnArray([...currentOrder, ...hidden]);
    setColumnOrder(mergedOrder);
    persistColumnOrder(mergedOrder);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumnId(null);
    setDragOverColumnId(null);
  };

  // Get ordered visible columns (sanitized + filter only visible + only known columns)
  const orderedVisibleColumns = useMemo(() => {
    const knownIds = new Set(allColumns.map((c) => c.id));
    const visibleSet = new Set(visibleColumns);
    return sanitizeColumnArray(columnOrder).filter(
      (id) => visibleSet.has(id) && knownIds.has(id)
    );
  }, [columnOrder, visibleColumns, allColumns, sanitizeColumnArray]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setColumnsDialogOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Colunas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFieldsManagerInitialId(null);
              setFieldsManagerOpen(true);
            }}
          >
            <Edit className="h-4 w-4 mr-2" />
            Gerenciar Campos
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
                variant="outline"
                size="sm"
                onClick={() => setShowBroadcast(true)}
              >
                <Send className="h-4 w-4 mr-2" />
                Disparar ({selectedIds.length})
              </Button>
              {selectedIds.length >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMergeDialogOpen(true)}
                >
                  <Merge className="h-4 w-4 mr-2" />
                  Unir Leads
                </Button>
              )}
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
              {orderedVisibleColumns.map((colId) => {
                const widthClass =
                  colId === "phone"
                    ? "min-w-[180px]"
                    : colId === "contact"
                      ? "min-w-[220px]"
                      : "";
                const isDragging = draggedColumnId === colId;
                const isDragOver = dragOverColumnId === colId && draggedColumnId && draggedColumnId !== colId;
                const fromIdx = draggedColumnId ? orderedVisibleColumns.indexOf(draggedColumnId) : -1;
                const toIdx = orderedVisibleColumns.indexOf(colId);
                const insertSide = isDragOver ? (fromIdx < toIdx ? 'right' : 'left') : null;
                return (
                  <TableHead
                    key={colId}
                    draggable
                    onDragStart={(e) => handleColumnDragStart(e, colId)}
                    onDragOver={(e) => handleColumnDragOver(e, colId)}
                    onDragLeave={handleColumnDragLeave}
                    onDrop={(e) => handleColumnDrop(e, colId)}
                    onDragEnd={handleColumnDragEnd}
                    className={`whitespace-nowrap cursor-grab active:cursor-grabbing select-none ${widthClass} ${isDragging ? 'opacity-50' : ''} ${insertSide === 'left' ? 'border-l-2 border-primary' : ''} ${insertSide === 'right' ? 'border-r-2 border-primary' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">{renderColumnHeader(colId)}</div>
                    </div>
                  </TableHead>
                );
              })}
              <TableHead className="w-[50px] sticky right-0 bg-card z-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDeals.length === 0 ? (
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
              sortedDeals.map((deal) => (
                <TableRow key={deal.id} className="cursor-pointer hover:bg-muted/50" onClick={(e) => {
                  // Don't open if clicking on checkbox, dropdown, or button
                  const target = e.target as HTMLElement;
                  if (target.closest('button, [role="checkbox"], [data-radix-collection-item]')) return;
                  setEditingDeal(deal);
                }}>
                  <TableCell className="sticky left-0 bg-card z-10">
                    <Checkbox
                      checked={selectedIds.includes(deal.id)}
                      onCheckedChange={(checked) => handleSelectOne(deal.id, !!checked)}
                      aria-label={`Selecionar ${deal.title || deal.contact?.name}`}
                    />
                  </TableCell>
                  {orderedVisibleColumns.map((colId) => {
                    const widthClass =
                      colId === "phone"
                        ? "min-w-[180px]"
                        : colId === "contact"
                          ? "min-w-[220px]"
                          : "";
                    return (
                      <TableCell key={colId} className={`whitespace-nowrap ${widthClass}`}>
                        {renderCellContent(deal, colId)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="sticky right-0 bg-card z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => {
                            if (deal.conversation_id) {
                              navigate(`/inbox?conversationId=${deal.conversation_id}`);
                            } else if (deal.contact_id) {
                              navigate(`/inbox?contactId=${deal.contact_id}`);
                            }
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Abrir Conversa
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
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
                                  requestStageChange(deal, stage.id);
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

      {/* Counts bar + pagination controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{totalDealsCount.toLocaleString('pt-BR')}</strong> leads no funil
          </span>
          {hasActiveFilters && (
            <span className="text-muted-foreground">
              · <strong className="text-foreground">{filteredDeals.length.toLocaleString('pt-BR')}</strong> filtrados
            </span>
          )}
          {selectedIds.length > 0 && (
            <span className="text-primary font-medium">
              · {selectedIds.length.toLocaleString('pt-BR')} selecionado(s)
            </span>
          )}
          {hasMoreDeals && (
            <span className="text-muted-foreground">
              · {loadedDealsCount.toLocaleString('pt-BR')} carregados
            </span>
          )}
        </div>

        {hasMoreDeals && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Carregar:</span>
            <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLoadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>Carregar +{pageSize}</>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadAll}
              disabled={loadingMore}
            >
              Carregar todos ({(totalDealsCount - loadedDealsCount).toLocaleString('pt-BR')})
            </Button>
          </div>
        )}
      </div>

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
        onEditCustomField={(id) => {
          setFieldsManagerInitialId(id);
          setFieldsManagerOpen(true);
        }}
        onDeleteCustomField={async (id) => {
          await deleteField.mutateAsync(id);
        }}
      />

      <CustomFieldsManager
        open={fieldsManagerOpen}
        onOpenChange={(o) => {
          setFieldsManagerOpen(o);
          if (!o) setFieldsManagerInitialId(null);
        }}
        initialEditFieldId={fieldsManagerInitialId}
      />

      <BulkEditDialog
        open={bulkEditDialogOpen}
        onOpenChange={setBulkEditDialogOpen}
        mode="deals"
        selectedCount={selectedIds.length}
        fieldDefinitions={fieldDefinitions || []}
        stages={funnel.stages || []}
        funnels={(allFunnels || []).filter(f => f.id !== funnel.id)}
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

      <OpportunityBroadcastDialog
        open={showBroadcast}
        onOpenChange={setShowBroadcast}
        selectedContacts={selectedIds.map(id => {
          const deal = filteredDeals.find(d => d.id === id);
          return {
            contactId: deal?.contact_id || '',
            contactName: deal?.contact?.name || deal?.title || 'Sem nome',
          };
        }).filter(c => c.contactId)}
        selectedDealIds={selectedIds}
        funnelId={funnel.id}
        funnelName={funnel.name}
      />

      <MergeDealsDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        deals={sortedDeals.filter((d) => selectedIds.includes(d.id))}
        funnel={funnel}
        onMerged={() => setSelectedIds([])}
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

      {pendingMove && (
        <RequiredFieldsCheckDialog
          open={!!pendingMove}
          onOpenChange={(o) => { if (!o) setPendingMove(null); }}
          stageName={pendingMove.targetStageName}
          missingFields={pendingMove.missing}
          initialValues={(pendingMove.deal.custom_fields as Record<string, unknown>) || {}}
          isSubmitting={updateDeal.isPending}
          onConfirm={async (values) => {
            const merged = { ...((pendingMove.deal.custom_fields as Record<string, unknown>) || {}) };
            for (const f of pendingMove.missing) merged[f.field_key] = values[f.field_key];
            await updateDeal.mutateAsync({
              id: pendingMove.deal.id,
              stage_id: pendingMove.targetStageId,
              custom_fields: merged,
              ...(pendingMove.isFinal ? { closed_at: new Date().toISOString() } : { closed_at: null }),
            });
            setPendingMove(null);
          }}
        />
      )}
    </div>
  );
};
