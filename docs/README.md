# Documentação Técnica - CRM WhatsApp

Sistema completo de CRM com integração WhatsApp, campanhas de marketing, automações e IA.

## 📚 Índice

- [Arquitetura](./ARCHITECTURE.md) - Visão geral da arquitetura do sistema
- [Banco de Dados](./DATABASE.md) - Schema, tabelas e políticas RLS
- [APIs / Edge Functions](./API/README.md) - Documentação das APIs
- [Componentes](./COMPONENTS.md) - Componentes React principais

## 🛠 Tecnologias

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| **Estado** | TanStack Query (React Query), Zustand |
| **Backend** | Supabase (Edge Functions, Database, Auth, Storage) |
| **Integrações** | WhatsApp API (Evolution), Instagram, Stripe, ElevenLabs, Calendly |
| **UI/UX** | Framer Motion, Lucide Icons, Recharts |

## 🚀 Setup Local

### Pré-requisitos
- Node.js 18+
- npm ou bun

### Instalação

```bash
# Clone o repositório
git clone <repo-url>

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

### Variáveis de Ambiente

O projeto utiliza as seguintes variáveis (configuradas automaticamente pelo Lovable Cloud):

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase |

## 📁 Estrutura de Pastas

```
src/
├── components/         # Componentes React
│   ├── ui/            # Componentes base (shadcn)
│   ├── inbox/         # Componentes do Inbox
│   ├── campaigns/     # Componentes de Campanhas
│   ├── contacts/      # Componentes de Contatos
│   ├── funnel/        # Componentes do CRM/Funil
│   └── ...
├── hooks/             # Custom hooks
├── lib/               # Utilitários e helpers
├── pages/             # Páginas/rotas
├── integrations/      # Integrações externas
│   └── supabase/      # Cliente e tipos Supabase
└── services/          # Serviços de API

supabase/
├── functions/         # Edge Functions
└── migrations/        # Migrações SQL
```

## 🔐 Autenticação

O sistema utiliza autenticação via email/senha com confirmação automática habilitada.

```typescript
import { supabase } from "@/integrations/supabase/client";

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@exemplo.com',
  password: 'senha123'
});

// Cadastro
const { data, error } = await supabase.auth.signUp({
  email: 'usuario@exemplo.com',
  password: 'senha123'
});
```

## 📖 Módulos Principais

### 1. Inbox (Caixa de Entrada)
Gerenciamento de conversas WhatsApp/Instagram com suporte a múltiplas instâncias.

### 2. Campanhas
Envio em massa de mensagens com templates, agendamento e controle de limites.

### 3. CRM / Funil de Vendas
Pipeline de vendas com automações, deals e integração com contatos.

### 4. Agentes de IA
Chatbots inteligentes com fluxos de conversa, base de conhecimento e integrações.

### 5. Formulários
Criação de formulários públicos com mapeamento para contatos.

### 6. Relatórios
Dashboards e métricas de conversas, campanhas e vendas.

## 🤝 Contribuição

1. Crie uma branch para sua feature
2. Faça commits descritivos
3. Abra um Pull Request

## 📄 Licença

Projeto proprietário - Todos os direitos reservados.
