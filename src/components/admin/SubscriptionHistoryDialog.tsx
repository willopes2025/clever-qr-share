import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight } from "lucide-react";
import { invokeAdminFunction } from "@/lib/supabase-functions";

interface HistoryEntry {
  id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  changed_by_email: string;
}

interface SubscriptionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string | null;
}

export const SubscriptionHistoryDialog = ({
  open,
  onOpenChange,
  subscriptionId
}: SubscriptionHistoryDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (open && subscriptionId) {
      fetchHistory();
    }
  }, [open, subscriptionId]);

  const fetchHistory = async () => {
    if (!subscriptionId) return;

    setLoading(true);
    try {
      const { data, error } = await invokeAdminFunction<{ history: HistoryEntry[] }>(
        'admin-update-subscription',
        { body: { action: 'get_history', subscriptionId } }
      );

      if (error) throw error;
      setHistory(data?.history || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderChange = (key: string, oldVal: unknown, newVal: unknown) => {
    if (oldVal === newVal) return null;
    
    const formatValue = (val: unknown) => {
      if (val === null || val === undefined) return '-';
      if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
      return String(val);
    };

    return (
      <div key={key} className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
        <span className="text-red-400 line-through">{formatValue(oldVal)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-green-400">{formatValue(newVal)}</span>
      </div>
    );
  };

  const getChanges = (entry: HistoryEntry) => {
    const oldVals = entry.old_values || {};
    const newVals = entry.new_values || {};
    const allKeys = new Set([...Object.keys(oldVals), ...Object.keys(newVals)]);
    
    // Filtrar campos irrelevantes
    const relevantKeys = ['plan', 'status', 'max_instances', 'max_messages', 'max_contacts', 'current_period_end'];
    
    return Array.from(allKeys)
      .filter(key => relevantKeys.includes(key))
      .map(key => renderChange(key, oldVals[key], newVals[key]))
      .filter(Boolean);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] glass-card max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Histórico de Alterações</DialogTitle>
          <DialogDescription>
            Todas as alterações feitas nesta assinatura
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum histórico encontrado
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-lg bg-muted/30 border border-border space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize">
                      {entry.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {getChanges(entry)}
                  </div>

                  {entry.notes && (
                    <p className="text-sm text-muted-foreground italic border-t border-border pt-2 mt-2">
                      "{entry.notes}"
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Por: {entry.changed_by_email}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
