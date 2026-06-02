import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, MessageSquare, Clock, ThumbsUp, AlertCircle, Sparkles, Quote } from 'lucide-react';
import { UserPerformanceItem } from '@/hooks/useAnalysisReports';

function formatSeconds(s: number) {
  if (!s) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  return `${(s / 3600).toFixed(1)}h`;
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

export function UserPerformanceTab({ users }: { users: UserPerformanceItem[] }) {
  if (!users || users.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Nenhum dado de performance individual disponível para este período.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {users.map((u) => (
        <Card key={u.user_id} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-full h-10 w-10 flex items-center justify-center">
                  <Trophy className={`h-5 w-5 ${u.ranking === 1 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <CardTitle className="text-lg">#{u.ranking} {u.name}</CardTitle>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {u.conversations_handled} conv.</span>
                    <span>{u.messages_sent} enviadas</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> 1ª resp: {formatSeconds(u.avg_first_response_seconds)}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${scoreColor(u.overall_score)}`}>{u.overall_score}</div>
                <div className="text-xs text-muted-foreground">Nota geral</div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Score bars */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Textual', value: u.textual_quality_score },
                { label: 'Comunicação', value: u.communication_score },
                { label: 'Vendas', value: u.sales_score },
                { label: 'Eficiência', value: u.efficiency_score },
                { label: 'Áudios', value: u.audio_analysis_score },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className={`font-semibold ${scoreColor(s.value)}`}>{s.value}</span>
                  </div>
                  <Progress value={s.value} className="h-1.5" />
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {u.strengths.length > 0 && (
                <div className="bg-green-500/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2 text-green-700 dark:text-green-400 font-medium text-sm">
                    <ThumbsUp className="h-4 w-4" /> Pontos fortes
                  </div>
                  <ul className="text-sm space-y-1">
                    {u.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
              )}
              {u.improvements.length > 0 && (
                <div className="bg-orange-500/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2 text-orange-700 dark:text-orange-400 font-medium text-sm">
                    <AlertCircle className="h-4 w-4" /> Áreas a melhorar
                  </div>
                  <ul className="text-sm space-y-1">
                    {u.improvements.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {u.coaching_tips.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2 text-primary font-medium text-sm">
                  <Sparkles className="h-4 w-4" /> Coaching personalizado
                </div>
                <ol className="text-sm space-y-1.5 list-decimal list-inside">
                  {u.coaching_tips.map((t, i) => <li key={i}>{t}</li>)}
                </ol>
              </div>
            )}

            {u.highlighted_message && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm italic flex gap-2">
                <Quote className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                <span>"{u.highlighted_message}"</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
