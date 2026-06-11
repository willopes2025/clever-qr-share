import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Plus, Pencil, Trash2, Send, Loader2, Pause, Play } from "lucide-react";
import {
  ScheduledAnalysisReport,
  ScheduledFrequency,
  useScheduledAnalysisReports,
} from "@/hooks/useScheduledAnalysisReports";
import { ScheduledAnalysisDialog } from "./ScheduledAnalysisDialog";
import { formatFullDateTimeBR } from "@/lib/date-utils";

const FREQ_LABEL: Record<ScheduledFrequency, string> = {
  daily: "Diário",
  weekly: "7 dias",
  biweekly: "15 dias",
  monthly: "30 dias",
};

export function ScheduledReportsCard() {
  const { schedules, isLoading, remove, update, runNow } = useScheduledAnalysisReports();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledAnalysisReport | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (s: ScheduledAnalysisReport) => {
    setEditing(s);
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Relatórios Automáticos
          </CardTitle>
          <CardDescription>
            Envio recorrente do PDF de análise via WhatsApp para os membros selecionados.
          </CardDescription>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo agendamento
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum agendamento configurado.
          </p>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 border rounded-lg p-3 hover:bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{s.name}</span>
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "Ativo" : "Pausado"}
                    </Badge>
                    <Badge variant="outline">{FREQ_LABEL[s.frequency]}</Badge>
                    <Badge variant="outline">{s.send_time.slice(0, 5)}</Badge>
                    <Badge variant="outline">{s.recipient_user_ids.length} destinatário(s)</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Próximo envio: {formatFullDateTimeBR(s.next_run_at)}
                    {s.last_run_at ? ` · Último: ${formatFullDateTimeBR(s.last_run_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runNow.mutate(s.id)}
                    disabled={runNow.isPending}
                    title="Enviar agora"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      update.mutate({ id: s.id, input: { is_active: !s.is_active } as any })
                    }
                    title={s.is_active ? "Pausar" : "Ativar"}
                  >
                    {s.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Excluir agendamento "${s.name}"?`)) remove.mutate(s.id);
                    }}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ScheduledAnalysisDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schedule={editing}
      />
    </Card>
  );
}
