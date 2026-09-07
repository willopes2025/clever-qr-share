import { usePos } from '../store/pos-store';
import { ALARME_MINUTOS, formatarEspera, minutosDeEspera } from '../lib/espera';

/**
 * A faixa que aparece quando a fila deixa de ser contratempo.
 *
 * O selo discreto da barra de estado está certo para a rede que pisca: ninguém
 * no balcão precisa se assustar a cada oscilação. Ele está errado para o
 * quiosque que passou o dia inteiro sem conexão, porque cinco minutos e dois
 * dias têm exatamente a mesma aparência lá em cima — e foi assim que um
 * terminal vendeu dois dias seguidos sem emitir nota nenhuma, sem ninguém
 * perceber, até as notas já estarem velhas demais para a SEFAZ aceitar.
 *
 * Não bloqueia a venda, nunca. O quiosque continua vendendo — a diferença é que
 * agora alguém sabe, enquanto ainda dá para fazer algo a respeito.
 */
export function SyncWarning() {
  const { pendingCount, oldestPendingAt } = usePos();
  if (pendingCount === 0 || !oldestPendingAt) return null;

  const minutos = minutosDeEspera(oldestPendingAt);
  if (minutos < ALARME_MINUTOS) return null;

  return (
    <div className="bg-red-600 px-5 py-3 text-white" role="alert">
      <p className="font-display text-sm font-semibold">
        {pendingCount} venda{pendingCount > 1 ? 's' : ''} sem chegar ao sistema há{' '}
        {formatarEspera(minutos)}.
      </p>
      <p className="mt-0.5 text-xs text-white/90">
        Venda que demora muito para subir perde o prazo de emitir nota fiscal. Chame quem cuida da
        internet do quiosque — o caixa pode continuar vendendo normalmente.
      </p>
    </div>
  );
}
