# Revisão: integração Gestão Parts (ERP SSPlus)

Status atual da integração feita para a conta `comercial@martinspecas.com.br`.

## O que já está pronto

**Conexão**
- Provedor `gestao_parts` disponível em Configurações > Integrações (usuário, senha e URL opcional da API).
- Credenciais já gravadas e ativas para `comercial@martinspecas.com.br` desde 14/08 (usuário `rrmartinswidezapws`).
- Autenticação OAuth2 por `POST /token`, com token em cache e renovação automática.

**Backend** — função `gestao-parts-api` (509 linhas), somente leitura, com as ações:
- Peças: busca, código de barras, preço, tabela de preço, estoque, consulta por placa.
- Clientes: consulta por telefone/CPF/CNPJ, listagem e limite de crédito.
- Pedidos: listagem por status, detalhe por requisição e pedidos por CPF.
- Financeiro: contas a receber e boletos.
- Extras: empresas, teste de conexão e `lead_summary` (resumo do cliente para o card do lead).

**Frontend**
- Página `/gestao-parts` com as abas de consulta, exibindo os dados em tabela (com opção "Ver JSON").
- Item "Gestão Parts" no menu lateral, exibido só quando a integração está conectada.
- Permissão `view_gestao_parts` (padrão: ligada para admin, desligada para membro).
- Seção "Gestão Parts" no card do lead / Inbox, mostrando cadastro no ERP, últimos pedidos e contas a receber, a partir do telefone ou CPF/CNPJ do contato.

## O que ficou de fora (pendências)

1. **Escrita no ERP**: criação de pedido de venda a partir do WideZap — não implementada, tudo hoje é consulta.
2. **Uso pela IA**: o agente de IA não consulta o ERP (estoque, preço, pedidos, boletos) para responder o cliente no WhatsApp.
3. **Sem sincronização/cache em banco**: cada consulta vai direto na API do ERP (a Ssótica, por comparação, tem sincronização). Consultas repetidas podem ficar lentas.
4. **Apresentação genérica**: as tabelas são montadas automaticamente a partir da resposta da API — sem colunas nomeadas, formatação de moeda ou filtros específicos por módulo.
5. **Segurança**: a senha do ERP veio por e-mail; vale pedir troca ao suporte da Gestão Parts (a integração continua funcionando, basta atualizar em Configurações).

## Sugestão de próximo passo

Se quiser evoluir, a ordem que faz mais sentido é: (2) IA consultando estoque/preço no WhatsApp, depois (4) refinar a apresentação das telas, e por fim (1) criação de pedido no ERP.
