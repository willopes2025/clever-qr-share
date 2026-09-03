import { useEffect } from 'react';
import { usePos } from '../store/pos-store';

/**
 * As duas saídas do PDV, que não são a mesma coisa.
 *
 * Trocar de operador é rotina: acontece toda troca de turno e não mexe no caixa
 * nem na fila. Desconectar o terminal é raro e destrutivo — o computador volta a
 * pedir código de ativação e a fila local vai junto.
 *
 * Ficam na mesma tela porque é onde o operador procura, mas com pesos bem
 * diferentes: uma é botão, a outra é letra miúda com confirmação.
 */
export function ExitDialog({ onClose }: { onClose: () => void }) {
  const { operator, cart, pendingCount, quarantinedCount, signOutOperator, unpairTerminal } = usePos();
  const emVenda = cart.length > 0;
  const naFila = pendingCount + quarantinedCount;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-indigo/70 p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-lifted" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold text-indigo">Sair do caixa</h2>
        <p className="mt-1 text-sm text-slate">
          {operator?.name} está no terminal. O caixa continua aberto para quem assumir.
        </p>

        {emVenda && (
          <p className="mt-4 rounded-card bg-pink/10 px-3 py-2 text-sm text-magenta">
            Há uma venda em andamento com {cart.length} item(ns). Ela será descartada — venda pela
            metade não muda de operador.
          </p>
        )}

        <button
          className="btn-primary mt-5 w-full"
          onClick={() => {
            signOutOperator();
            onClose();
          }}
        >
          Trocar de operador
        </button>

        <button className="mt-3 w-full text-xs text-slate hover:text-indigo" onClick={onClose}>
          Voltar à venda (ESC)
        </button>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-soft">
            Desconectar este terminal apaga a ativação desta máquina: ela volta a pedir o código da
            retaguarda.
            {naFila > 0 && (
              <strong className="text-magenta">
                {' '}
                Há {naFila} venda(s) na fila local que se perderiam.
              </strong>
            )}
          </p>
          <button
            className="mt-2 font-mono text-[11px] uppercase tracking-widest text-slate hover:text-danger"
            onClick={() => {
              const aviso =
                naFila > 0
                  ? `Ainda há ${naFila} venda(s) que não subiram. Desconectar agora perde essas vendas. Continuar?`
                  : 'Desconectar este terminal? Ele voltará a pedir o código de ativação.';
              if (!window.confirm(aviso)) return;
              void unpairTerminal();
              onClose();
            }}
          >
            desconectar este terminal
          </button>
        </div>
      </div>
    </div>
  );
}
