# Correção: campo Email não salva e nome errado no card do lead

## Problema 1 — Campo personalizado "Email" não salva

A organização do `contatosoulmuscle@gmail.com` tem um campo de contato do tipo **email** (`Email`). O editor de campos usado no painel de contato do inbox (`CustomFieldsEditor`) só sabe desenhar os tipos `text`, `number`, `boolean`, `date`, `time`, `datetime` e `select`. Para `email` (e também `phone` e `url`) ele cai no `default` e **não renderiza nenhum campo** — aparece só o rótulo, sem input e sem botão de salvar. Por isso o valor nunca é gravado.

Observação: o painel novo (`ContactFieldsSection`) já trata esses tipos corretamente pelo `default`, então o comportamento é inconsistente entre as duas telas.

### Correção
Em `src/components/inbox/CustomFieldsEditor.tsx`, trocar o `default: return null` por um renderizador de texto (mesmo bloco já usado no `case 'text'`), aplicando `type="email"`/`type="tel"`/`type="url"` conforme o tipo do campo. Assim qualquer tipo novo passa a ter edição e salvamento garantidos.

## Problema 2 — Nome enviado no formulário não aparece no card do lead

Confirmado nos envios do formulário `exame-de-vista-csv`: o nome digitado **é gravado corretamente no contato**, mas o **título do lead continua com o nome antigo**. Exemplos reais:

| Nome enviado | Contato salvo | Título do lead |
|---|---|---|
| Enoque Soares | Enoque Soares | Lead - Soares Moreno |
| Lázaro da Silva Santana | Lázaro da Silva Santana | Lead - Marcia |
| Evanderson de Carvalho | Evanderson de Carvalho | Lead - Cliente |

Como o card do funil e o cabeçalho do lead exibem o **título do negócio**, o usuário vê o nome antigo (ex.: "Hevellyn") mesmo tendo enviado "William".

Causa: no `submit-form`, o caminho de busca por **Código do Lead** (`lookup_by_lead_number`) atualiza o contato, mas não propaga o novo nome para o título do negócio — diferente do caminho por Lead ID (`lookup_by_display_id`), que já faz isso.

### Correção
Em `supabase/functions/submit-form/index.ts`, no bloco `lookup_by_lead_number`: quando o formulário trouxer um nome e o negócio localizado tiver título genérico (`Lead - Cliente`, `Sem nome`, vazio) ou título divergente do nome antigo do contato, atualizar `funnel_deals.title` para o novo nome — mesma regra já aplicada no caminho por Lead ID.

Também normalizar o código digitado (aceitar `#6789` e `6789`, já suportado) e ordenar o resultado da busca de forma determinística para nunca resolver um negócio arbitrário quando houver mais de um.

## Detalhes técnicos
- `src/components/inbox/CustomFieldsEditor.tsx`: `renderField` → substituir `default: return null` por input de texto com `type` derivado de `field_type`.
- `supabase/functions/submit-form/index.ts`: bloco `lookup_by_lead_number` (~linhas 423-478) → adicionar update do `funnel_deals.title` e ordenação determinística na busca do negócio.
- Nenhuma mudança de banco de dados é necessária.
