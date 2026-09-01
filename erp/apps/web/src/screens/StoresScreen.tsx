import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatRelative } from '@soul/ui';
import { api, ApiError, type Store } from '../lib/api';
import { EmptyState, ErrorNote, Field, Modal, PageHeader, Pill } from '../components/ui';

/**
 * Lojas e terminais.
 *
 * É aqui que se abre um quiosque novo: cria a loja, cria o terminal e recebe o
 * código de ativação que será digitado no PDV. O código aparece **uma vez**.
 */
export function StoresScreen() {
  const [creatingStore, setCreatingStore] = useState(false);
  const [terminalFor, setTerminalFor] = useState<Store | null>(null);
  const [activation, setActivation] = useState<{ store: string; code: string; terminal: string } | null>(null);

  const stores = useQuery({ queryKey: ['stores'], queryFn: () => api<Store[]>('/stores') });

  return (
    <>
      <PageHeader
        title="Lojas e terminais"
        subtitle="Cada terminal tem série fiscal própria e um código de ativação para parear o PDV."
        action={
          <button className="btn-primary" onClick={() => setCreatingStore(true)}>
            Nova loja
          </button>
        }
      />

      {stores.data?.length === 0 ? (
        <EmptyState message="Nenhuma loja cadastrada." />
      ) : (
        <div className="space-y-3">
          {stores.data?.map((store) => (
            <article key={store.id} className="card p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-indigo">
                    {store.name} <span className="font-mono text-xs text-slate">{store.code}</span>
                  </h2>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-slate">
                    {store.kind} · {store.opensAt ?? '—'} às {store.closesAt ?? '—'} · {store.salesCount} vendas
                  </p>
                </div>
                <button className="btn-ghost px-4 py-2 text-xs" onClick={() => setTerminalFor(store)}>
                  Novo terminal
                </button>
              </div>

              {store.terminals.length === 0 ? (
                <p className="text-sm text-slate-soft">Nenhum terminal — crie um para pôr o caixa no ar.</p>
              ) : (
                <ul className="divide-y divide-lavender-200 rounded-xl border border-lavender-200">
                  {store.terminals.map((terminal) => (
                    <li key={terminal.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="font-display text-sm font-semibold text-indigo">{terminal.code}</span>
                      <span className="font-mono text-[11px] text-slate">série {terminal.fiscalSeries}</span>
                      {terminal.paired ? (
                        <Pill tone="ok">pareado · visto {formatRelative(terminal.lastSeenAt)}</Pill>
                      ) : (
                        <Pill tone="warn">aguardando ativação</Pill>
                      )}
                      {terminal.status !== 'active' && <Pill tone="off">desativado</Pill>}
                      <RegenerateButton
                        terminalId={terminal.id}
                        onDone={(code) =>
                          setActivation({ store: store.name, terminal: terminal.code, code })
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}

      {creatingStore && <StoreForm onClose={() => setCreatingStore(false)} />}
      {terminalFor && (
        <TerminalForm
          store={terminalFor}
          onClose={() => setTerminalFor(null)}
          onCreated={(terminal, code) =>
            setActivation({ store: terminalFor.name, terminal, code })
          }
        />
      )}
      {activation && <ActivationCode {...activation} onClose={() => setActivation(null)} />}
    </>
  );
}

function RegenerateButton({ terminalId, onDone }: { terminalId: string; onDone: (code: string) => void }) {
  const queryClient = useQueryClient();
  const regenerate = useMutation({
    mutationFn: () => api<{ activationCode: string }>(`/stores/terminals/${terminalId}/activation`, { method: 'POST' }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      onDone(result.activationCode);
    },
  });

  return (
    <button
      className="ml-auto font-mono text-[10px] uppercase tracking-widest text-slate hover:text-violet"
      onClick={() => regenerate.mutate()}
      disabled={regenerate.isPending}
    >
      {regenerate.isPending ? 'gerando...' : 'novo código'}
    </button>
  );
}

function StoreForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [opensAt, setOpensAt] = useState('10:00');
  const [closesAt, setClosesAt] = useState('22:00');

  const save = useMutation({
    mutationFn: () => api('/stores', { method: 'POST', body: { code, name, kind: 'kiosk', opensAt, closesAt } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      onClose();
    },
  });

  return (
    <Modal
      title="Nova loja"
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!code.trim() || name.trim().length < 2 || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Salvando...' : 'Criar loja'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Código" hint="curto, aparece no PDV">
          <input
            className="field font-mono uppercase"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Q04"
            autoFocus
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Nome">
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Quiosque Shopping Leste"
            />
          </Field>
        </div>
        <Field label="Abre às">
          <input className="field font-mono" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} />
        </Field>
        <Field label="Fecha às" hint="alimenta o alerta de caixa fora de horário">
          <input className="field font-mono" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} />
        </Field>
      </div>

      {save.isError && (
        <div className="mt-4">
          <ErrorNote>
            {save.error instanceof ApiError && save.error.code === 'STORE_CODE_IN_USE'
              ? 'Já existe uma loja com esse código.'
              : 'Não foi possível criar a loja.'}
          </ErrorNote>
        </div>
      )}
    </Modal>
  );
}

function TerminalForm({
  store,
  onClose,
  onCreated,
}: {
  store: Store;
  onClose: () => void;
  onCreated: (terminal: string, code: string) => void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(`PDV${store.terminals.length + 1}`);

  const save = useMutation({
    mutationFn: () =>
      api<{ code: string; activationCode: string }>(`/stores/${store.id}/terminals`, {
        method: 'POST',
        body: { code },
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      onClose();
      onCreated(result.code, result.activationCode);
    },
  });

  return (
    <Modal
      title={`Novo terminal em ${store.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!code.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Criando...' : 'Criar e gerar código'}
          </button>
        </>
      }
    >
      <Field label="Código do terminal" hint="a série fiscal é atribuída automaticamente">
        <input
          className="field font-mono uppercase"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          autoFocus
        />
      </Field>

      {save.isError && (
        <div className="mt-4">
          <ErrorNote>
            {save.error instanceof ApiError && save.error.code === 'PLAN_LIMIT_REACHED'
              ? 'O plano contratado não permite mais terminais.'
              : 'Não foi possível criar o terminal.'}
          </ErrorNote>
        </div>
      )}
    </Modal>
  );
}

/** O código aparece uma única vez — depois disso, só gerando outro. */
function ActivationCode({
  store,
  terminal,
  code,
  onClose,
}: {
  store: string;
  terminal: string;
  code: string;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Código de ativação"
      onClose={onClose}
      footer={
        <button className="btn-primary" onClick={onClose}>
          Já anotei
        </button>
      }
    >
      <p className="mb-4 text-sm text-slate">
        Digite este código no PDV do terminal <strong className="text-indigo">{terminal}</strong> em {store}. Ele
        aparece só desta vez — se precisar de novo, gere outro.
      </p>
      <p className="select-all rounded-xl bg-lavender px-4 py-5 text-center font-mono text-xl font-semibold tracking-wider text-violet">
        {code}
      </p>
    </Modal>
  );
}
