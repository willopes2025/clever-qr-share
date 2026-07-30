## Objetivo

Modo dark real no WideZap: legível em todas as telas, com cada usuário escolhendo entre **Claro / Escuro / Sistema**, e a preferência salva na conta (persiste entre dispositivos).

## Situação atual (verificada)

- `src/index.css` já tem um bloco `.dark` com tokens básicos (background, card, primary, border...), mas ele nunca é ativado — não existe `ThemeProvider` nem toggle.
- `next-themes@^0.3.0` já está instalado (usado só pelo `sonner`).
- O bloco `.dark` está incompleto: faltam `--sidebar-*`, `--info`, `--whatsapp-*`, e as sombras (`--shadow-*`) são feitas para fundo claro.
- Cerca de 67 arquivos usam cores fixas (`bg-white`, `text-white`, `text-gray-*`, `bg-black`, hex) — esses são os pontos que ficariam ilegíveis no dark. Concentrados em: Inbox (bolhas, mídia, painel do lead), Dashboard (cards/gráficos), Chatbot Builder (nodes), Financeiro/Asaas, Instances/Settings, Landing/Login.

## Escopo da entrega

### 1. Infra de tema
- Criar `ThemeProvider` (next-themes, `attribute="class"`, `defaultTheme="system"`, sem flash) no topo do `App.tsx`.
- Script anti-flash no `index.html` aplicando a classe antes do render.
- Hook `useThemePreference` que sincroniza o tema local com o backend.

### 2. Preferência por usuário (backend)
- Adicionar coluna `theme` (`'light' | 'dark' | 'system'`, default `'system'`) em `user_settings` (tabela já existente, já com RLS por usuário).
- Ler no login e gravar ao trocar, com fallback em `localStorage` para carregamento instantâneo.

### 3. Paleta dark completa
- Completar o bloco `.dark` em `index.css`: sidebar, info, tokens WhatsApp (fundo do chat, bolhas in/out), sombras com opacidade adequada ao fundo escuro, `--card`, `--muted`, bordas com contraste suficiente.
- Ajustar utilitários já existentes (`.depth-card`, `.bg-dark-*`, `.whatsapp-chat-bg`, caudas de bolha) para variantes dark.
- Alvo de contraste: AA (4.5:1 em texto, 3:1 em bordas/ícones).

### 4. Toggle na interface
- Botão de tema no **rodapé da sidebar** (desktop) com os 3 modos, seguindo a preferência já registrada pelo usuário.
- Espelhar no menu do usuário no header mobile.
- Também disponível em Configurações > Perfil.

### 5. Varredura de cores fixas (a parte mais longa)
Substituir cores fixas por tokens semânticos, em ondas por área de impacto:
1. Inbox (bolhas, lista de conversas, mídia, painel do lead, badges de provider)
2. Dashboard e gráficos (recharts usa `--chart-*`)
3. Funis / Kanban e cards de lead
4. Chatbot Builder (nodes do react-flow)
5. Configurações, Instances, Financeiro/Asaas
6. Diálogos, tabelas e componentes `ui/` restantes
7. Login / Landing / páginas públicas (podem ficar fixas no claro, se você preferir)

Fora do escopo do dark: templates de e-mail (`email-design.ts`) e HTML enviado a clientes continuam em tema claro.

### 6. Validação
- Percorrer as telas principais em dark com screenshots automatizados e conferir contraste, estados hover/ativo, e ícones sobre fundo escuro.
- Verificar persistência: trocar tema, recarregar, entrar em outro navegador com o mesmo usuário.

## Detalhes técnicos

- `next-themes` com `attribute="class"` + `disableTransitionOnChange` para evitar piscadas.
- Migração: `ALTER TABLE public.user_settings ADD COLUMN theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system'))` — sem novas policies (RLS já cobre a tabela).
- Nenhuma alteração de lógica de negócio; mudanças limitadas a CSS, tokens e camada de apresentação, mais o campo de preferência.

## Ordem sugerida

Etapa A (rápida, já entrega valor): infra + paleta dark completa + toggle + persistência.
Etapa B: varredura das cores fixas por área, do Inbox para fora.
