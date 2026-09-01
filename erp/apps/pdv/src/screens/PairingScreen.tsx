import { useState } from 'react';
import { usePos } from '../store/pos-store';
import { SoulLogo } from '../components/SoulLogo';

/** Primeira execução: o terminal troca o código de ativação por uma sessão longa. */
export function PairingScreen() {
  const pairTerminal = usePos((state) => state.pairTerminal);
  const [deviceToken, setDeviceToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await pairTerminal(deviceToken.trim());
    } catch {
      setError('Código não reconhecido. Confira com a retaguarda.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center bg-indigo p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-card bg-white p-8 shadow-lifted">
        <SoulLogo className="mb-6 h-10 text-violet" />
        <h1 className="mb-1 font-display text-2xl font-bold text-indigo">Ativar este terminal</h1>
        <p className="mb-6 text-sm text-slate">
          Informe o código de ativação gerado na retaguarda para vincular o PDV a um quiosque.
        </p>

        <label className="label" htmlFor="deviceToken">
          Código de ativação
        </label>
        <input
          id="deviceToken"
          className="field font-mono"
          value={deviceToken}
          onChange={(event) => setDeviceToken(event.target.value)}
          placeholder="soul-pdv-q01-xxxxxxxx"
          autoFocus
        />

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button className="btn-primary mt-6 w-full" disabled={busy || deviceToken.length < 8}>
          {busy ? 'Ativando...' : 'Ativar terminal'}
        </button>
      </form>
    </div>
  );
}
