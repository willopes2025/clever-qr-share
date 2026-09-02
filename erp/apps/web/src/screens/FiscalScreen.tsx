import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { EmptyState, ErrorNote, Field, Modal, PageHeader, Pill } from '../components/ui';

interface FiscalDocument {
  id: string;
  store: string;
  status: string;
  number: number | null;
  accessKey: string | null;
  rejection: { code: string; message: string } | null;
  attempts: number;
  createdAt: string;
  authorizedAt: string | null;
}

const REFRESH_MS = 15_000;

const STATUS_LABEL: Record<string, string> = {
  queued: 'na fila',
  sending: 'enviando',
  authorized: 'autorizada',
  rejected: 'rejeitada',
  cancelled: 'cancelada',
  denied: 'denegada',
  contingency: 'contingência',
};

const FILTERS = [
  { value: 'rejected', label: 'Precisam de correção' },
  { value: 'queued', label: 'Na fila' },
  { value: 'authorized', label: 'Autorizadas' },
  { value: '', label: 'Todas' },
];

/**
 * Fila de correção.
 *
 * A nota rejeitada não volta sozinha: quase sempre é cadastro errado — NCM,
 * CEST, CSOSN — e alguém precisa arrumar o produto antes de mandar de novo.
 * Esta tela é o lugar onde isso aparece, e é a primeira que se abre quando o
 * contador liga perguntando de uma venda sem nota.
 */
export function FiscalScreen() {
  const [status, setStatus] = useState('rejected');
  const [cancelling, setCancelling] = useState<FiscalDocument | null>(null);
  const queryClient = useQueryClient();

  const documents = useQuery({
    queryKey: ['fiscal-documents', status],
    queryFn: () => api<FiscalDocument[]>(`/fiscal/documents?status=${status}`),
    refetchInterval: REFRESH_MS,
  });

  const retry = useMutation({
    mutationFn: (id: string) => api(`/fiscal/documents/${id}/retry`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fiscal-documents'] }),
  });

  const pendentes = useMemo(
    () => (documents.data ?? []).filter((document) => document.status === 'rejected').length,
    [documents.data],
  );

  return (
    <>
      <PageHeader
        title="Fiscal"
        subtitle={
          status === 'rejected' && pendentes > 0
            ? `${pendentes} ${pendentes === 1 ? 'nota parada' : 'notas paradas'} esperando correção de cadastro.`
            : 'Notas emitidas, na fila e as que pararam por erro de cadastro.'
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatus(filter.value)}
            className={`rounded-pill px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors duration-150 ${
              status === filter.value ? 'bg-violet text-white' : 'bg-white text-indigo hover:bg-lavender-100'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {retry.error && <ErrorNote>{describe(retry.error)}</ErrorNote>}

      {documents.data?.length === 0 ? (
        <EmptyState
          message={
            status === 'rejected'
              ? 'Nenhuma nota parada. Está tudo autorizado ou a caminho.'
              : 'Nenhuma nota neste estado.'
          }
        />
      ) : (
        <div className="space-y-3">
          {documents.data?.map((document) => (
            <article key={document.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-base font-semibold text-indigo">
                    {document.number ? `NFC-e nº ${document.number}` : 'NFC-e sem número'}
                    <span className="ml-2 font-mono text-[11px] uppercase tracking-widest text-slate">
                      {document.store}
                    </span>
                  </h2>
                  <p className="font-mono text-[11px] text-slate">
                    {document.accessKey ?? 'sem chave de acesso'}
                  </p>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-slate">
                    {new Date(document.createdAt).toLocaleString('pt-BR')}
                    {document.attempts > 0 && ` · ${document.attempts} tentativas`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={toneFor(document.status)}>{STATUS_LABEL[document.status] ?? document.status}</Pill>
                  {(document.status === 'rejected' || document.status === 'denied') && (
                    <button
                      className="btn-ghost px-4 py-2 text-xs"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(document.id)}
                    >
                      Reenviar
                    </button>
                  )}
                  {document.status === 'authorized' && (
                    <button
                      className="btn-ghost px-4 py-2 text-xs"
                      onClick={() => setCancelling(document)}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {document.rejection && (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  <span className="font-mono text-[11px] uppercase tracking-widest">
                    rejeição {document.rejection.code}
                  </span>
                  <p className="mt-1">{document.rejection.message}</p>
                  <p className="mt-2 text-xs text-amber-800">
                    Corrija o cadastro do produto antes de reenviar — a mesma nota volta a ser recusada
                    enquanto o dado estiver errado.
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {cancelling && (
        <CancelDialog document={cancelling} onClose={() => setCancelling(null)} />
      )}
    </>
  );
}

/**
 * A SEFAZ dá 30 minutos para cancelar uma NFC-e e exige justificativa de pelo
 * menos 15 caracteres — o texto fica no evento e o contador vai lê-lo.
 */
function CancelDialog({ document, onClose }: { document: FiscalDocument; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const cancel = useMutation({
    mutationFn: () =>
      api(`/fiscal/documents/${document.id}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fiscal-documents'] });
      onClose();
    },
  });

  const minutosDesdeAutorizacao = document.authorizedAt
    ? Math.floor((Date.now() - new Date(document.authorizedAt).getTime()) / 60_000)
    : null;
  const foraDoPrazo = minutosDesdeAutorizacao !== null && minutosDesdeAutorizacao > 30;

  return (
    <Modal
      title={`Cancelar NFC-e nº ${document.number ?? '—'}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Voltar
          </button>
          <button
            className="btn-primary"
            disabled={reason.trim().length < 15 || cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            {cancel.isPending ? 'Cancelando...' : 'Cancelar nota'}
          </button>
        </>
      }
    >
      {foraDoPrazo && (
        <ErrorNote>
          Esta nota foi autorizada há {minutosDesdeAutorizacao} minutos. A SEFAZ aceita cancelamento
          de NFC-e em até 30 minutos — provavelmente será recusado, e o caminho passa a ser a
          devolução.
        </ErrorNote>
      )}
      {cancel.error && <ErrorNote>{describe(cancel.error)}</ErrorNote>}

      <Field label="Justificativa" hint="mínimo de 15 caracteres, vai no evento enviado à SEFAZ">
        <textarea
          className="field h-24"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Venda cancelada a pedido do cliente"
          autoFocus
        />
      </Field>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-slate">
        {reason.trim().length}/15 caracteres
      </p>
    </Modal>
  );
}

function toneFor(status: string): 'ok' | 'warn' | 'off' {
  if (status === 'authorized') return 'ok';
  if (status === 'rejected' || status === 'denied') return 'warn';
  return 'off';
}

function describe(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.';
}
