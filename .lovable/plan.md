

## Plano: Ocultar dados ssOtica por padrão no painel do lead (Inbox)

### Problema
A seção ssOtica no card do lead na Inbox aparece **aberta por padrão**, mostrando todos os dados (OS, Vendas, Parcelas) imediatamente. O usuário quer que esses dados só apareçam ao clicar explicitamente em "ssOtica".

### Alteração

**`src/components/funnels/SsoticaDealSection.tsx`** — Linha 30:
- Mudar `useState(true)` para `useState(false)` no estado `isOpen`
- Isso faz a seção iniciar **fechada**, mostrando apenas o header "ssOtica" com o botão de sync
- O usuário clica para expandir e ver OS, Vendas e Parcelas

### Verificação de tipos de dados

Já verificado — os tipos estão corretos:
- **Datas** (entrada, entrega, vencimento, data_venda): formatadas com `dd/MM/yyyy` via `format()`
- **Valores monetários** (valor_total, valor_parcela): formatados como `R$ X.XXX,XX` via `toLocaleString('pt-BR')`
- **Contadores** (total_os, total_vendas, total_parcelas): exibidos como números inteiros
- **Texto** (status, etapa_atual, observações, forma_pagamento): exibidos como strings
- **Datas vencidas**: comparação correta com `new Date()` para highlight visual

### Resultado
A seção ssOtica aparecerá colapsada por padrão. Um clique no header "ssOtica" revela todos os dados da integração com a formatação correta de cada tipo.

