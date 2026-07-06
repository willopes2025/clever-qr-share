import { useEffect, useState } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileBarChart, Plus, Play, Pencil, Trash2, Download, Loader2, Calendar, Bell } from "lucide-react";
import { useDynamicReports, type DynamicReport } from "@/hooks/useDynamicReports";
import { DynamicReportDialog } from "@/components/dynamic-reports/DynamicReportDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SOURCE_LABELS: Record<string, string> = {
  contacts: "Contatos",
  deals: "Deals",
  form_submissions: "Formulários",
  tags_stage: "Tags / Etapa",
};

const PRESET_LABELS: Record<string, string> = {
  today: "Hoje", yesterday: "Ontem", tomorrow: "Amanhã",
  last_3d: "Últimos 3 dias", last_7d: "Últimos 7 dias", last_30d: "Últimos 30 dias",
  next_7d: "Próximos 7 dias", this_month: "Este mês", last_month: "Mês passado", custom: "Customizado",
};

export default function DynamicReports() {
  const { reports, runs, isLoading, deleteReport, runNow, getPdfUrl, refetch } = useDynamicReports();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DynamicReport | null>(null);

  // Realtime toast when a new run is inserted for a report I'm a recipient of
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("dynamic-report-runs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dynamic_report_runs" }, async (payload) => {
        const run = payload.new as any;
        // Check if I am a recipient
        const { data: rec } = await supabase.from("dynamic_report_recipients" as any)
          .select("id, channels").eq("report_id", run.report_id).eq("user_id", user.id).maybeSingle();
        if (rec && (rec as any).channels?.includes("bell")) {
          toast.info(`Novo relatório disponível (${run.row_count} registros)`, {
            action: run.pdf_storage_path ? {
              label: "Baixar PDF",
              onClick: async () => {
                const url = await getPdfUrl(run.pdf_storage_path);
                if (url) window.open(url, "_blank");
              },
            } : undefined,
          });
        }
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleEdit = (r: DynamicReport) => { setEditing(r); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setDialogOpen(true); };
  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este relatório?")) return;
    await deleteReport.mutateAsync(id);
  };
  const handleRun = async (id: string) => { await runNow.mutateAsync(id); };
  const handleDownload = async (path: string | null) => {
    if (!path) return;
    const url = await getPdfUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("Não foi possível gerar link do PDF");
  };

  return (
    <AppLayout pageTitle="Relatórios Dinâmicos">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileBarChart className="h-7 w-7 text-primary" />
              Relatórios Dinâmicos
            </h1>
            <p className="text-muted-foreground text-sm">
              Monte relatórios com base em campos personalizados, formulários, tags ou etapas do funil — e envie por sino ou WhatsApp.
            </p>
          </div>
          <Button onClick={handleNew}><Plus className="h-4 w-4 mr-2" /> Novo relatório</Button>
        </div>

        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports">Meus relatórios</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="reports">
            {isLoading ? (
              <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : reports.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <FileBarChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">Nenhum relatório ainda</h3>
                  <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro relatório dinâmico.</p>
                  <Button onClick={handleNew}><Plus className="h-4 w-4 mr-2" />Criar relatório</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {reports.map((r) => (
                  <Card key={r.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{r.name}</CardTitle>
                          {r.description && <CardDescription>{r.description}</CardDescription>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleRun(r.id)} title="Rodar agora">
                            {runNow.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(r)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{SOURCE_LABELS[r.source]}</Badge>
                        <Badge variant="outline">{PRESET_LABELS[r.period_config?.preset ?? "last_7d"]}</Badge>
                        {r.schedule_config?.enabled && (
                          <Badge variant="secondary" className="gap-1">
                            <Calendar className="h-3 w-3" />
                            {r.schedule_config.frequency} · {String(r.schedule_config.hour ?? 8).padStart(2, "0")}:{String(r.schedule_config.minute ?? 0).padStart(2, "0")}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Execuções recentes</CardTitle>
              </CardHeader>
              <CardContent>
                {runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma execução ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Relatório</TableHead>
                        <TableHead>Quando</TableHead>
                        <TableHead>Registros</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>PDF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run) => {
                        const r = reports.find((x) => x.id === run.report_id);
                        return (
                          <TableRow key={run.id}>
                            <TableCell className="font-medium">{r?.name ?? run.report_id.slice(0, 8)}</TableCell>
                            <TableCell>{formatDistanceToNow(new Date(run.executed_at), { addSuffix: true, locale: ptBR })}</TableCell>
                            <TableCell>{run.row_count}</TableCell>
                            <TableCell>
                              {run.status === "success" ? <Badge variant="secondary">OK</Badge> : <Badge variant="destructive">{run.error?.slice(0, 40) ?? "Erro"}</Badge>}
                            </TableCell>
                            <TableCell>
                              {run.pdf_storage_path && (
                                <Button size="sm" variant="ghost" onClick={() => handleDownload(run.pdf_storage_path)}>
                                  <Download className="h-4 w-4 mr-1" /> Baixar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <DynamicReportDialog open={dialogOpen} onOpenChange={setDialogOpen} report={editing} />
    </AppLayout>
  );
}
