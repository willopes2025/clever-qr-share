import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { session } from './lib/api';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  const [signedIn, setSignedIn] = useState(Boolean(session.read()));

  return (
    <QueryClientProvider client={queryClient}>
      {signedIn ? (
        <DashboardScreen onSignOut={() => setSignedIn(false)} />
      ) : (
        <LoginScreen onSignedIn={() => setSignedIn(true)} />
      )}
    </QueryClientProvider>
  );
}
