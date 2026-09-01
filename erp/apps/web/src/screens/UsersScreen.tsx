import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatRelative } from '@soul/ui';
import { api, ApiError, type AppUser, type Store } from '../lib/api';
import { EmptyState, ErrorNote, Field, Modal, PageHeader, Pill } from '../components/ui';

/**
 * Usuários da rede.
 *
 * Quem entra na retaguarda tem e-mail e senha; quem opera o caixa tem PIN. O
 * mesmo cadastro atende os dois — muda a credencial que existe.
 */
export function UsersScreen() {
  const [editing, setEditing] = useState<AppUser | 'new' | null>(null);
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<AppUser[]>('/users') });

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Retaguarda entra por e-mail e senha; o caixa entra por PIN."
        action={
          <button className="btn-primary" onClick={() => setEditing('new')}>
            Novo usuário
          </button>
        }
      />

      {users.data?.length === 0 ? (
        <EmptyState message="Nenhum usuário cadastrado." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-lavender text-left font-mono text-[10px] uppercase tracking-widest text-slate">
              <tr>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Papel</th>
                <th className="px-5 py-3">Acesso</th>
                <th className="px-5 py-3">Último login</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.data?.map((user) => (
                <tr key={user.id} className="border-t border-lavender-200">
                  <td className="px-5 py-3">
                    <span className="font-display font-semibold text-indigo">{user.name}</span>
                    {user.email && <span className="block font-mono text-[11px] text-slate">{user.email}</span>}
                  </td>
                  <td className="px-5 py-3 text-indigo">{user.roles[0]?.name ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className="flex flex-wrap gap-1">
                      {user.hasPassword && <Pill tone="ok">retaguarda</Pill>}
                      {user.hasPin && <Pill tone="ok">caixa</Pill>}
                      {user.status !== 'active' && <Pill tone="off">inativo</Pill>}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate">{formatRelative(user.lastLoginAt)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      className="font-mono text-[10px] uppercase tracking-widest text-slate hover:text-violet"
                      onClick={() => setEditing(user)}
                    >
                      editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <UserForm user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function UserForm({ user, onClose }: { user: AppUser | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [roleCode, setRoleCode] = useState(user?.roles[0]?.code ?? 'caixa');
  const [storeId, setStoreId] = useState(user?.roles[0]?.storeId ?? '');
  const [status, setStatus] = useState(user?.status ?? 'active');

  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<Array<{ code: string; name: string }>>('/users/roles'),
  });
  const stores = useQuery({ queryKey: ['stores'], queryFn: () => api<Store[]>('/stores') });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        email: email.trim() || null,
        password: password || null,
        pin: pin || null,
        roleCode,
        storeId: storeId || null,
        status,
      };
      return user ? api(`/users/${user.id}`, { method: 'PUT', body }) : api('/users', { method: 'POST', body });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  const credentialMissing = !user && !email.trim() && !pin;

  return (
    <Modal
      title={user ? `Editar ${user.name}` : 'Novo usuário'}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={name.trim().length < 2 || credentialMissing || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nome">
            <input className="field" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>
        </div>

        <Field label="Papel">
          <select className="field" value={roleCode} onChange={(event) => setRoleCode(event.target.value)}>
            {roles.data?.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Loja" hint="em branco vale para todas">
          <select className="field" value={storeId} onChange={(event) => setStoreId(event.target.value)}>
            <option value="">todas as lojas</option>
            {stores.data?.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="E-mail" hint="só para quem entra na retaguarda">
          <input
            className="field"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="opcional"
          />
        </Field>

        <Field label="Senha" hint={user ? 'em branco mantém a atual' : 'mínimo 8 caracteres'}>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Field label="PIN do caixa" hint={user ? 'em branco mantém o atual' : '4 a 6 dígitos'}>
          <input
            className="field font-mono"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="1234"
          />
        </Field>

        {user && (
          <Field label="Situação">
            <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="active">ativo</option>
              <option value="inactive">inativo</option>
            </select>
          </Field>
        )}
      </div>

      {credentialMissing && (
        <p className="mt-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
          Informe e-mail (retaguarda) ou PIN (caixa) — sem uma das duas coisas o usuário não entra em lugar nenhum.
        </p>
      )}

      {save.isError && (
        <div className="mt-4">
          <ErrorNote>
            {save.error instanceof ApiError && save.error.code === 'EMAIL_IN_USE'
              ? 'Já existe um usuário com esse e-mail.'
              : save.error instanceof ApiError
                ? save.error.message
                : 'Não foi possível salvar.'}
          </ErrorNote>
        </div>
      )}
    </Modal>
  );
}
