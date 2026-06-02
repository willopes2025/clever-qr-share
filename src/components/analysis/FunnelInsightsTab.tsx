import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Clock, AlertTriangle, Lightbulb, Target } from 'lucide-react';
import { FunnelInsight } from '@/hooks/useAnalysisReports';

export function FunnelInsightsTab({ funnels }: { funnels?: FunnelInsight[] }) {
  if (!funnels || funnels.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Nenhum dado de funil disponível para este período.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {funnels.map((f) => (
        <Card key={f.funnel_id}>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                {f.name}
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" /> {f.won_count} ganhos
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <TrendingDown className="h-3 w-3 text-red-500" /> {f.lost_count} perdidos
                </Badge>
                <Badge variant="default">Taxa de ganho: {f.won_rate}%</Badge>
              </div>
            </div>
            <CardDescription className="flex items-center gap-3 mt-2">
              <span>{f.total_deals} deals no período</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {f.avg_days_to_close} dias para fechar (média)</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {f.bottleneck_stages && f.bottleneck_stages.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-orange-600">
                  <AlertTriangle className="h-4 w-4" /> Gargalos detectados
                </div>
                <div className="space-y-2">
                  {f.bottleneck_stages.map((s) => (
                    <div key={s.stage_id} className="border rounded-lg p-3 bg-orange-500/5 border-orange-500/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{s.name}</span>
                        <Badge variant="outline" className="text-xs">{s.avg_hours}h em média</Badge>
                      </div>
                      {s.note && <p className="text-sm text-muted-foreground">{s.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {f.suggestions && f.suggestions.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2 text-primary font-medium text-sm">
                  <Lightbulb className="h-4 w-4" /> Sugestões da IA
                </div>
                <ol className="text-sm space-y-1.5 list-decimal list-inside">
                  {f.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
