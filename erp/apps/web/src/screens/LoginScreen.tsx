import { useState } from 'react';
import { api, session } from '../lib/api';
import { SoulLogo } from '../components/SoulLogo';

export function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('will@soulmuscle.com.br');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      session.write(result.accessToken);
      onSignedIn();
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-indigo p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-card bg-white p-8 shadow-lifted">
        <SoulLogo className="mb-6 h-10 text-violet" />
        <h1 className="mb-6 font-display text-2xl font-bold text-indigo">Retaguarda</h1>

        <label className="label" htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          className="field mb-4"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoFocus
        />

        <label className="label" htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          className="field"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button className="btn-primary mt-6 w-full" disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
