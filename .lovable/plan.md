

## Plano: Auto-conversão de contatos do Inbox em Leads

### Contexto

Atualmente, a criação automática de leads (deals no funil) acontece apenas em dois cenários:
1. **Evolution API (`receive-webhook`)**: Cria deal se a instância tem `default_funnel_id` configurado
2. **Formulários (`submit-form`)**: Cria deal se o formulário tem `target_funnel_id`

O webhook da **Meta (`meta-whatsapp-webhook`)** NÃO cria leads automaticamente. Além disso, não existe uma configuração global — é por instância.

### O que será feito

#### 1. Adicionar campo `auto_create_leads` + `default_funnel_id` na tabela `user_settings`

Migração SQL para adicionar:
- `auto_create_leads BOOLEAN DEFAULT false` — toggle global
- `auto_lead_funnel_id UUID REFERENCES funnel_stages(funnel_id)` — funil destino para novos leads
- `auto_lead_stage_id UUID` — estágio inicial (opcional, usa o primeiro se não definido)

#### 2. Criar componente de configuração na aba Settings

Novo componente `AutoLeadSettings` na página de Configurações, adicionado como uma nova aba ou seção dentro de uma aba existente (ex: dentro de "Notificações" ou como aba própria "Leads"). Conterá:
- **Switch** para ativar/desativar auto-criação
- **Select** para escolher o funil destino
- **Select** (opcional) para escolher o estágio inicial
- Botão salvar

#### 3. Atualizar `meta-whatsapp-webhook`

Quando uma nova conversa é criada (contato novo no inbox via Meta):
- Buscar `user_settings` do `userId`
- Se `auto_create_leads = true` e `auto_lead_funnel_id` definido → chamar lógica de criação de deal (similar à do `receive-webhook`)

#### 4. Atualizar `receive-webhook`

Quando a instância **não** tem `default_funnel_id`, verificar o fallback global:
- Buscar `user_settings`
- Se `auto_create_leads = true` → usar `auto_lead_funnel_id` como fallback

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Adicionar colunas à `user_settings` |
| `src/hooks/useUserSettings.ts` | Incluir novos campos no tipo e defaults |
| Novo: `src/components/settings/AutoLeadSettings.tsx` | UI de configuração |
| `src/pages/Settings.tsx` | Adicionar nova aba "Leads" |
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Auto-criar deal para novos contatos |
| `supabase/functions/receive-webhook/index.ts` | Fallback para config global quando instância não tem funil |

