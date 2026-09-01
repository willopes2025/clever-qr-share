import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { session } from '../lib/api';
import { SoulLogo } from './SoulLogo';

const SECTIONS = [
  { to: '/', label: 'Desempenho', end: true },
  { to: '/produtos', label: 'Produtos' },
  { to: '/lojas', label: 'Lojas e terminais' },
  { to: '/usuarios', label: 'Usuários' },
];

/** Moldura da retaguarda: navegação à esquerda, conteúdo à direita. */
export function AppShell({ onSignOut }: { onSignOut: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-lavender">
      <header className="flex items-center gap-4 bg-indigo px-6 py-4 text-white">
        <SoulLogo className="h-7 text-white" />
        <div className="ml-2 border-l border-white/20 pl-4">
          <p className="font-display text-sm font-semibold">Retaguarda</p>
          <p className="font-mono text-[11px] uppercase tracking-widest text-lavender-400">Soul Muscle</p>
        </div>
        <button
          onClick={() => {
            session.clear();
            onSignOut();
            navigate('/');
          }}
          className="ml-auto rounded-pill border border-white/25 px-4 py-2 font-mono text-[11px] uppercase tracking-widest hover:bg-white/10"
        >
          sair
        </button>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 p-6">
        <nav className="w-48 shrink-0">
          <ul className="space-y-1">
            {SECTIONS.map((section) => (
              <li key={section.to}>
                <NavLink
                  to={section.to}
                  end={section.end}
                  className={({ isActive }) =>
                    `block rounded-xl px-4 py-2.5 font-display text-sm font-semibold transition-colors duration-150 ${
                      isActive ? 'bg-violet text-white' : 'text-indigo hover:bg-white'
                    }`
                  }
                >
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
