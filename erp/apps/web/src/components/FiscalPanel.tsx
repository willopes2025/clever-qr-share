const LABELS: Record<string, string> = {
  authorized: 'autorizadas',
  queued: 'na fila',
  sending: 'enviando',
  rejected: 'rejeitadas',
  cancelled: 'canceladas',
  contingency: 'contingência',
};

const TONES: Record<string, string> = {
  authorized: 'text-success',
  queued: 'text-slate',
  sending: 'text-slate',
  rejected: 'text-danger',
  cancelled: 'text-slate',
  contingency: 'text-warning',
};

/** Situação fiscal do dia: o que autorizou e, principalmente, o que travou. */
export function FiscalPanel({ summary }: { summary: Record<string, number> }) {
  const entries = Object.entries(summary).filter(([, count]) => count > 0);

  return (
    <section className="card p-5">
      <h2 className="mb-1 font-display text-base font-semibold text-indigo">Notas fiscais</h2>
      <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-slate">emissão via gateway</p>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-soft">Nenhum documento emitido ainda.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3">
          {entries.map(([status, count]) => (
            <div key={status} className="rounded-xl bg-lavender p-3">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-slate">
                {LABELS[status] ?? status}
              </dt>
              <dd className={`font-display text-2xl font-bold tabular-nums ${TONES[status] ?? 'text-indigo'}`}>
                {count}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
