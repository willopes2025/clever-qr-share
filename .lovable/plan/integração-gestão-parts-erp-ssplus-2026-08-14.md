# Integração Gestão Parts (ERP SSPlus)

Integração da API `https://api.gestaoparts.com.br` (GPASI v4) no WideZap, ativada para a conta `comercial@martinspecas.com.br`, seguindo o mesmo padrão já usado na integração Ssótica.

## O que será entregue

### 1. Conexão e credenciais
- Novo provedor `gestao_parts` na tela **Configurações > Integrações**, com campos usuário e senha e botão "Testar conexão".
- Credenciais gravadas na integração da conta (não ficam no código). Já deixo cadastradas as credenciais enviadas no e-mail anexo (usuário `rrmartinswidezapws`) para a conta `comercial@martinspecas.com.br` e testo a autenticação.
- Autenticação via `POST /token` (OAuth2 password, form-urlencoded). O token vale 24h e ficará em cache no servidor, com renovação automática quando expirar ou retornar 401.

### 2. Módulos consultados
- **Peças / estoque / preço**: busca de peça (`POST /erpssplus/peca`), código de barras, preço (`/peca/preco/...`, `/peca/tabela/preco/`) e estoque atual v2 (atual, reservado e em trânsito).
- **Clientes**: consulta por telefone, CPF ou CNPJ (`GET /erpssplus/pessoas/{id}`) e listagem de clientes (`GET /erpssplus/cliente`), incluindo limite de crédito.
- **Pedidos de venda**: status de pedidos (`/pedido/status`, `/v2/pedido/status`), detalhe por requisição e pedidos por CPF.
- **Financeiro**: contas a receber e boletos do cliente (`/financeiro/contas/receber`, `/financeiro/contas/receber/boletos`).

Nesta entrega os módulos são **somente leitura** (consulta). Criação de pedido no ERP fica para uma etapa seguinte, se você quiser.

### 3. Página própria "Gestão Parts"
Nova página no menu, no mesmo estilo da Ssótica, com abas:
- **Peças**: busca por código, descrição, código de barras ou placa, mostrando preço e estoque por empresa.
- **Clientes**: busca por telefone/CPF/CNPJ com dados do cadastro e limite de crédito.
- **Pedidos**: lista por status e período, com detalhe do pedido.
- **Financeiro**: contas a receber e boletos, com filtro de período.

### 4. Painel no card do lead / Inbox
Nova seção lateral "Gestão Parts" no card do lead que, a partir do telefone (ou CPF/CNPJ do campo personalizado) do contato, mostra:
- se o cliente existe no ERP (código, nome, fantasia);
- últimos pedidos e seus status;
- boletos e contas a receber em aberto.
Se o contato não for encontrado no ERP, a seção mostra apenas um aviso discreto.

## Detalhes técnicos

- Edge function `gestao-parts-api` (padrão do `ssotica-api`): valida o usuário via `auth.getUser()`, lê as credenciais da integração da organização, obtém/renova o token e roteia as ações (`search_peca`, `get_preco`, `get_estoque`, `check_pessoa`, `list_clientes`, `list_pedidos`, `get_pedido`, `list_contas_receber`, `list_boletos`).
- Credenciais gravadas em `integrations` (`provider = 'gestao_parts'`, coluna `credentials`), reaproveitando as políticas de acesso já existentes dessa tabela — sem nova tabela nem migração.
- Cache de token em memória da função + `settings` da integração, com data de expiração.
- Frontend: `src/hooks/useGestaoParts.ts`, `src/pages/GestaoParts.tsx`, componentes em `src/components/gestao-parts/` e uma seção nova em `src/components/inbox/` para o card do lead.
- Erros da API são repassados com status e corpo original (padrão `extractFunctionError`) para facilitar diagnóstico.
- Telefone normalizado com `normalizePhone` antes de consultar o ERP (a API espera DDD + número, sem o 55).

## Observação de segurança
As credenciais que apareceram no e-mail anexo ficaram expostas em uma mensagem de e-mail; recomendo pedir a troca da senha ao suporte da Gestão Parts depois que a integração estiver validada.
