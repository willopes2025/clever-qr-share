import { useEffect, useState } from 'react';
import { formatMoney } from '@soul/ui';
import type { OperationFeed } from '../lib/use-operation-feed';

/** Quanto tempo o aviso da última venda fica na tela antes de sumir sozinho. */
const FLASH_MS = 12_000;

/**
 * Diz se o painel está mesmo ao vivo.
 *
 * Sem isso, painel parado e painel desconectado são a mesma imagem — e a
 * primeira dúvida de quem olha é justamente essa: "será que travou, ou é que
 * não vendeu nada?".
 */
export function LiveIndicator({ feed }: { feed: OperationFeed }) {
  const [flash, setFlash] = useState<OperationFeed['lastSale']>(null);

  useEffect(() => {
    if (!feed.lastSale) return;
    setFlash(feed.lastSale);
    const timer = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [feed.lastSale?.saleId]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate shadow-sm">
        <span
          className={`h-2 w-2 rounded-full ${feed.connected ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`}
          aria-hidden
        />
        {feed.connected ? 'ao vivo' : 'reconectando'}
      </span>

      {flash && (
        <span className="animate-pulse rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet">
          venda registrada agora · {formatMoney(flash.totalCents)}
        </span>
      )}
    </div>
  );
}
