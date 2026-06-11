import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import {
  ScheduleInput,
  ScheduledAnalysisReport,
  ScheduledFrequency,
  useScheduledAnalysisReports,
} from "@/hooks/useScheduledAnalysisReports";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: ScheduledAnalysisReport | null;
}

const FREQ_LABEL: Record<ScheduledFrequency, string> = {
  daily: "Diário (todo dia)",
  weekly: "Semanal (a cada 7 dias)",
  biweekly: "Quinzenal (a cada 15 dias)",
  monthly: "Mensal (a cada 30 dias)",
};

export function ScheduledAnalysisDialog({ open, onOpenChange, schedule }: Props) {
  const { members } = useTeamMembers();
  const { create, update } = useScheduledAnalysisReports();

  const [form, setForm] = useState<ScheduleInput>({
    name: "",
    frequency: "weekly",
    send_time: "08:00",
    recipient_user_ids: [],
    include_campaigns: true,
    include_sla: true,
    transcribe_audios: true,
    is_active: true,
  });

  useEffect(() => {
    if (schedule) {
      setForm({
        name: schedule.name,
        frequency: schedule.frequency,
        send_time: schedule.send_time.slice(0, 5),
        recipient_user_ids: schedule.recipient_user_ids || [],
        include_campaigns: schedule.include_campaigns,
        include_sla: schedule.include_sla,
        transcribe_audios: schedule.transcribe_audios,
        is_active: schedule.is_active,
      });
    } else if (open) {
      setForm({
        name: "",
        frequency: "weekly",
        send_time: "08:00",
        recipient_user_ids: [],
        include_campaigns: true,
        include_sla: true,
        transcribe_audios: true,
        is_active: true,
      });
    }
  }, [schedule, open]);

  const eligibleMembers = (members || []).filter((m: any) => m.user_id && m.status === "active");
  const isSaving = create.isPending || update.isPending;

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (form.recipient_user_ids.length === 0) return;
    if (schedule) {
      await update.mutateAsync({ id: schedule.id, input: form });
    } else {
      await create.mutateAsync(form);
    }
    onOpenChange(false);
  };

  const toggleRecipient = (userId: string) => {
    setForm((f) => ({
      ...f,
      recipient_user_ids: f.recipient_user_ids.includes(userId)
        ? f.recipient_user_ids.filter((id) => id !== userId)
        : [...f.recipient_user_ids, userId],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{schedule ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          <DialogDescription>
            Envia automaticamente um PDF de análise via WhatsApp para os membros selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sa-name">Nome do agendamento</Label>
            <Input
              id="sa-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Relatório semanal da equipe"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm({ ...form, frequency: v as ScheduledFrequency })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FREQ_LABEL) as ScheduledFrequency[]).map((f) => (
                    <SelectItem key={f} value={f}>{FREQ_LABEL[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sa-time">Horário de envio</Label>
              <Input
                id="sa-time"
                type="time"
                value={form.send_time}
                onChange={(e) => setForm({ ...form, send_time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Destinatários (WhatsApp)</Label>
            <p className="text-xs text-muted-foreground">
              Apenas membros ativos com telefone cadastrado aparecem aqui.
            </p>
            <ScrollArea className="h-40 rounded-md border p-2">
              {eligibleMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">
                  Nenhum membro com telefone cadastrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {eligibleMembers.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                    >
                      <Checkbox
                        checked={form.recipient_user_ids.includes(m.user_id!)}
                        onCheckedChange={() => toggleRecipient(m.user_id!)}
                      />
                      <span className="flex-1">
                        {m.profile?.full_name || m.email || "—"}
                        <span className="text-muted-foreground ml-2">{(m as any).phone || "sem telefone"}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-sm">Conteúdo do relatório</Label>
            <div className="flex items-center justify-between text-sm">
              <span>Incluir campanhas</span>
              <Switch
                checked={form.include_campaigns}
                onCheckedChange={(v) => setForm({ ...form, include_campaigns: v })}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Incluir SLA</span>
              <Switch
                checked={form.include_sla}
                onCheckedChange={(v) => setForm({ ...form, include_sla: v })}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Transcrever áudios</span>
              <Switch
                checked={form.transcribe_audios}
                onCheckedChange={(v) => setForm({ ...form, transcribe_audios: v })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Ativo</Label>
              <p className="text-xs text-muted-foreground">Pause sem precisar excluir.</p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !form.name.trim() || form.recipient_user_ids.length === 0}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {schedule ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
