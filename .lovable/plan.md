

## Plano: Corrigir filtros padrão da pesquisa de leads

### Problema
A pesquisa retorna 0 resultados em casos onde deveria encontrar empresas (ex: igrejas em Afonso Cláudio) porque os filtros padrão `com_telefone: true` e `somente_celular: true` são muito restritivos. Organizações religiosas e muitas empresas pequenas só possuem telefone fixo ou nenhum telefone cadastrado.

### Causa Raiz
No arquivo `src/pages/LeadSearch.tsx`, os `initialFilters` definem:
```
com_telefone: true,    // exige que tenha telefone
somente_celular: true, // exige que seja celular
```
Isso exclui automaticamente qualquer empresa que tenha apenas telefone fixo ou nenhum telefone cadastrado.

### Solução
Alterar os valores padrão dos filtros para serem menos restritivos:

**`src/pages/LeadSearch.tsx`** - Mudar `initialFilters`:
- `com_telefone: false` (não exigir telefone por padrão)
- `somente_celular: false` (não filtrar apenas celular por padrão)

O usuário ainda poderá ativar esses filtros manualmente quando quiser resultados apenas com celular.

### Impacto
- Nenhuma alteração de banco de dados
- Nenhuma alteração na Edge Function
- Apenas 2 linhas modificadas no frontend

