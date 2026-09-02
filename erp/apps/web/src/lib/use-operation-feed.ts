import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { listenToOperation, type RealtimeMessage } from './realtime';

/** O que cada evento manda recarregar. */
const AFFECTED: Record<string, string[]> = {
  'sale.finalized': ['live', 'hourly', 'mix', 'terminals'],
  'cash.session.closed': ['live', 'terminals'],
  'fiscal.document.authorized': ['fiscal', 'fiscal-documents'],
  'fiscal.document.rejected': ['fiscal', 'fiscal-documents'],
  'fiscal.document.cancelled': ['fiscal', 'fiscal-documents'],
};

export interface OperationFeed {
  connected: boolean;
  /** Última venda recebida, para o painel piscar o número que acabou de mudar. */
  lastSale: { saleId: string; storeId: string; totalCents: number; at: string } | null;
}

/**
 * Liga o painel ao fluxo da operação.
 *
 * Vendeu, o painel recarrega o que aquele evento afeta — não tudo, e não daqui
 * a trinta segundos.
 */
export function useOperationFeed(): OperationFeed {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [lastSale, setLastSale] = useState<OperationFeed['lastSale']>(null);
  // A referência evita reassinar o fluxo a cada render do painel.
  const client = useRef(queryClient);
  client.current = queryClient;

  useEffect(() => {
    const handle = (message: RealtimeMessage) => {
      if (message.event === 'sale.finalized' && message.data?.saleId) {
        setLastSale({
          saleId: String(message.data.saleId),
          storeId: String(message.data.storeId ?? ''),
          totalCents: Number(message.data.totalCents ?? 0),
          at: message.at ?? new Date().toISOString(),
        });
      }

      for (const key of AFFECTED[message.event] ?? []) {
        void client.current.invalidateQueries({ queryKey: [key] });
      }
    };

    return listenToOperation(handle, setConnected);
  }, []);

  return { connected, lastSale };
}
