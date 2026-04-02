

## Plano: Revisão completa do sistema de automações — campos de data e fluxo de execução

### Problemas identificados

**1. Seletor de "Campo de Data" mostra apenas campos com `field_type = 'date'` (linha 323)**

O filtro atual:
```typescript
const dateFieldDefinitions = fieldDefinitions?.filter(f => f.field_type === 'date') || [];
```

Isso exclui **5 campos com nomes de data** que estão cadastrados como `field_type: 'text'`:
- `data_da_consulta` (Data da Consulta) — lead
- `data_da_entrada` (Data da Entrada) — lead  
- `data_de_nascimento` (Data de Nascimento) — contact
- `data_que_veio_a_loja` (Data que veio a loja) — lead

Apenas 5 campos aparecem hoje (os que têm `field_type: 'date'`): Data de Abertura, Data de pagamento, data de retorno, Data de Vencimento Boleto, Data do exame.

Também faltam campos fixos do deal como `created_at` (data de criação do deal).

**2. O motor de execução (`process-scheduled-automations`) só busca datas em `deal.custom_fields`**

Para campos de contato (`entity_type: 'contact'`), como `data_de_nascimento` e `data_de_vencimento_boleto`, o motor busca em `deal.custom_fields` mas o dado pode estar em `contacts.custom_fields`. Isso faz com que o gatilho nunca dispare para esses campos.

**3. Não há tratamento de datas em formato Excel serial number no motor**

Dados importados podem conter datas como números seriais (ex: `46061`). O `new Date(dateValue)` no motor não converte esses formatos.

---

### Correções planejadas

#### Arquivo 1: `src/components/funnels/AutomationFormDialog.tsx`

- **Expandir o filtro de campos de data** (linha 323): incluir campos com `field_type === 'date'`, `field_type === 'datetime'`, e campos cujo nome contenha palavras-chave de data (`data`, `date`, `vencimento`, `nascimento`, etc.) — mesma lógica já usada no `FunnelListView`
- **Adicionar campos fixos do deal** no seletor: `created_at` (Data de criação), `expected_close_date` já existe
- **Separar visualmente** campos de Lead vs Contato no seletor (com prefixo 📇 para contato)

#### Arquivo 2: `supabase/functions/process-scheduled-automations/index.ts`

- **Buscar dados do contato** quando o campo de data não for encontrado no deal: fazer join/lookup em `contacts.custom_fields` para campos de contato
- **Converter datas em formato Excel serial** para ISO antes de comparar (função `excelSerialToDate`)
- **Incluir `contact_id` na query de deals** (já incluído) para poder buscar o contato

#### Deploy

- Redeployar `process-scheduled-automations` após as correções

### Arquivos a modificar

1. `src/components/funnels/AutomationFormDialog.tsx` — expandir filtro de campos de data e melhorar seletor
2. `supabase/functions/process-scheduled-automations/index.ts` — suportar campos de contato e datas Excel

