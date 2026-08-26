# Vínculo Vendedor do ERP ↔ Usuário do sistema

Hoje essa tela **não existe**. A tabela de vínculo (`gestao_parts_vendedores`: código, nome, usuário) já foi criada e é usada pelo envio de orçamentos, mas o único lugar de configuração na tela Gestão Parts é o botão "Configurações de envio" (engrenagem), que só mostra as opções de disparo automático.

## O que será feito

Adicionar uma segunda aba dentro do mesmo modal de engrenagem em Gestão Parts:

- Aba "Envio" — o card de configuração de orçamentos que já existe.
- Aba "Vendedores" (nova) — tabela de vínculo com:
  - Lista de vendedores já cadastrados (código + nome) e o usuário do sistema vinculado.
  - Botão "Importar do ERP" que lê os vendedores presentes nos pedidos/orçamentos recentes e cria as linhas faltantes automaticamente.
  - Seletor de usuário (membros ativos da equipe) em cada linha, salvando na hora.
  - Ação para adicionar manualmente um vendedor (código + nome) e para remover um vínculo.
- Acesso restrito a administradores/dono; demais usuários não veem a aba.

## Detalhes técnicos

- Novo componente `src/components/gestao-parts/VendedoresMappingCard.tsx` lendo/escrevendo em `gestao_parts_vendedores` e listando membros de `team_members` com status ativo.
- `src/pages/GestaoParts.tsx`: modal de configurações passa a usar `Tabs` (Envio | Vendedores).
- Importação do ERP reaproveita a listagem já carregada de pedidos/orçamentos (campos `vendedorpedido`/`vendedor`) e faz upsert por `codvendedor`.
- Nenhuma mudança em edge functions ou banco é necessária.
