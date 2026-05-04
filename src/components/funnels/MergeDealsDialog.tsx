import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Merge, Loader2 } from "lucide-react";
import { Funnel, FunnelDeal } from "@/hooks/useFunnels";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useMergeDeals } from "@/hooks/useMergeDeals";

interface MergeDealsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: FunnelDeal[];
  funnel: Funnel;
  onMerged?: () => void;
}

// Per-field source picker: which selected deal provides the final value for a given field
type FieldSourceMap = Record<string, string>; // fieldKey -> dealId

const FIELD_KEYS = {
  title: 'title',
  value: 'value',
  responsible_id: 'responsible_id',
} as const;

export const MergeDealsDialog = ({ open, onOpenChange, deals, funnel, onMerged }: MergeDealsDialogProps) => {
  const { fieldDefinitions } = useCustomFields();
  const { members } = useTeamMembers();
  const mergeDeals = useMergeDeals();

  const [masterId, setMasterId] = useState<string>('');
  const [stageId, setStageId] = useState<string>('');
  const [fieldSources, setFieldSources] = useState<FieldSourceMap>({});
  const [mergeTags, setMergeTags] = useState(true);
  const [mergeNotes, setMergeNotes] = useState(true);
  const [mergeConversations, setMergeConversations] = useState(true);

  // When dialog opens, default master = first deal, stage = master's stage, fields default to master values
  useEffect(() => {
    if (!open || deals.length === 0) return;
    const defaultMaster = deals[0];
    setMasterId(defaultMaster.id);
    setStageId(defaultMaster.stage_id);

    const defaults: FieldSourceMap = {};
    defaults[FIELD_KEYS.title] = defaultMaster.id;
    defaults[FIELD_KEYS.value] = defaultMaster.id;
    defaults[FIELD_KEYS.responsible_id] = defaultMaster.id;

    // Custom field defaults: prefer the first deal that has a non-empty value
    const leadFields = fieldDefinitions?.filter(f => f.entity_type === 'lead') || [];
    const contactFields = fieldDefinitions?.filter(f => f.entity_type === 'contact') || [];

    leadFields.forEach((f) => {
      const dealWithValue = deals.find(d => {
        const cf = (d.custom_fields || {}) as Record<string, unknown>;
        return cf[f.field_key] !== undefined && cf[f.field_key] !== null && cf[f.field_key] !== '';
      });
      defaults[`custom:${f.field_key}`] = (dealWithValue || defaultMaster).id;
    });

    contactFields.forEach((f) => {
      const dealWithValue = deals.find(d => {
        const cf = ((d as unknown as { contact?: { custom_fields?: Record<string, unknown> } }).contact?.custom_fields || {}) as Record<string, unknown>;
        return cf[f.field_key] !== undefined && cf[f.field_key] !== null && cf[f.field_key] !== '';
      });
      defaults[`contact_custom:${f.field_key}`] = (dealWithValue || defaultMaster).id;
    });

    setFieldSources(defaults);
  }, [open, deals, fieldDefinitions]);

  // When master changes, also default stage to master stage
  useEffect(() => {
    if (!masterId) return;
    const master = deals.find(d => d.id === masterId);
    if (master) setStageId(master.stage_id);
  }, [masterId, deals]);

  const masterDeal = useMemo(() => deals.find(d => d.id === masterId), [deals, masterId]);
  const secondaryDeals = useMemo(() => deals.filter(d => d.id !== masterId), [deals, masterId]);

  const leadFieldDefs = fieldDefinitions?.filter(f => f.entity_type === 'lead') || [];
  const contactFieldDefs = fieldDefinitions?.filter(f => f.entity_type === 'contact') || [];

  // Helper: get value from a deal for a given field key
  const getValueFor = (deal: FunnelDeal | undefined, fieldKey: string): string => {
    if (!deal) return '';
    if (fieldKey === FIELD_KEYS.title) return deal.title || '—';
    if (fieldKey === FIELD_KEYS.value) {
      return deal.value != null ? `R$ ${deal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';
    }
    if (fieldKey === FIELD_KEYS.responsible_id) {
      const mem = members?.find(m => m.user_id === deal.responsible_id);
      return mem?.profile?.full_name || (deal.responsible_id ? 'Atribuído' : 'Sem responsável');
    }
    if (fieldKey.startsWith('custom:')) {
      const k = fieldKey.replace('custom:', '');
      const cf = (deal.custom_fields || {}) as Record<string, unknown>;
      const v = cf[k];
      return v == null || v === '' ? '—' : String(v);
    }
    if (fieldKey.startsWith('contact_custom:')) {
      const k = fieldKey.replace('contact_custom:', '');
      const cf = ((deal as unknown as { contact?: { custom_fields?: Record<string, unknown> } }).contact?.custom_fields || {}) as Record<string, unknown>;
      const v = cf[k];
      return v == null || v === '' ? '—' : String(v);
    }
    return '';
  };

  const hasClosedSecondary = secondaryDeals.some(d => d.closed_at);

  const handleConfirm = async () => {
    if (!masterDeal || !stageId) return;

    // Resolve final values from field sources
    const titleSourceDeal = deals.find(d => d.id === fieldSources[FIELD_KEYS.title]);
    const valueSourceDeal = deals.find(d => d.id === fieldSources[FIELD_KEYS.value]);
    const responsibleSourceDeal = deals.find(d => d.id === fieldSources[FIELD_KEYS.responsible_id]);

    const customFields: Record<string, unknown> = { ...(masterDeal.custom_fields as Record<string, unknown> || {}) };
    leadFieldDefs.forEach((f) => {
      const sourceDeal = deals.find(d => d.id === fieldSources[`custom:${f.field_key}`]);
      const cf = (sourceDeal?.custom_fields || {}) as Record<string, unknown>;
      if (cf[f.field_key] !== undefined) customFields[f.field_key] = cf[f.field_key];
    });

    const contactCustomFields: Record<string, unknown> = {};
    contactFieldDefs.forEach((f) => {
      const sourceDeal = deals.find(d => d.id === fieldSources[`contact_custom:${f.field_key}`]);
      const cf = ((sourceDeal as unknown as { contact?: { custom_fields?: Record<string, unknown> } })?.contact?.custom_fields || {}) as Record<string, unknown>;
      if (cf[f.field_key] !== undefined) contactCustomFields[f.field_key] = cf[f.field_key];
    });

    await mergeDeals.mutateAsync({
      masterId: masterDeal.id,
      secondaryIds: secondaryDeals.map(d => d.id),
      fields: {
        title: titleSourceDeal?.title ?? null,
        value: valueSourceDeal?.value ?? null,
        responsible_id: responsibleSourceDeal?.responsible_id ?? null,
        stage_id: stageId,
        custom_fields: customFields,
        contact_custom_fields: contactCustomFields,
      },
      mergeTags,
      mergeNotes,
      mergeConversations,
      masterContactId: masterDeal.contact_id || null,
      secondaryContactIds: secondaryDeals.map(d => d.contact_id).filter(Boolean) as string[],
      masterConversationId: masterDeal.conversation_id || null,
      secondaryConversationIds: secondaryDeals.map(d => d.conversation_id).filter(Boolean) as string[],
    });

    onOpenChange(false);
    onMerged?.();
  };

  const renderFieldRow = (label: string, fieldKey: string) => (
    <div key={fieldKey} className="grid grid-cols-[1fr_2fr] gap-3 items-center py-2 border-b last:border-0">
      <Label className="text-sm">{label}</Label>
      <Select
        value={fieldSources[fieldKey] || ''}
        onValueChange={(v) => setFieldSources(prev => ({ ...prev, [fieldKey]: v }))}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Escolher origem" />
        </SelectTrigger>
        <SelectContent>
          {deals.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              <span className="text-xs text-muted-foreground mr-2">
                {d.id === masterId ? '⭐ Principal' : 'Secundário'}:
              </span>
              {getValueFor(d, fieldKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Unir Leads
          </DialogTitle>
          <DialogDescription>
            Una {deals.length} leads em um só, escolhendo de qual lead vem cada campo e a etapa final.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-4 -mr-4">
          <div className="space-y-6">
            {/* 1. Master selection */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">1. Lead principal (manterá o histórico)</h3>
              <p className="text-xs text-muted-foreground">
                O lead principal mantém o ID, o histórico e os vínculos. Os outros serão excluídos após a união.
              </p>
              <RadioGroup value={masterId} onValueChange={setMasterId} className="space-y-2 mt-2">
                {deals.map((d) => (
                  <label
                    key={d.id}
                    htmlFor={`master-${d.id}`}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      masterId === d.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={d.id} id={`master-${d.id}`} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{d.title || 'Sem título'}</span>
                        {d.closed_at && <Badge variant="secondary" className="text-xs">Fechado</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-x-3">
                        <span>Valor: {d.value != null ? `R$ ${d.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</span>
                        <span>· Contato: {(d as unknown as { contact?: { name?: string } }).contact?.name || '—'}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </section>

            {/* 2. Field sources */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">2. De qual lead vem cada campo?</h3>
              <div className="rounded-lg border px-3">
                {renderFieldRow('Título do deal', FIELD_KEYS.title)}
                {renderFieldRow('Valor', FIELD_KEYS.value)}
                {renderFieldRow('Responsável', FIELD_KEYS.responsible_id)}
                {leadFieldDefs.map(f => renderFieldRow(f.field_name, `custom:${f.field_key}`))}
                {contactFieldDefs.map(f => renderFieldRow(`📇 ${f.field_name}`, `contact_custom:${f.field_key}`))}
              </div>
            </section>

            {/* 3. Final stage */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">3. Etapa final do lead unido</h3>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar etapa" />
                </SelectTrigger>
                <SelectContent>
                  {funnel.stages?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.is_final && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({s.final_type === 'won' ? 'Ganho' : 'Perdido'})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            {/* 4. Extras */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">4. Opções adicionais</h3>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={mergeTags} onCheckedChange={(c) => setMergeTags(c === true)} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Mesclar tags dos contatos</div>
                  <p className="text-xs text-muted-foreground">
                    Copia as tags dos contatos secundários para o contato do lead principal.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={mergeNotes} onCheckedChange={(c) => setMergeNotes(c === true)} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Mesclar notas</div>
                  <p className="text-xs text-muted-foreground">
                    Move as notas dos contatos secundários para o contato principal.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={mergeConversations} onCheckedChange={(c) => setMergeConversations(c === true)} className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">
                    Unificar conversas
                    {(() => {
                      const ids = Array.from(new Set(
                        secondaryDeals.map(d => d.conversation_id).filter(Boolean) as string[]
                      )).filter(id => id !== masterDeal?.conversation_id);
                      return ids.length > 0 ? (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          {ids.length} conversa{ids.length > 1 ? 's' : ''}
                        </Badge>
                      ) : null;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Move todas as mensagens, notas, tarefas e chamadas dos leads secundários para a conversa do lead principal. As conversas secundárias serão arquivadas.
                  </p>
                </div>
              </label>
            </section>

            {/* Warnings */}
            {hasClosedSecondary && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-xs">
                  Um ou mais leads secundários já estão fechados (ganho/perdido). Eles serão excluídos mesmo assim.
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs">
                <strong>Operação irreversível.</strong> Os {secondaryDeals.length} leads secundários serão excluídos
                permanentemente. O histórico, automações e mensagens vão para o lead principal.
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mergeDeals.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!masterId || !stageId || mergeDeals.isPending}
          >
            {mergeDeals.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Merge className="h-4 w-4 mr-2" />
            Unir e excluir secundários
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
