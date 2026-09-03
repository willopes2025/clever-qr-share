import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { session } from './lib/api';
import { AppShell } from './components/AppShell';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { StoresScreen } from './screens/StoresScreen';
import { UsersScreen } from './screens/UsersScreen';
import { FiscalScreen } from './screens/FiscalScreen';
import { StockScreen } from './screens/StockScreen';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  const [signedIn, setSignedIn] = useState(Boolean(session.read()));

  if (!signedIn) {
    return (
      <QueryClientProvider client={queryClient}>
        <LoginScreen onSignedIn={() => setSignedIn(true)} />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell onSignOut={() => setSignedIn(false)} />}>
            <Route index element={<DashboardScreen />} />
            <Route path="produtos" element={<ProductsScreen />} />
            <Route path="estoque" element={<StockScreen />} />
            <Route path="fiscal" element={<FiscalScreen />} />
            <Route path="lojas" element={<StoresScreen />} />
            <Route path="usuarios" element={<UsersScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
