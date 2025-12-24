import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, Star, AlertCircle, CheckCircle, XCircle, MessageSquare, TrendingUp, Mic, FileText, Lightbulb, ThumbsUp, ThumbsDown, Target, Zap, BookOpen, Users } from 'lucide-react';
import { AnalysisReport } from '@/hooks/useAnalysisReports';
import { formatDateOnly } from '@/lib/date-utils';
import { AnalysisScoreCard } from './AnalysisScoreCard';

interface AnalysisReportDetailProps {
  report: AnalysisReport;
  onBack: () => void;
  onExport: () => void;
}

export function AnalysisReportDetail({ report, onBack, onExport }: AnalysisReportDetailProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Relatório de Análise</h1>
            <p className="text-muted-foreground">
              {formatDateOnly(report.period_start)} - {formatDateOnly(report.period_end)}
            </p>
          </div>
        </div>
        <Button onClick={onExport}>
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Score Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <AnalysisScoreCard
          title="Nota Geral"
          score={report.overall_score}
          icon={Star}
          className="col-span-2 md:col-span-1"
        />
        <AnalysisScoreCard
          title="Qualidade Textual"
          score={report.textual_quality_score}
          icon={FileText}
          description="Gramática, ortografia, clareza"
        />
        <AnalysisScoreCard
          title="Comunicação"
          score={report.communication_score}
          icon={Users}
          description="Rapport, empatia, cordialidade"
        />
        <AnalysisScoreCard
          title="Vendas"
          score={report.sales_score}
          icon={Target}
          description="Persuasão, fechamento"
        />
        <AnalysisScoreCard
          title="Eficiência"
          score={report.efficiency_score}
          icon={Zap}
          description="Tempo de resposta"
        />
        <AnalysisScoreCard
          title="Áudios"
          score={report.audio_analysis_score}
          icon={Mic}
          description="Qualidade das mensagens de voz"
        />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{report.total_conversations}</div>
                <div className="text-sm text-muted-foreground">Conversas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{report.total_messages_sent}</div>
                <div className="text-sm text-muted-foreground">Enviadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{report.total_messages_received}</div>
                <div className="text-sm text-muted-foreground">Recebidas</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Mic className="h-8 w-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{report.total_audios_analyzed}</div>
                <div className="text-sm text-muted-foreground">Áudios</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Resumo</TabsTrigger>
          <TabsTrigger value="strengths">Pontos Fortes</TabsTrigger>
          <TabsTrigger value="improvements">Melhorias</TabsTrigger>
          <TabsTrigger value="examples">Exemplos</TabsTrigger>
          <TabsTrigger value="conversations">Conversas</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Resumo Executivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {report.executive_summary.split('\n').map((paragraph, i) => (
                  <p key={i} className="mb-3">{paragraph}</p>
                ))}
              </div>
            </CardContent>
          </Card>

          {report.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Recomendações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">{i + 1}</span>
                      </div>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="strengths" className="space-y-4">
          {report.strengths.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhum ponto forte identificado
              </CardContent>
            </Card>
          ) : (
            report.strengths.map((strength, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <ThumbsUp className="h-5 w-5" />
                    {strength.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p>{strength.description}</p>
                  {strength.example && (
                    <div className="bg-green-500/10 rounded-lg p-4 text-sm">
                      <p className="font-medium text-green-600 mb-1">Exemplo:</p>
                      <p className="italic">"{strength.example}"</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="improvements" className="space-y-4">
          {report.improvements.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhuma área de melhoria identificada
              </CardContent>
            </Card>
          ) : (
            report.improvements.map((improvement, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-600">
                    <AlertCircle className="h-5 w-5" />
                    {improvement.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p>{improvement.description}</p>
                  {improvement.suggestion && (
                    <div className="bg-blue-500/10 rounded-lg p-4 text-sm">
                      <p className="font-medium text-blue-600 mb-1">Sugestão:</p>
                      <p>{improvement.suggestion}</p>
                    </div>
                  )}
                  {improvement.example && (
                    <div className="bg-orange-500/10 rounded-lg p-4 text-sm">
                      <p className="font-medium text-orange-600 mb-1">Exemplo:</p>
                      <p className="italic">"{improvement.example}"</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          {report.highlighted_examples.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhum exemplo destacado
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {report.highlighted_examples.map((example, i) => (
                <Card key={i} className={example.type === 'positive' ? 'border-green-500/50' : 'border-red-500/50'}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      {example.type === 'positive' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <Badge variant={example.type === 'positive' ? 'default' : 'destructive'}>
                        {example.type === 'positive' ? 'Positivo' : 'Negativo'}
                      </Badge>
                    </div>
                    <CardDescription>{example.context}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-muted/50 rounded-lg p-3 text-sm italic">
                      "{example.message}"
                    </div>
                    <p className="text-sm text-muted-foreground">{example.reason}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="conversations" className="space-y-4">
          {report.conversation_details.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhum detalhe de conversa disponível
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4 pr-4">
                {report.conversation_details.map((conv, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{conv.contact}</CardTitle>
                        <Badge 
                          variant={conv.score >= 70 ? 'default' : conv.score >= 50 ? 'secondary' : 'destructive'}
                        >
                          Nota: {conv.score}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground">{conv.summary}</p>
                      <div className="bg-muted/50 rounded-lg p-3 text-sm">
                        <p className="font-medium mb-1">Feedback:</p>
                        <p>{conv.feedback}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
