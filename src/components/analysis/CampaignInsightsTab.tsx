import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Send, CheckCircle, XCircle, Lightbulb, FileText } from 'lucide-react';
import { CampaignInsight } from '@/hooks/useAnalysisReports';

export function CampaignInsightsTab({ campaigns }: { campaigns?: CampaignInsight[] }) {
  if (!campaigns || campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Nenhuma campanha encontrada no período.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((c) => {
        const deliveryRate = c.sent > 0 ? Math.round((c.delivered / c.sent) * 100) : 0;
        const failRate = c.sent > 0 ? Math.round((c.failed / c.sent) * 100) : 0;

        return (
          <Card key={c.campaign_id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-4 w-4 text-primary" />
                {c.name}
              </CardTitle>
              <CardDescription className="flex flex-wrap gap-3 mt-2">
                <span className="flex items-center gap-1"><Send className="h-3 w-3" /> {c.sent} enviadas</span>
                <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" /> {c.delivered} entregues ({deliveryRate}%)</span>
                <span className="flex items-center gap-1 text-red-600"><XCircle className="h-3 w-3" /> {c.failed} falharam ({failRate}%)</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Taxa de entrega</span>
                  <span className="font-semibold">{deliveryRate}%</span>
                </div>
                <Progress value={deliveryRate} className="h-1.5" />
              </div>

              {c.template_performance && c.template_performance.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                    <FileText className="h-4 w-4" /> Templates utilizados
                  </div>
                  <div className="space-y-2">
                    {c.template_performance.map((t, i) => (
                      <div key={i} className="border rounded-lg p-3 bg-muted/30">
                        <div className="font-medium text-sm mb-1">{t.name}</div>
                        {t.suggestion && <p className="text-xs text-muted-foreground">💡 {t.suggestion}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {c.suggestions && c.suggestions.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2 text-primary font-medium text-sm">
                    <Lightbulb className="h-4 w-4" /> Sugestões da IA
                  </div>
                  <ol className="text-sm space-y-1.5 list-decimal list-inside">
                    {c.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
