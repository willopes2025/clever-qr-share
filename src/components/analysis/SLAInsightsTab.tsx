import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AnalysisReport } from '@/hooks/useAnalysisReports';

function formatSeconds(s: number) {
  if (!s) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  return `${(s / 3600).toFixed(1)}h`;
}

export function SLAInsightsTab({ sla }: { sla: AnalysisReport['sla_performance'] }) {
  if (!sla || (!sla.avg_first_response_seconds && !sla.by_user?.length)) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Nenhum dado de SLA disponível.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{formatSeconds(sla.avg_first_response_seconds || 0)}</div>
                <div className="text-sm text-muted-foreground">1ª resposta (média)</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{sla.unanswered_count || 0}</div>
                <div className="text-sm text-muted-foreground">Conversas sem resposta</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold">{sla.overdue_tasks_count || 0}</div>
                <div className="text-sm text-muted-foreground">Tarefas atrasadas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {sla.by_user && sla.by_user.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SLA por usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-right">1ª resposta</TableHead>
                  <TableHead className="text-right">Tarefas atrasadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sla.by_user.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-right">{formatSeconds(u.avg_first_response_seconds)}</TableCell>
                    <TableCell className="text-right">
                      {u.overdue_tasks_count > 0 ? (
                        <span className="text-red-600 font-medium">{u.overdue_tasks_count}</span>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
