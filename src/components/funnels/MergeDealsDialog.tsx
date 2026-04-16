import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFunnels, FunnelDeal } from "@/hooks/useFunnels";
import { useCustomFields } from "@/hooks/useCustomFields";
import { toast } from "sonner";
import { Search, Merge, Loader2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatForDisplay } from "@/lib/phone-utils";

interface DealSearchResult {
  id: string;
  title: string | null;
  value: number;
  notes: string | null;
  source: string | null;
  responsible_id: string | null;
  custom_fields: Record<string, any> | null;
  contact_id: string;
  funnel_name: string;
  stage_name: string;
  stage_color: string;
  contact_name: string | null;
  contact_phone: string;
  contact_email: string | null;
  contact_notes: string | null;
  contact_custom_fields: Record<string, any> | null;
}

interface FieldRow {
  key: string;
  label: string;
  valueA: string;
  valueB: string;
}

interface MergeDealsDialogProps {
  dealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged?: () => void;
}

const displayValue = (val: any): string => {
  if (val === null || val === undefined || val === '') return '—';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
};

const buildDealFieldRows = (
  dealA: DealSearchResult,
  dealB: DealSearchResult,
  leadFieldDefs: { field_key: string; field_name: string }[],
  contactFieldDefs: { field_key: string; field_name: string }[]
): FieldRow[] => {
  const rows: FieldRow[] = [
    { key: 'd_title', label: 'Título', valueA: displayValue(dealA.title), valueB: displayValue(dealB.title) },
    { key: 'd_value', label: 'Valor', valueA: displayValue(dealA.value || null), valueB: displayValue(dealB.value || null) },
    { key: 'd_source', label: 'Fonte', valueA: displayValue(dealA.source), valueB: displayValue(dealB.source) },
    { key: 'd_notes', label: 'Notas do Lead', valueA: displayValue(dealA.notes), valueB: displayValue(dealB.notes) },
    { key: 'd_responsible', label: 'Responsável', valueA: displayValue(dealA.responsible_id), valueB: displayValue(dealB.responsible_id) },
  ];

  // Deal custom fields
  const allDealKeys = new Set<string>();
  if (dealA.custom_fields) Object.keys(dealA.custom_fields).forEach(k => allDealKeys.add(k));
  if (dealB.custom_fields) Object.keys(dealB.custom_fields).forEach(k => allDealKeys.add(k));
  allDealKeys.forEach(key => {
    const def = leadFieldDefs.find(f => f.field_key === key);
    const label = def?.field_name || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    rows.push({
      key: `dcf_${key}`,
      label,
      valueA: displayValue(dealA.custom_fields?.[key]),
      valueB: displayValue(dealB.custom_fields?.[key]),
    });
  });

  // Contact fields (only if different contacts)
  if (dealA.contact_id !== dealB.contact_id) {
    rows.push(
      { key: 'c_name', label: 'Nome do Contato', valueA: displayValue(dealA.contact_name), valueB: displayValue(dealB.contact_name) },
      { key: 'c_email', label: 'Email', valueA: displayValue(dealA.contact_email), valueB: displayValue(dealB.contact_email) },
      { key: 'c_notes', label: 'Notas do Contato', valueA: displayValue(dealA.contact_notes), valueB: displayValue(dealB.contact_notes) },
    );

    const allContactKeys = new Set<string>();
    if (dealA.contact_custom_fields) Object.keys(dealA.contact_custom_fields).forEach(k => allContactKeys.add(k));
    if (dealB.contact_custom_fields) Object.keys(dealB.contact_custom_fields).forEach(k => allContactKeys.add(k));
    allContactKeys.forEach(key => {
      const def = contactFieldDefs.find(f => f.field_key === key);
      const label = def?.field_name || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      rows.push({
        key: `ccf_${key}`,
        label,
        valueA: displayValue(dealA.contact_custom_fields?.[key]),
        valueB: displayValue(dealB.contact_custom_fields?.[key]),
      });
    });
  }

  return rows;
};

const getAutoSelections = (rows: FieldRow[]): Record<string, 'a' | 'b'> => {
  const selections: Record<string, 'a' | 'b'> = {};
  rows.forEach(row => {
    const hasA = row.valueA !== '—';
    const hasB = row.valueB !== '—';
    if (hasA && !hasB) selections[row.key] = 'a';
    else if (!hasA && hasB) selections[row.key] = 'b';
    else if (row.valueA === row.valueB) selections[row.key] = 'a';
    else if (hasA) selections[row.key] = 'a';
  });
  return selections;
};

export const MergeDealsDialog = ({ dealId, open, onOpenChange, onMerged }: MergeDealsDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { funnels } = useFunnels();
  const { leadFieldDefinitions, contactFieldDefinitions } = useCustomFields();

  const [step, setStep] = useState<'select' | 'compare'>('select');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<DealSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [primaryDeal, setPrimaryDeal] = useState<DealSearchResult | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealSearchResult | null>(null);
  const [selections, setSelections] = useState<Record<string, 'a' | 'b'>>({});
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [merging, setMerging] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep('select');
      setSearchTerm('');
      setSearchResults([]);
      setPrimaryDeal(null);
      setSelectedDeal(null);
      setSelections({});
      setRows([]);
    }
  }, [open]);

  // Load primary deal info on open
  useEffect(() => {
    if (!open || !dealId) return;
    loadDealInfo(dealId).then(d => d && setPrimaryDeal(d));
  }, [open, dealId]);

  const loadDealInfo = async (id: string): Promise<DealSearchResult | null> => {
    const { data } = await supabase
      .from('funnel_deals')
      .select('id, title, value, notes, source, responsible_id, custom_fields, contact_id, stage_id, funnel_id, contacts(id, name, phone, email, notes, custom_fields)')
      .eq('id', id)
      .single();
    if (!data) return null;

    const funnel = funnels?.find(f => f.id === data.funnel_id);
    const stage = funnel?.stages?.find(s => s.id === data.stage_id);
    const contact = data.contacts as any;

    return {
      id: data.id,
      title: data.title,
      value: Number(data.value) || 0,
      notes: data.notes,
      source: data.source,
      responsible_id: data.responsible_id,
      custom_fields: data.custom_fields as Record<string, any> | null,
      contact_id: contact?.id || data.contact_id,
      funnel_name: funnel?.name || 'Funil',
      stage_name: stage?.name || 'Etapa',
      stage_color: stage?.color || '#888',
      contact_name: contact?.name || null,
      contact_phone: contact?.phone || '',
      contact_email: contact?.email || null,
      contact_notes: contact?.notes || null,
      contact_custom_fields: contact?.custom_fields as Record<string, any> | null,
    };
  };

  const handleSearch = async () => {
    if (!searchTerm.trim() || !user) return;
    setSearching(true);
    try {
      const term = `%${searchTerm.trim()}%`;
      const { data } = await supabase
        .from('funnel_deals')
        .select('id, title, value, notes, source, responsible_id, custom_fields, contact_id, stage_id, funnel_id, contacts(id, name, phone, email, notes, custom_fields)')
        .neq('id', dealId)
        .or(`title.ilike.${term},contacts.name.ilike.${term},contacts.phone.ilike.${term}`)
        .limit(20);

      if (!data) { setSearchResults([]); return; }

      const results: DealSearchResult[] = data
        .filter(d => {
          const contact = d.contacts as any;
          if (!contact) return false;
          const matchesName = contact.name?.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesPhone = contact.phone?.includes(searchTerm);
          const matchesTitle = d.title?.toLowerCase().includes(searchTerm.toLowerCase());
          return matchesName || matchesPhone || matchesTitle;
        })
        .map(d => {
          const funnel = funnels?.find(f => f.id === d.funnel_id);
          const stage = funnel?.stages?.find(s => s.id === d.stage_id);
          const contact = d.contacts as any;
          return {
            id: d.id,
            title: d.title,
            value: Number(d.value) || 0,
            notes: d.notes,
            source: d.source,
            responsible_id: d.responsible_id,
            custom_fields: d.custom_fields as Record<string, any> | null,
            contact_id: contact?.id || d.contact_id,
            funnel_name: funnel?.name || 'Funil',
            stage_name: stage?.name || 'Etapa',
            stage_color: stage?.color || '#888',
            contact_name: contact?.name || null,
            contact_phone: contact?.phone || '',
            contact_email: contact?.email || null,
            contact_notes: contact?.notes || null,
            contact_custom_fields: contact?.custom_fields as Record<string, any> | null,
          };
        });

      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (searchTerm.length >= 2) {
      const timer = setTimeout(handleSearch, 400);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const handleSelectDuplicate = (deal: DealSearchResult) => {
    setSelectedDeal(deal);
    if (primaryDeal) {
      const fieldRows = buildDealFieldRows(
        primaryDeal, deal,
        leadFieldDefinitions || [],
        contactFieldDefinitions || []
      );
      setRows(fieldRows);
      setSelections(getAutoSelections(fieldRows));
      setStep('compare');
    }
  };

  const handleMerge = async () => {
    if (!primaryDeal || !selectedDeal || !user) return;
    setMerging(true);
    try {
      // Build deal update from selections
      const dealUpdate: Record<string, any> = {};
      const contactUpdate: Record<string, any> = {};
      const dealCfA = { ...(primaryDeal.custom_fields || {}) };
      const dealCfB = { ...(selectedDeal.custom_fields || {}) };
      const contactCfA = { ...(primaryDeal.contact_custom_fields || {}) };
      const contactCfB = { ...(selectedDeal.contact_custom_fields || {}) };
      const mergedDealCf = { ...dealCfA };
      const mergedContactCf = { ...contactCfA };

      for (const row of rows) {
        const src = selections[row.key];
        if (!src) continue;
        const val = src === 'a' ? row.valueA : row.valueB;
        const rawVal = val === '—' ? null : val;

        if (row.key === 'd_title') dealUpdate.title = rawVal;
        else if (row.key === 'd_value') dealUpdate.value = rawVal ? Number(rawVal) : 0;
        else if (row.key === 'd_source') dealUpdate.source = rawVal;
        else if (row.key === 'd_notes') dealUpdate.notes = rawVal;
        else if (row.key === 'd_responsible') dealUpdate.responsible_id = rawVal;
        else if (row.key.startsWith('dcf_')) {
          const cfKey = row.key.replace('dcf_', '');
          mergedDealCf[cfKey] = src === 'a' ? dealCfA[cfKey] : dealCfB[cfKey];
        }
        else if (row.key === 'c_name') contactUpdate.name = rawVal;
        else if (row.key === 'c_email') contactUpdate.email = rawVal;
        else if (row.key === 'c_notes') contactUpdate.notes = rawVal;
        else if (row.key.startsWith('ccf_')) {
          const cfKey = row.key.replace('ccf_', '');
          mergedContactCf[cfKey] = src === 'a' ? contactCfA[cfKey] : contactCfB[cfKey];
        }
      }

      dealUpdate.custom_fields = mergedDealCf;

      // 1. Update primary deal
      await supabase.from('funnel_deals').update(dealUpdate).eq('id', primaryDeal.id);

      // 2. Transfer deal_tasks
      await supabase.from('deal_tasks').update({ deal_id: primaryDeal.id }).eq('deal_id', selectedDeal.id);

      // 3. Transfer deal_stage_history
      await supabase.from('deal_stage_history').update({ deal_id: primaryDeal.id }).eq('deal_id', selectedDeal.id);

      // 4. Update contact if different
      if (primaryDeal.contact_id !== selectedDeal.contact_id && Object.keys(contactUpdate).length > 0) {
        contactUpdate.custom_fields = mergedContactCf;
        await supabase.from('contacts').update(contactUpdate).eq('id', primaryDeal.contact_id);
      }

      // 5. Delete duplicate deal
      await supabase.from('funnel_deals').delete().eq('id', selectedDeal.id);

      // 6. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      queryClient.invalidateQueries({ queryKey: ['funnel-deals'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });

      toast.success("Leads unificados com sucesso!");
      onOpenChange(false);
      onMerged?.();
    } catch (err: any) {
      toast.error("Erro ao unificar leads: " + (err.message || 'Erro desconhecido'));
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Unificar Leads
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Busque e selecione o lead duplicado que deseja unificar com este.'
              : 'Escolha os dados que deseja manter para cada campo.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            {/* Primary deal info */}
            {primaryDeal && (
              <div className="p-3 rounded-lg border bg-primary/5">
                <p className="text-xs text-muted-foreground mb-1">Lead atual</p>
                <p className="font-semibold text-sm">{primaryDeal.title || primaryDeal.contact_name || 'Sem nome'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge style={{ backgroundColor: primaryDeal.stage_color, color: '#fff' }} className="text-[10px]">
                    {primaryDeal.stage_name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{primaryDeal.funnel_name}</span>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou título..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
                autoFocus
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
            </div>

            {/* Results */}
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {searchResults.length === 0 && searchTerm.length >= 2 && !searching && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead encontrado.</p>
                )}
                {searchResults.map(deal => (
                  <button
                    key={deal.id}
                    type="button"
                    onClick={() => handleSelectDuplicate(deal)}
                    className="w-full text-left p-3 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{deal.title || deal.contact_name || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground">{formatForDisplay(deal.contact_phone)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge style={{ backgroundColor: deal.stage_color, color: '#fff' }} className="text-[10px]">
                          {deal.stage_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{deal.funnel_name}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {step === 'compare' && primaryDeal && selectedDeal && (
          <div className="space-y-3">
            {/* Header labels */}
            <div className="grid grid-cols-[140px_1fr_1fr] gap-2 px-2 py-2 text-xs font-semibold text-muted-foreground border-b">
              <span>Campo</span>
              <span>Lead atual</span>
              <span>Lead duplicado</span>
            </div>

            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1">
                {rows.map(row => {
                  const same = row.valueA === row.valueB;
                  const bothEmpty = row.valueA === '—' && row.valueB === '—';
                  if (bothEmpty) return null;

                  return (
                    <div key={row.key} className="grid grid-cols-[140px_1fr_1fr] gap-2 px-2 py-1.5 items-center">
                      <span className="text-xs font-medium text-muted-foreground truncate">{row.label}</span>
                      <button
                        type="button"
                        onClick={() => !same && setSelections(s => ({ ...s, [row.key]: 'a' }))}
                        disabled={same || row.valueA === '—'}
                        className={cn(
                          "text-xs text-left px-2 py-1.5 rounded border transition-all min-h-[32px]",
                          selections[row.key] === 'a'
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                            : "border-border text-muted-foreground hover:border-primary/50",
                          (same || row.valueA === '—') && "cursor-default opacity-70"
                        )}
                      >
                        {row.valueA}
                      </button>
                      <button
                        type="button"
                        onClick={() => !same && setSelections(s => ({ ...s, [row.key]: 'b' }))}
                        disabled={same || row.valueB === '—'}
                        className={cn(
                          "text-xs text-left px-2 py-1.5 rounded border transition-all min-h-[32px]",
                          selections[row.key] === 'b'
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                            : "border-border text-muted-foreground hover:border-primary/50",
                          (same || row.valueB === '—') && "cursor-default opacity-70"
                        )}
                      >
                        {row.valueB}
                      </button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {step === 'compare' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>Voltar</Button>
              <Button onClick={handleMerge} disabled={merging}>
                {merging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Merge className="h-4 w-4 mr-2" />}
                Unificar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
