

## Plano: Corrigir dados de campos personalizados importados para o funil

### Problema identificado

Os dados importados via planilha para o funil "Programa Seven" foram salvos no local errado. Campos como **Convênio**, **Tratamento**, **Forma Pg Saldo**, **Valor Restante**, **Armação Própria**, **Parcelas** e **Ocorrências** estão definidos como `entity_type = 'lead'` (devem estar em `funnel_deals.custom_fields`), mas os dados foram gravados em `contacts.custom_fields`.

Resultado: o funil busca esses campos em `funnel_deals.custom_fields`, que está vazio — por isso não aparecem.

**193 deals** no funil "Programa Seven" estão afetados, além de deals nos funis "Líderes Seven" e "Cobrança Seven".

### Solução

Duas ações:

1. **Migração de dados existentes** — Criar e executar um script (via edge function ou SQL) que:
   - Para cada deal no funil Programa Seven (e Líderes/Cobrança Seven) com `custom_fields` vazio
   - Leia os campos do lead (`convenio`, `tratamento`, `forma_pg_saldo`, `valor_restante`, `armao_prpria`, `parcelas`, `ocorrencias`) de `contacts.custom_fields`
   - Copie esses valores para `funnel_deals.custom_fields`
   - Mantenha os dados no contato (não apagar, pois podem servir de referência)

2. **Prevenir reincidência** — Verificar e corrigir o fluxo de importação em `useContacts.ts` para garantir que campos com `entity_type = 'lead'` sejam corretamente salvos em `funnel_deals.custom_fields` ao importar com funil selecionado (este fluxo já parece correto no código atual — o bug provavelmente veio de uma versão anterior da importação).

### Arquivos a modificar

- **Criar script de migração temporário** — Edge function `sync-funnel-deals` ou script SQL para copiar dados de `contacts.custom_fields` para `funnel_deals.custom_fields` baseado nas field_keys dos campos com `entity_type = 'lead'`
- **Nenhuma alteração de código frontend necessária** — O código atual de importação e exibição já está correto; o problema é apenas nos dados históricos

### Resultado esperado

Todos os campos personalizados importados aparecerão corretamente nos cards do funil e na sidebar do lead.

