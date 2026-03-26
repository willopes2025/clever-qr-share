import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { WebhookLog } from "@/hooks/useWebhookConnections";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, ScrollText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  logs: WebhookLog[];
}

export function WebhookLogsTable({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Nenhum log registrado</p>
        <p className="text-sm text-muted-foreground mt-1">Os logs aparecerão aqui quando o webhook for usado</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Direção</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Erro</TableHead>
            <TableHead className="text-right">Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map(log => (
            <TableRow key={log.id}>
              <TableCell className="text-xs">
                {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {log.direction === 'in' ? '⬇ Entrada' : '⬆ Saída'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm font-mono">{log.action || '-'}</TableCell>
              <TableCell>
                <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                  {log.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                {log.error_message || '-'}
              </TableCell>
              <TableCell className="text-right">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Detalhes do Log</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-1">Request Payload</p>
                          <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto">
                            {JSON.stringify(log.request_payload, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Response Payload</p>
                          <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto">
                            {JSON.stringify(log.response_payload, null, 2)}
                          </pre>
                        </div>
                        {log.error_message && (
                          <div>
                            <p className="text-sm font-medium mb-1 text-destructive">Erro</p>
                            <p className="text-sm text-destructive">{log.error_message}</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
