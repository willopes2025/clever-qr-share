import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, CalendarIcon, FileText, Loader2, Sparkles, TrendingUp, TrendingDown, Clock, MessageSquare, Mic, Download, Trash2, ChevronRight, Star, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAnalysisReports, AnalysisReport } from '@/hooks/useAnalysisReports';
import { useSubscription } from '@/hooks/useSubscription';
import { AnalysisScoreCard } from '@/components/analysis/AnalysisScoreCard';
import { AnalysisReportDetail } from '@/components/analysis/AnalysisReportDetail';
import { generateAnalysisPDF } from '@/lib/pdf-export';

export default function Analysis() {
  const { reports, isLoading, isGenerating, generateReport, deleteReport } = useAnalysisReports();
  const { subscription } = useSubscription();
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date }>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [transcribeAudios, setTranscribeAudios] = useState(true);
  const [selectedReport, setSelectedReport] = useState<AnalysisReport | null>(null);

  const plan = subscription?.plan || 'free';
  const hasAccess = plan === 'pro' || plan === 'business';

  const handleGenerateReport = async () => {
    const periodStart = format(dateRange.from, 'yyyy-MM-dd');
    const periodEnd = format(dateRange.to ?? dateRange.from, 'yyyy-MM-dd');
    await generateReport(periodStart, periodEnd, transcribeAudios);
  };

  const handleExportPDF = (report: AnalysisReport) => {
    generateAnalysisPDF(report);
  };

  const handleDeleteReport = (reportId: string) => {
    if (confirm('Tem certeza que deseja excluir este relatório?')) {
      deleteReport.mutate(reportId);
    }
  };

  // Preset date ranges
  const presetRanges = [
    { label: 'Últimos 7 dias', from: subDays(new Date(), 7), to: new Date() },
    { label: 'Últimos 14 dias', from: subDays(new Date(), 14), to: new Date() },
    { label: 'Último mês', from: subMonths(new Date(), 1), to: new Date() },
  ];

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="bg-primary/10 p-4 rounded-full mb-6">
            <Sparkles className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Análise de Atendimento</h1>
          <p className="text-muted-foreground max-w-md mb-6">
            Obtenha insights detalhados sobre a qualidade do seu atendimento com análise de IA.
            Este recurso está disponível nos planos Pro e Business.
          </p>
          <Button size="lg" onClick={() => window.location.href = '/subscription'}>
            Fazer Upgrade
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (selectedReport) {
    return (
      <DashboardLayout>
        <AnalysisReportDetail 
          report={selectedReport} 
          onBack={() => setSelectedReport(null)}
          onExport={() => handleExportPDF(selectedReport)}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Análise de Atendimento
            </h1>
            <p className="text-muted-foreground">
              Análise de qualidade das conversas com feedback detalhado da IA
            </p>
          </div>
        </div>

        {/* Generate Report Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Gerar Novo Relatório
            </CardTitle>
            <CardDescription>
              Selecione o período para análise (máximo de 1 mês)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {presetRanges.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange({ from: preset.from, to: preset.to })}
                  className={cn(
                    dateRange.from.getTime() === preset.from.getTime() &&
                    dateRange.to?.getTime() === preset.to.getTime() &&
                    "bg-primary text-primary-foreground"
                  )}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <Popover>
                <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to 
                      ? `${format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                      : format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from) {
                        if (range.to) {
                          // Limit to 1 month max
                          const maxDate = new Date(range.from);
                          maxDate.setMonth(maxDate.getMonth() + 1);
                          const toDate = range.to > maxDate ? maxDate : range.to;
                          setDateRange({ from: range.from, to: toDate });
                        } else {
                          // Allow single day selection
                          setDateRange({ from: range.from, to: undefined });
                        }
                      }
                    }}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              <div className="flex items-center gap-2">
                <Switch
                  id="transcribe"
                  checked={transcribeAudios}
                  onCheckedChange={setTranscribeAudios}
                />
                <Label htmlFor="transcribe" className="flex items-center gap-1">
                  <Mic className="h-4 w-4" />
                  Transcrever áudios automaticamente
                </Label>
              </div>

              <Button onClick={handleGenerateReport} disabled={isGenerating} className="ml-auto">
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar Relatório
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports List */}
        <Card>
          <CardHeader>
            <CardTitle>Relatórios Anteriores</CardTitle>
            <CardDescription>
              Histórico de análises realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : !reports || reports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum relatório gerado ainda</p>
                <p className="text-sm">Gere seu primeiro relatório para começar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={
                            report.status === 'completed' ? 'default' :
                            report.status === 'processing' ? 'secondary' : 'destructive'
                          }>
                            {report.status === 'completed' ? 'Concluído' :
                             report.status === 'processing' ? 'Processando...' : 'Erro'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Período: {format(new Date(report.period_start), "dd/MM/yyyy")} - {format(new Date(report.period_end), "dd/MM/yyyy")}
                        </p>
                        {report.status === 'completed' && (
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <span>{report.total_conversations} conversas</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <span>{report.total_messages_sent + report.total_messages_received} mensagens</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Mic className="h-4 w-4 text-muted-foreground" />
                              <span>{report.total_audios_analyzed} áudios</span>
                            </div>
                          </div>
                        )}
                        {report.status === 'error' && report.error_message && (
                          <p className="text-sm text-destructive mt-2">{report.error_message}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {report.status === 'completed' && (
                          <>
                            <div className="text-right mr-4">
                              <div className="text-2xl font-bold text-primary">{report.overall_score}</div>
                              <div className="text-xs text-muted-foreground">Nota Geral</div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleExportPDF(report)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {report.status === 'processing' && (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteReport(report.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        {report.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedReport(report)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
