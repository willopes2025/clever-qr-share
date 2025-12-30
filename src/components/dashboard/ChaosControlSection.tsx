import { AlertTriangle, Clock, CheckCircle2, Users, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSLAMetrics } from "@/hooks/useSLAMetrics";
import { Skeleton } from "@/components/ui/skeleton";

export function ChaosControlSection() {
  const { summary, isLoading } = useSLAMetrics();

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const cards = [
    {
      label: "Sem Próxima Ação",
      value: summary.dealsWithoutAction,
      icon: Target,
      color: summary.dealsWithoutAction > 0 ? "text-destructive" : "text-muted-foreground",
      bgColor: summary.dealsWithoutAction > 0 ? "bg-destructive/10" : "bg-muted",
    },
    {
      label: "Sem Resposta >15min",
      value: summary.unrespondedOver15min,
      icon: Clock,
      color: summary.unrespondedOver15min > 0 ? "text-amber-500" : "text-muted-foreground",
      bgColor: summary.unrespondedOver15min > 0 ? "bg-amber-500/10" : "bg-muted",
    },
    {
      label: "SLA Crítico (>24h)",
      value: summary.unrespondedOver24h,
      icon: AlertTriangle,
      color: summary.unrespondedOver24h > 0 ? "text-destructive" : "text-muted-foreground",
      bgColor: summary.unrespondedOver24h > 0 ? "bg-destructive/10" : "bg-muted",
    },
    {
      label: "Tempo Médio 1ª Resp.",
      value: formatTime(summary.avgFirstResponse),
      icon: CheckCircle2,
      color: summary.avgFirstResponse > 900 ? "text-amber-500" : "text-emerald-500",
      bgColor: summary.avgFirstResponse > 900 ? "bg-amber-500/10" : "bg-emerald-500/10",
      isTime: true,
    },
  ];

  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Controle do Caos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className={`p-4 rounded-lg ${card.bgColor} flex flex-col items-center justify-center text-center`}
            >
              <card.icon className={`h-6 w-6 mb-2 ${card.color}`} />
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <span className={`text-2xl font-bold ${card.color}`}>
                  {card.value}
                </span>
              )}
              <span className="text-xs text-muted-foreground mt-1">
                {card.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
