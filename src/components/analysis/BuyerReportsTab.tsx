import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useBuyerReportObjectives, useBuyerReportRuns, downloadBuyerReport,
  BuyerReportObjective,
} from '@/hooks/useBuyerReports';
import { useFunnels } from '@/hooks/useFunnels';
import { useOrganization, useTeamMembers } from '@/hooks/useOrganization';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { Plus, Edit, Trash2, Play, Download, Flame, Calendar, Loader2 } from 'lucide-react';
import { formatFullDateTimeBR } from '@/lib/date-utils';

const WEEKDAYS = [
  { v: 0, l: 'Dom' }, { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' },
  { v: 3, l: 'Qua' }, { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' },
];

const VARIABLE_HINTS = [
  '{contato} — nome do contato',
  '{ultimas_mensagens} — histórico recente',
  '{tempo_etapa} — dias na etapa',
  '{valor_negocio} — valor do negócio',
  '{custom_fields} — campos personalizados',
];

const DEFAULT_PROMPT = `Identifique leads com alta probabilidade de fechamento agora.
Considere: urgência declarada, perguntas sobre preço/condições, comparações com concorrentes, prazos mencionados, e respostas rápidas e detalhadas. Desconsidere leads que pedem só informação geral ou estão claramente em pesquisa inicial.`;

export function BuyerReportsTab() {
  const { objectives, isLoading, upsert, remove, generatePreview, runNow } = useBuyerReportObjectives();
  const { data: runs = [] } = useBuyerReportRuns();
  const { funnels = [] } = useFunnels({ includeDeals: false });
  const { organization, members = [] } = useOrganization();
  const { instances = [] } = useWhatsAppInstances();
  const [editing, setEditing] = useState<Partial<BuyerReportObjective> | null>(null);

  const openNew = () => setEditing({
    name: '', description: '', prompt: DEFAULT_PROMPT,
    funnel_id: funnels[0]?.id, stage_ids: [],
    min_score: 60, max_leads: 50, lookback_days: 7,
    schedule_time: '08:00', schedule_days: [1, 2, 3, 4, 5],
    enabled: true, manager_user_ids: [],
    send_to_assignee_whatsapp: false, whatsapp_instance_id: null,
  });

  const save = async () => {
    if (!editing?.name || !editing?.funnel_id || !editing?.prompt || !organization) return;
    await upsert.mutateAsync({
      ...editing,
      organization_id: organization.id,
    } as any);
    setEditing(null);
  };

  const selectedFunnel = funnels.find((f: any) => f.id === editing?.funnel_id);
  const stages = (selectedFunnel as any)?.stages || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Relatórios Diários de Leads Quentes
              </CardTitle>
              <CardDescription>
                Configure objetivos de compra. A IA analisa o histórico das conversas e envia diariamente um
                PDF com os leads mais quentes para gestores (e-mail) e vendedores (WhatsApp).
              </CardDescription>
            </div>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Objetivo</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
            objectives.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Flame className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum objetivo configurado ainda.</p>
                <p className="text-sm">Crie um para começar a receber relatórios diários.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {objectives.map((o) => {
                  const funnel = funnels.find((f: any) => f.id === o.funnel_id);
                  return (
                    <div key={o.id} className="border rounded-lg p-4 hover:bg-muted/30">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold">{o.name}</h3>
                            <Badge variant={o.enabled ? 'default' : 'secondary'}>
                              {o.enabled ? 'Ativo' : 'Pausado'}
                            </Badge>
                            <Badge variant="outline">{(funnel as any)?.name || '—'}</Badge>
                            <Badge variant="outline">{o.stage_ids.length} etapa(s)</Badge>
                          </div>
                          {o.description && <p className="text-sm text-muted-foreground mb-2">{o.description}</p>}
                          <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                            <span>⏰ {o.schedule_time} • {o.schedule_days.map(d => WEEKDAYS[d].l).join(',')}</span>
                            <span>🎯 score ≥ {o.min_score}</span>
                            <span>📊 últimos {o.lookback_days}d</span>
                            <span>📧 {o.manager_user_ids.length} gestor(es)</span>
                            {o.send_to_assignee_whatsapp && <span>📱 WhatsApp para responsáveis</span>}
                            {o.last_run_at && <span>Último: {formatFullDateTimeBR(o.last_run_at)}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => generatePreview.mutate(o.id)}
                            disabled={generatePreview.isPending}>
                            {generatePreview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            <span className="ml-1 hidden sm:inline">Prévia</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => runNow.mutate(o.id)}
                            disabled={runNow.isPending}>
                            <Play className="h-4 w-4" /><span className="ml-1 hidden sm:inline">Disparar</span>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(o)}><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => confirm('Excluir?') && remove.mutate(o.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" /> Histórico de envios
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum envio ainda.</p>
          ) : (
            <div className="space-y-2">
              {runs.slice(0, 20).map(r => {
                const obj = objectives.find(o => o.id === r.objective_id);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-sm border-b pb-2">
                    <div className="flex-1">
                      <div className="font-medium">{obj?.name || 'Objetivo removido'}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFullDateTimeBR(r.executed_at)} • {r.leads_count} leads •
                        email: {r.email_status || '—'} • whatsapp: {r.whatsapp_status || '—'}
                      </div>
                    </div>
                    {r.pdf_storage_path && (
                      <Button size="sm" variant="outline" onClick={() => downloadBuyerReport(r.pdf_storage_path!)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar objetivo' : 'Novo objetivo'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Ex: Comprador VIP" />
                </div>
                <div>
                  <Label>Funil</Label>
                  <Select value={editing.funnel_id} onValueChange={(v) => setEditing({ ...editing, funnel_id: v, stage_ids: [] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {funnels.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Descrição (opcional)</Label>
                <Input value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>

              <div>
                <Label>Etapas incluídas</Label>
                <div className="grid grid-cols-2 gap-2 mt-1 p-2 border rounded max-h-48 overflow-y-auto">
                  {stages.map((s: any) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={editing.stage_ids?.includes(s.id)}
                        onCheckedChange={(c) => {
                          const ids = new Set(editing.stage_ids || []);
                          if (c) ids.add(s.id); else ids.delete(s.id);
                          setEditing({ ...editing, stage_ids: Array.from(ids) });
                        }}
                      />
                      {s.name}
                    </label>
                  ))}
                  {stages.length === 0 && <p className="text-xs text-muted-foreground col-span-2">Selecione um funil.</p>}
                </div>
              </div>

              <div>
                <Label>Prompt da IA (critério de "comprador potencial")</Label>
                <Textarea rows={5} value={editing.prompt || ''}
                  onChange={(e) => setEditing({ ...editing, prompt: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">
                  Dica: {VARIABLE_HINTS.join(' · ')}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Score mínimo: {editing.min_score}</Label>
                  <Slider min={0} max={100} step={5} value={[editing.min_score || 60]}
                    onValueChange={(v) => setEditing({ ...editing, min_score: v[0] })} />
                </div>
                <div>
                  <Label>Máx leads</Label>
                  <Input type="number" value={editing.max_leads || 50}
                    onChange={(e) => setEditing({ ...editing, max_leads: parseInt(e.target.value) || 50 })} />
                </div>
                <div>
                  <Label>Janela (dias)</Label>
                  <Input type="number" value={editing.lookback_days || 7}
                    onChange={(e) => setEditing({ ...editing, lookback_days: parseInt(e.target.value) || 7 })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Horário</Label>
                  <Input type="time" value={editing.schedule_time || '08:00'}
                    onChange={(e) => setEditing({ ...editing, schedule_time: e.target.value })} />
                </div>
                <div>
                  <Label>Dias</Label>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {WEEKDAYS.map(d => (
                      <Button key={d.v} type="button" size="sm"
                        variant={editing.schedule_days?.includes(d.v) ? 'default' : 'outline'}
                        onClick={() => {
                          const set = new Set(editing.schedule_days || []);
                          if (set.has(d.v)) set.delete(d.v); else set.add(d.v);
                          setEditing({ ...editing, schedule_days: Array.from(set).sort() });
                        }}>{d.l}</Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <Label className="text-base">Destinatários</Label>
                <div>
                  <Label className="text-sm">Gestores (e-mail consolidado)</Label>
                  <div className="grid grid-cols-2 gap-1 mt-1 p-2 border rounded max-h-32 overflow-y-auto">
                    {members.filter((m: any) => m.user_id).map((m: any) => (
                      <label key={m.user_id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={editing.manager_user_ids?.includes(m.user_id)}
                          onCheckedChange={(c) => {
                            const ids = new Set(editing.manager_user_ids || []);
                            if (c) ids.add(m.user_id); else ids.delete(m.user_id);
                            setEditing({ ...editing, manager_user_ids: Array.from(ids) });
                          }}
                        />
                        {m.profile?.full_name || m.email}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Enviar WhatsApp para o responsável de cada lead</Label>
                  <Switch checked={editing.send_to_assignee_whatsapp || false}
                    onCheckedChange={(c) => setEditing({ ...editing, send_to_assignee_whatsapp: c })} />
                </div>

                {editing.send_to_assignee_whatsapp && (
                  <div>
                    <Label>Instância para envio</Label>
                    <Select value={editing.whatsapp_instance_id || ''}
                      onValueChange={(v) => setEditing({ ...editing, whatsapp_instance_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {instances.filter((i: any) => i.status === 'connected').map((i: any) => (
                          <SelectItem key={i.id} value={i.id}>{i.instance_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <Label>Ativo</Label>
                <Switch checked={editing.enabled !== false}
                  onCheckedChange={(c) => setEditing({ ...editing, enabled: c })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
