/** Caixa modal do PDV: fundo escurecido e cartão centralizado. */
export function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-indigo/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-card bg-white p-6 shadow-lifted">{children}</div>
    </div>
  );
}
