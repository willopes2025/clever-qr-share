# Aba Gestão Parts no cartão do lead

Objetivo: um botão no cartão do lead que consulta o ERP pelo telefone (ou CPF/CNPJ), traz o cadastro, os pedidos e o financeiro do cliente, **salva no banco** e exibe tudo em uma aba fixa "Gestão Parts" dentro do painel do lead — com a mesma qualidade visual da aba Pedidos do painel ERP.

## 1. Persistência (backend)

Nova tabela `gestao_parts_lead_data`:

- `id`, `organization_id`, `contact_id` (único por contato), `deal_id` (opcional)
- `lookup_phone`, `lookup_document`, `erp_codigo`, `erp_nome`
- `pessoa` jsonb, `pedidos` jsonb, `financeiro` jsonb, `credito` jsonb
- `pedidos_count`, `pedidos_total` (numeric), `last_synced_at`, `synced_by`
- RLS: leitura/escrita para membros da organização (`get_organization_member_ids`), `GRANT` para `authenticated` e `service_role`.

## 2. Edge function `gestao-parts-api`

- Nova ação `lead_sync`: recebe `contact_id`, `telefone`, `documento`, `deal_id`.
  - Reaproveita a lógica de `lead_summary` (pessoa → pedidos feed v3 → contas a receber → crédito).
  - Melhoria na busca por telefone: quando não há CPF/CNPJ, cruza o feed também pelos telefones do pedido (`fones`) além do `codpessoa`, usando o telefone normalizado (8/9 dígitos finais) para evitar falso negativo de DDI/DDD.
  - Calcula totais e grava/atualiza o registro em `gestao_parts_lead_data` (upsert por `contact_id`).
  - Retorna o registro salvo.
- `lead_summary` continua existindo (leitura sem gravar), usado como fallback.

## 3. Frontend

**Hook `useGestaoPartsLeadData(contactId)`**
- `useQuery` lendo `gestao_parts_lead_data` (cache local, sem chamar o ERP).
- `useMutation` `sync()` chamando a ação `lead_sync` e invalidando a query.

**Componente `src/components/inbox/lead-panel/GestaoPartsLeadTab.tsx`**
- Cabeçalho: telefone/documento usados, data da última sincronização e botão **"Buscar no ERP"** (ícone de refresh, estado de loading).
- Estado vazio: mensagem + botão de primeira busca.
- Cartões de resumo: cliente encontrado (código/nome), total de pedidos, valor total comprado, saldo em aberto no financeiro.
- Lista de pedidos reutilizando `PedidosTable` (já tem busca local, colunas formatadas e pop-up de detalhe com itens/pagamento/endereço).
- Bloco de contas a receber com número, vencimento, valor e status.

**Integração no painel**
- Em `RightSidePanel` / `LeadPanelTabs`, adicionar a aba fixa "Gestão Parts" (só aparece quando a integração está conectada — `useGestaoParts().hasGestaoParts`), ao lado das abas configuráveis do usuário.
- `GestaoPartsDealSection` (collapsible atual no funil) passa a ler o mesmo cache e a expor o mesmo botão de sincronizar, evitando duas fontes de verdade.

## 4. Detalhes técnicos

- Nada é consultado no ERP automaticamente: a busca só ocorre no clique, e o painel sempre renderiza o último snapshot salvo.
- Normalização de telefone segue `toErpPhone` no edge function e `normalizePhone` no cliente.
- Formatação (moeda, datas, extração de campos) reaproveita `src/components/gestao-parts/utils.ts`.
- Erros do ERP são mostrados inline, sem quebrar a aba, e o último snapshot permanece visível.
