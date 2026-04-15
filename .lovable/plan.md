

# Plano: Transferir "Valor da Venda" (campo personalizado) → campo `value` oficial

## Diagnóstico

- O campo personalizado `valor_da_venda` (key: `valor_da_venda`) existe em `funnel_deals.custom_fields` com **87 registros** preenchidos.
- Desses, **27 deals** têm o campo `value` oficial zerado ou nulo — são os que precisam de atualização.
- Alguns valores usam vírgula como separador decimal (ex: `"420,00"`), será necessário tratar isso na conversão.

## Plano de Execução

### Passo único: Script SQL de migração de dados

Executar um UPDATE direto via ferramenta de inserção/atualização:

1. **Converter** `custom_fields->>'valor_da_venda'` para numérico (substituindo `,` por `.`)
2. **Filtrar** apenas registros onde o valor convertido é > 1
3. **Atualizar** o campo `value` oficial do deal com esse valor
4. **Condição de segurança**: Só atualiza deals onde `value` é NULL ou 0 (para não sobrescrever valores já preenchidos corretamente)

```sql
UPDATE funnel_deals
SET value = REPLACE(custom_fields->>'valor_da_venda', ',', '.')::numeric
WHERE custom_fields->>'valor_da_venda' IS NOT NULL
  AND custom_fields->>'valor_da_venda' != ''
  AND REPLACE(custom_fields->>'valor_da_venda', ',', '.')::numeric > 1
  AND (value IS NULL OR value = 0);
```

**Resultado esperado**: ~27 deals atualizados. Nenhum dado será perdido — o campo personalizado permanece intacto.

