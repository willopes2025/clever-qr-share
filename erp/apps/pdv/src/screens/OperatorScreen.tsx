import { usePos } from '../store/pos-store';

/**
 * Troca de atendente. O terminal já está autenticado; aqui só se identifica quem
 * está no caixa — por isso é rápido e funciona offline.
 */
export function OperatorScreen() {
  const { bootstrap, selectOperator } = usePos();
  const operators = bootstrap?.operators ?? [];

  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="mb-1 text-center font-display text-2xl font-bold text-indigo">Quem está no caixa?</h1>
        <p className="mb-6 text-center text-sm text-slate">Toque no seu nome para começar o turno.</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {operators.map((operator) => (
            <button
              key={operator.id}
              onClick={() => selectOperator(operator)}
              className="card flex items-center gap-3 p-4 text-left transition hover:border-violet"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-lavender-200 font-display font-bold text-violet">
                {initials(operator.name)}
              </span>
              <span className="font-display font-semibold text-indigo">{operator.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
