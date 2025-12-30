import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSLAMetrics } from "@/hooks/useSLAMetrics";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";

export function DealsWithoutActionList() {
  const { dealsWithoutAction, isLoading } = useSLAMetrics();
  const navigate = useNavigate();

  const getUrgencyColor = (days: number) => {
    if (days >= 3) return "bg-destructive text-destructive-foreground";
    if (days >= 1) return "bg-amber-500 text-white";
    return "bg-muted text-muted-foreground";
  };

  const handleClick = () => {
    navigate("/funnels");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5" />
          Deals sem Próxima Ação
          {dealsWithoutAction && dealsWithoutAction.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {dealsWithoutAction.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !dealsWithoutAction || dealsWithoutAction.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Todos os deals têm próxima ação</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="divide-y">
              {dealsWithoutAction.map((deal) => (
                <div
                  key={deal.id}
                  onClick={handleClick}
                  className="p-4 hover:bg-muted/50 cursor-pointer transition-colors border-l-4 border-l-destructive"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="font-medium truncate">
                          {deal.title || deal.contact_name || deal.contact_phone}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {deal.funnel_name} → {deal.stage_name}
                      </p>
                    </div>
                    <Badge className={getUrgencyColor(deal.days_without_action)}>
                      {deal.days_without_action}d
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
