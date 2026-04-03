

## Plano: Adicionar mapeamento de variáveis Meta no disparo pelo funil

### Problema

O `OpportunityBroadcastDialog` (disparo pelo funil) **não tem UI de mapeamento de variáveis** para templates Meta. A campanha é criada sem `meta_variable_mappings`, e o sistema usa o default do `CampaignFormDialog` que atribui `{{1}}=Nome` e `{{2}}=Telefone`. O usuário precisa editar manualmente depois.

### Solução

Replicar a lógica de mapeamento de variáveis que já existe em `CampaignFormDialog` para dentro do `OpportunityBroadcastDialog`.

### Mudanças

**Arquivo: `src/components/funnels/OpportunityBroadcastDialog.tsx`**

1. **Importar dependências** — `MetaVariableMapping` do hook `useCampaigns`, `useCustomFields`, e `useMemo`/`useEffect`

2. **Adicionar estado e lógica de detecção** — Estado `variableMappings`, detecção automática de variáveis `{{1}}`, `{{2}}`, etc. no `body_text` do template selecionado. Default inteligente: `{{1}}=Nome`, demais = `Texto Fixo` (não mais telefone no `{{2}}`)

3. **Adicionar UI de mapeamento** — Após a seleção do template Meta, exibir um bloco com selects para cada variável detectada, permitindo escolher entre: Nome, Telefone, E-mail, campos personalizados de contato/lead, ou texto fixo

4. **Passar `meta_variable_mappings` na criação da campanha** — Incluir o campo no `createCampaign.mutateAsync()` (linha ~224)

### Detalhes técnicos

- A detecção usa regex `{{(\d+)}}` no `body_text` do template
- O default muda: apenas `{{1}}` mapeia para `contact_name`, todos os outros mapeiam para `fixed_text` (forçando o usuário a definir)
- As opções de fonte incluem campos personalizados via `useCustomFields('contact')` e `useCustomFields('lead')`
- Nenhuma alteração no backend necessária — o campo `meta_variable_mappings` já é suportado pela mutation e pelo edge function de envio

