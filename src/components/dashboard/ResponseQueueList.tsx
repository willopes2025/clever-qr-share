import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSLAMetrics } from "@/hooks/useSLAMetrics";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, AlertTriangle, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export function ResponseQueueList() {
  const { unrespondedConversations, isLoading } = useSLAMetrics();
  const navigate = useNavigate();

  const getUrgencyStyles = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return {
          border: "border-l-destructive",
          badge: "bg-destructive text-destructive-foreground",
          icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
        };
      case "alert":
        return {
          border: "border-l-amber-500",
          badge: "bg-amber-500 text-white",
          icon: <Clock className="h-4 w-4 text-amber-500" />,
        };
      case "attention":
        return {
          border: "border-l-orange-500",
          badge: "bg-orange-500 text-white",
          icon: <Clock className="h-4 w-4 text-orange-500" />,
        };
      default:
        return {
          border: "border-l-emerald-500",
          badge: "bg-emerald-500 text-white",
          icon: <Clock className="h-4 w-4 text-emerald-500" />,
        };
    }
  };

  const formatWaitingTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return `${Math.floor(minutes / 1440)}d`;
  };

  const handleClick = (conversationId: string) => {
    navigate(`/inbox?conversation=${conversationId}`);
  };

  // Only show conversations that need attention
  const filteredConversations = unrespondedConversations?.filter(
    (c) => c.urgency !== "ok"
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Fila de Espera
          {filteredConversations && filteredConversations.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {filteredConversations.length}
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
        ) : !filteredConversations || filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma conversa pendente</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="divide-y">
              {filteredConversations.map((conv) => {
                const styles = getUrgencyStyles(conv.urgency);

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleClick(conv.id)}
                    className={`p-4 border-l-4 ${styles.border} hover:bg-muted/50 cursor-pointer transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {styles.icon}
                          <span className="font-medium truncate">
                            {conv.contact_name || conv.contact_phone}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {conv.last_message_preview || "Sem prévia"}
                        </p>
                        {conv.assignee_name && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {conv.assignee_name}
                          </div>
                        )}
                      </div>
                      <Badge className={styles.badge}>
                        {formatWaitingTime(conv.minutes_waiting)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
