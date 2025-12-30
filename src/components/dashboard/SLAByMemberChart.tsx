import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSLAMetrics } from "@/hooks/useSLAMetrics";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function SLAByMemberChart() {
  const { slaByMember, isLoading } = useSLAMetrics();

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const getStatusIcon = (avgSeconds: number) => {
    if (avgSeconds <= 300) return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (avgSeconds <= 900) return <Clock className="h-4 w-4 text-amber-500" />;
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  };

  const getProgressColor = (avgSeconds: number) => {
    if (avgSeconds <= 300) return "bg-emerald-500";
    if (avgSeconds <= 900) return "bg-amber-500";
    return "bg-destructive";
  };

  // Sort by average response time (faster first)
  const sortedMembers = [...(slaByMember || [])].sort(
    (a, b) => a.avg_first_response_seconds - b.avg_first_response_seconds
  );

  // Max time for progress bar scaling (30 minutes = 1800 seconds)
  const maxTime = 1800;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          SLA por Atendente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sortedMembers.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Nenhum membro encontrado
          </p>
        ) : (
          <div className="space-y-4">
            {sortedMembers.map((member) => {
              const progressValue = Math.min(
                (member.avg_first_response_seconds / maxTime) * 100,
                100
              );

              return (
                <div key={member.user_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate max-w-[150px]">
                        {member.name}
                      </span>
                      {getStatusIcon(member.avg_first_response_seconds)}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatTime(member.avg_first_response_seconds)} avg
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(
                        member.avg_first_response_seconds
                      )}`}
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{member.conversations_responded} respondidas</span>
                    {member.sla_breached_15min > 0 && (
                      <span className="text-amber-500">
                        {member.sla_breached_15min} {">"}15min
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
