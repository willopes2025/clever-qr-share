import { useEffect } from 'react';
import { usePos } from './store/pos-store';
import { StatusBar } from './components/StatusBar';
import { PairingScreen } from './screens/PairingScreen';
import { OperatorScreen } from './screens/OperatorScreen';
import { OpenCashScreen } from './screens/OpenCashScreen';
import { SaleScreen } from './screens/SaleScreen';

const STATUS_INTERVAL_MS = 30_000;

/** O PDV é uma máquina de estados curta: parear, identificar, abrir caixa, vender. */
export default function App() {
  const { booting, token, operator, sessionId, restore, refreshStatus } = usePos();

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    const timer = setInterval(() => void refreshStatus(), STATUS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  if (booting) return <Splash />;
  if (!token) return <PairingScreen />;

  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <main className="min-h-0 flex-1">
        {!operator ? <OperatorScreen /> : !sessionId ? <OpenCashScreen /> : <SaleScreen />}
      </main>
    </div>
  );
}

function Splash() {
  return (
    <div className="grid h-full place-items-center bg-indigo">
      <p className="font-display text-lg text-white">Carregando o Soul PDV...</p>
    </div>
  );
}
