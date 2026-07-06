import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Play, Save } from "lucide-react";
import { toast } from "sonner";
import {
  useDynamicReports, type DynamicReport, type ReportSource,
  type PeriodConfig, type FilterConfig, type ScheduleConfig,
} from "@/hooks/useDynamicReports";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useForms } from "@/hooks/useForms";
import { useFunnels } from "@/hooks/useFunnels";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useOrganization } from "@/hooks/useOrganization";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  report?: DynamicReport | null;
}

const PERIOD_PRESETS: { value: PeriodConfig["preset"]; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "tomorrow", label: "Amanhã" },
  { value: "last_3d", label: "Últimos 3 dias" },
  { value: "last_7d", label: "Últimos 7 dias" },
  { value: "last_30d", label: "Últimos 30 dias" },
  { value: "next_7d", label: "Próximos 7 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "custom", label: "Intervalo customizado" },
];

const WEEKDAYS = [
  { v: 0, l: "Dom" }, { v: 1, l: "Seg" }, { v: 2, l: "Ter" },
  { v: 3, l: "Qua" }, { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" },
];

export function DynamicReportDialog({ open, onOpenChange, report }: Props) {
  const { saveReport, previewReport, runNow, getReportRecipients } = useDynamicReports();
  const { fieldDefinitions } = useCustomFields();
  const { forms } = useForms();
  const { funnels } = useFunnels();
  const { members } = useTeamMembers();
  const { organization } = useOrganization();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState<ReportSource>("contacts");
  const [filter, setFilter] = useState<FilterConfig>({});
  const [period, setPeriod] = useState<PeriodConfig>({ preset: "last_7d" });
  const [columns, setColumns] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleConfig>({ enabled: false, frequency: "daily", hour: 8, minute: 0, weekdays: [1], monthday: 1 });
  const [recipients, setRecipients] = useState<Record<string, ("bell" | "whatsapp")[]>>({});
  const [previewData, setPreviewData] = useState<{ row_count: number; preview: any[] } | null>(null);

  // Load existing
  useEffect(() => {
    if (!open) return;
    if (report) {
      setName(report.name);
      setDescription(report.description ?? "");
      setSource(report.source);
      setFilter(report.filter_config ?? {});
      setPeriod(report.period_config ?? { preset: "last_7d" });
      setColumns(report.columns ?? []);
      setSchedule({ enabled: false, frequency: "daily", hour: 8, minute: 0, weekdays: [1], monthday: 1, ...(report.schedule_config ?? {}) });
      getReportRecipients(report.id).then((recs) => {
        const map: Record<string, ("bell" | "whatsapp")[]> = {};
        recs.forEach((r) => { map[r.user_id] = r.channels ?? ["bell"]; });
        setRecipients(map);
      });
    } else {
      setName(""); setDescription(""); setSource("contacts");
      setFilter({}); setPeriod({ preset: "last_7d" });
      setColumns([]); setSchedule({ enabled: false, frequency: "daily", hour: 8, minute: 0, weekdays: [1], monthday: 1 });
      setRecipients({});
    }
    setPreviewData(null);
  }, [open, report?.id]);

  const availableFields = useMemo(() => {
    if (source === "contacts") return (fieldDefinitions ?? []).filter((f) => f.entity_type === "contact");
    if (source === "deals") return (fieldDefinitions ?? []).filter((f) => f.entity_type === "lead");
    return [];
  }, [fieldDefinitions, source]);

  const availableColumns = useMemo(() => {
    const base: { key: string; label: string }[] = [];
    if (source === "contacts") {
      base.push({ key: "name", label: "Nome" }, { key: "phone", label: "Telefone" }, { key: "email", label: "E-mail" }, { key: "created_at", label: "Criado em" });
    } else if (source === "deals") {
      base.push({ key: "title", label: "Título" }, { key: "value", label: "Valor" }, { key: "contact_name", label: "Contato" }, { key: "contact_phone", label: "Telefone" }, { key: "stage", label: "Etapa" }, { key: "funnel", label: "Funil" }, { key: "created_at", label: "Criado em" });
    } else if (source === "form_submissions") {
      base.push({ key: "contact_name", label: "Contato" }, { key: "contact_phone", label: "Telefone" }, { key: "data_summary", label: "Respostas" }, { key: "created_at", label: "Enviado em" });
    } else {
      base.push({ key: "contact_name", label: "Contato" }, { key: "contact_phone", label: "Telefone" }, { key: "created_at", label: "Criado em" });
    }
    // add cf:field for the selected field
    if (filter.field_key) base.push({ key: `cf:${filter.field_key}`, label: `Campo: ${filter.field_key}` });
    return base;
  }, [source, filter.field_key]);

  const toggleColumn = (k: string) => setColumns((c) => c.includes(k) ? c.filter((x) => x !== k) : [...c, k]);
  const toggleRecipientChannel = (userId: string, channel: "bell" | "whatsapp") => {
    setRecipients((r) => {
      const cur = r[userId] ?? [];
      const next = cur.includes(channel) ? cur.filter((c) => c !== channel) : [...cur, channel];
      return { ...r, [userId]: next };
    });
  };
  const removeRecipient = (userId: string) => setRecipients((r) => { const n = { ...r }; delete n[userId]; return n; });

  const handlePreview = async () => {
    try {
      const res = await previewReport.mutateAsync({
        source, filter_config: filter, period_config: period, columns: columns.length ? columns : availableColumns.map((c) => c.key),
      });
      setPreviewData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar prévia");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Dê um nome ao relatório"); return; }
    const recList = Object.entries(recipients)
      .filter(([, ch]) => ch.length > 0)
      .map(([user_id, channels]) => ({ user_id, channels }));
    try {
      const id = await saveReport.mutateAsync({
        id: report?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        source, filter_config: filter, period_config: period,
        columns: columns.length ? columns : availableColumns.map((c) => c.key),
        schedule_config: schedule,
        recipients: recList,
      });
      onOpenChange(false);
      return id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const handleSaveAndRun = async () => {
    const id = await handleSave();
    if (id) await runNow.mutateAsync(id);
  };

  const memberOptions = useMemo(() => {
    const list = (members ?? []).filter((m) => m.user_id && m.status === "active");
    // Include organization owner too if not in team_members
    if (organization?.owner_id && !list.some((m) => m.user_id === organization.owner_id)) {
      list.unshift({ id: "owner", user_id: organization.owner_id, status: "active", profile: null } as any);
    }
    return list;
  }, [members, organization]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{report ? "Editar relatório" : "Novo relatório dinâmico"}</DialogTitle>
          <DialogDescription className="sr-only">
            Configure a fonte, o período, os campos e os destinatários do relatório.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="recipients">Destinatários</TabsTrigger>
            <TabsTrigger value="schedule">Agendamento</TabsTrigger>
            <TabsTrigger value="preview">Prévia</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="config" className="space-y-4 pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vencimentos da semana" />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fonte</Label>
                  <Select value={source} onValueChange={(v) => { setSource(v as ReportSource); setFilter({}); setColumns([]); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contacts">Contatos</SelectItem>
                      <SelectItem value="deals">Deals (Funil)</SelectItem>
                      <SelectItem value="form_submissions">Formulários</SelectItem>
                      <SelectItem value="tags_stage">Tags / Etapa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Período</Label>
                  <Select value={period.preset} onValueChange={(v) => setPeriod({ ...period, preset: v as PeriodConfig["preset"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERIOD_PRESETS.map((p) => <SelectItem key={p.value} value={p.value!}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {period.preset === "custom" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Início</Label>
                    <Input type="date" value={period.custom_start?.slice(0, 10) ?? ""} onChange={(e) => setPeriod({ ...period, custom_start: e.target.value })} />
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Input type="date" value={period.custom_end?.slice(0, 10) ?? ""} onChange={(e) => setPeriod({ ...period, custom_end: e.target.value })} />
                  </div>
                </div>
              )}

              {(source === "contacts" || source === "deals") && (
                <div>
                  <Label>Filtrar por campo personalizado (data)</Label>
                  <Select value={filter.field_key ?? "__none__"} onValueChange={(v) => setFilter({ ...filter, field_key: v === "__none__" ? undefined : v })}>
                    <SelectTrigger><SelectValue placeholder="Sem filtro por campo personalizado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nenhum (usar data de criação) —</SelectItem>
                      {availableFields.map((f) => (
                        <SelectItem key={f.id} value={f.field_key}>{f.field_name} ({f.field_type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se um campo for escolhido, o relatório traz registros cujo valor deste campo cai dentro do período selecionado. Útil para "data de pagamento da entrada" etc.
                  </p>
                </div>
              )}

              {source === "deals" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Funil (opcional)</Label>
                    <Select value={filter.deal_funnel_id ?? "__any__"} onValueChange={(v) => setFilter({ ...filter, deal_funnel_id: v === "__any__" ? undefined : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">Todos os funis</SelectItem>
                        {(funnels ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {source === "form_submissions" && (
                <div>
                  <Label>Formulário</Label>
                  <Select value={filter.form_id ?? ""} onValueChange={(v) => setFilter({ ...filter, form_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o formulário" /></SelectTrigger>
                    <SelectContent>
                      {(forms ?? []).map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {source === "tags_stage" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Etapa do funil (opcional)</Label>
                    <Select value={filter.stage_id ?? "__none__"} onValueChange={(v) => setFilter({ ...filter, stage_id: v === "__none__" ? undefined : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Nenhuma —</SelectItem>
                        {(funnels ?? []).flatMap((f: any) => (f.stages ?? []).map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{f.name} → {s.name}</SelectItem>
                        )))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div>
                <Label>Colunas no PDF</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {availableColumns.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={columns.length === 0 ? true : columns.includes(c.key)}
                        onCheckedChange={() => toggleColumn(c.key)}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Se nenhuma coluna for marcada, todas serão incluídas.</p>
              </div>
            </TabsContent>

            <TabsContent value="recipients" className="space-y-3 pr-2">
              <p className="text-sm text-muted-foreground">Escolha quem recebe o relatório e por qual canal.</p>
              <div className="border rounded-md divide-y">
                {memberOptions.map((m: any) => {
                  const channels = recipients[m.user_id] ?? [];
                  const selected = channels.length > 0;
                  return (
                    <div key={m.user_id} className="flex items-center gap-3 p-3">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(v) => {
                          if (v) setRecipients((r) => ({ ...r, [m.user_id]: ["bell"] }));
                          else removeRecipient(m.user_id);
                        }}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{m.profile?.full_name || m.user_id.slice(0, 8)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 text-xs">
                          <Checkbox disabled={!selected} checked={channels.includes("bell")} onCheckedChange={() => toggleRecipientChannel(m.user_id, "bell")} />
                          Sino
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <Checkbox disabled={!selected} checked={channels.includes("whatsapp")} onCheckedChange={() => toggleRecipientChannel(m.user_id, "whatsapp")} />
                          WhatsApp
                        </label>
                      </div>
                    </div>
                  );
                })}
                {memberOptions.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">Sem membros na organização.</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4 pr-2">
              <div className="flex items-center gap-3">
                <Switch checked={schedule.enabled} onCheckedChange={(v) => setSchedule({ ...schedule, enabled: v })} />
                <Label>Agendar execução recorrente</Label>
              </div>
              {schedule.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Frequência</Label>
                    <Select value={schedule.frequency} onValueChange={(v) => setSchedule({ ...schedule, frequency: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diária</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Horário</Label>
                    <div className="flex gap-2">
                      <Input type="number" min={0} max={23} value={schedule.hour ?? 8} onChange={(e) => setSchedule({ ...schedule, hour: Number(e.target.value) })} className="w-20" />
                      <span className="self-center">:</span>
                      <Input type="number" min={0} max={59} value={schedule.minute ?? 0} onChange={(e) => setSchedule({ ...schedule, minute: Number(e.target.value) })} className="w-20" />
                    </div>
                  </div>
                  {schedule.frequency === "weekly" && (
                    <div className="col-span-2">
                      <Label>Dias da semana</Label>
                      <div className="flex gap-2 mt-2">
                        {WEEKDAYS.map((w) => {
                          const active = (schedule.weekdays ?? []).includes(w.v);
                          return (
                            <Button key={w.v} type="button" size="sm" variant={active ? "default" : "outline"}
                              onClick={() => {
                                const cur = new Set(schedule.weekdays ?? []);
                                if (cur.has(w.v)) cur.delete(w.v); else cur.add(w.v);
                                setSchedule({ ...schedule, weekdays: Array.from(cur).sort() });
                              }}>{w.l}</Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {schedule.frequency === "monthly" && (
                    <div>
                      <Label>Dia do mês</Label>
                      <Input type="number" min={1} max={31} value={schedule.monthday ?? 1} onChange={(e) => setSchedule({ ...schedule, monthday: Number(e.target.value) })} className="w-24" />
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Todos os horários usam o fuso da organização.</p>
            </TabsContent>

            <TabsContent value="preview" className="space-y-3 pr-2">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Gere uma prévia com o filtro atual (não envia notificações).</p>
                <Button onClick={handlePreview} disabled={previewReport.isPending} size="sm">
                  {previewReport.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Gerar prévia
                </Button>
              </div>
              {previewData && (
                <div className="space-y-2">
                  <Badge variant="secondary">{previewData.row_count} registros no período</Badge>
                  <div className="border rounded-md max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(previewData.preview[0] ?? {}).slice(0, 6).map((k) => <TableHead key={k}>{k}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.preview.slice(0, 25).map((row, i) => (
                          <TableRow key={i}>
                            {Object.keys(previewData.preview[0] ?? {}).slice(0, 6).map((k) => (
                              <TableCell key={k} className="text-xs">{typeof row[k] === "object" ? JSON.stringify(row[k]).slice(0, 50) : String(row[k] ?? "")}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={handleSave} disabled={saveReport.isPending}>
            {saveReport.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
          <Button onClick={handleSaveAndRun} disabled={saveReport.isPending || runNow.isPending}>
            {runNow.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Salvar e Gerar Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
