import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { WarmingActivity } from "@/hooks/useWarming";

interface WarmingActivitiesLogProps {
  activities: WarmingActivity[];
}

const ACTIVITY_LABELS: Record<string, string> = {
  send_text: 'Texto enviado',
  send_image: 'Imagem enviada',
  send_audio: 'Áudio enviado',
  send_video: 'Vídeo enviado',
  send_sticker: 'Sticker enviado',
  receive_message: 'Mensagem recebida',
};

export function WarmingActivitiesLog({ activities }: WarmingActivitiesLogProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Atividades Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma atividade registrada ainda.
          </p>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {activities.slice(0, 50).map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  {activity.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {ACTIVITY_LABELS[activity.activity_type] || activity.activity_type}
                      </Badge>
                      {activity.contact_phone && (
                        <span className="text-xs text-muted-foreground">
                          para {activity.contact_phone}
                        </span>
                      )}
                    </div>
                    {activity.content_preview && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {activity.content_preview}
                      </p>
                    )}
                    {activity.error_message && (
                      <p className="text-xs text-destructive mt-1">
                        {activity.error_message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.created_at).toLocaleString('pt-BR')}
                    </p>
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
