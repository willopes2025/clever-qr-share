import type { ReactNode } from 'react';

/** Peças de interface da retaguarda, para as telas não repetirem estilo. */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-indigo">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : (
        hint && <span className="mt-1 block font-mono text-[11px] text-slate">{hint}</span>
      )}
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-indigo/60 p-4 backdrop-blur-sm">
      <div className={`w-full rounded-card bg-white shadow-lifted ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-lavender-200 px-6 py-4">
          <h2 className="font-display text-lg font-bold text-indigo">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-pill px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-slate hover:bg-lavender"
          >
            fechar
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-lavender-200 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="card grid place-items-center gap-3 p-12 text-center">
      <p className="text-sm text-slate-soft">{message}</p>
      {action}
    </div>
  );
}

export function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'off'; children: ReactNode }) {
  const tones = {
    ok: 'bg-success-soft text-success',
    warn: 'bg-warning-soft text-warning',
    off: 'bg-lavender-200 text-slate',
  } as const;
  return (
    <span className={`rounded-pill px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{children}</p>;
}
