# Corrigir consultor errado no formulário Exame de Vista CSV

## O que está acontecendo

No campo "Consultor" do formulário, duas opções foram salvas com o mesmo valor interno:

```text
Weslaine      -> option3
William       -> option6   <-- duplicado
Katia         -> option7
Maria Vitória -> option8
Karoline      -> option5
Hevellyn      -> option6   <-- duplicado
```

Quando o lead marca "William", o formulário envia `option6`; na hora de gravar no card,
o sistema procura o rótulo desse valor e encontra "Hevellyn" (a última opção com o mesmo valor).
Por isso o card mostra o consultor errado.

A causa raiz é o editor de opções do construtor de formulários: ele gera o valor novo como
"opção + quantidade atual + 1". Se alguma opção for excluída no meio, o próximo valor gerado
repete um valor já existente.

## O que será feito

1. Corrigir os dados do campo "Consultor" desse formulário, dando um valor único a cada nome
   (Hevellyn passa a ter valor próprio, William mantém `option6` para não quebrar respostas antigas).
2. Corrigir o gerador de valores no editor de campos para usar um identificador único
   (não mais baseado na contagem), impedindo que o problema volte em qualquer formulário.
3. Varredura nos demais formulários: identificar outros campos de escolha com valores duplicados
   e normalizá-los da mesma forma.

## Detalhes técnicos

- Migração de dados atualizando `form_fields.options` do campo `60a4c40a-64a6-495c-bf09-fd4d3e61b368`
  e de quaisquer outros campos onde exista valor repetido dentro do mesmo array de opções.
- `src/components/forms/builder/FieldProperties.tsx`: ao adicionar opção, gerar
  `value` único (ex.: `opt_<random>` ou maior sufixo existente + 1) em vez de `option${length+1}`.
- Não altera respostas já submetidas; apenas os envios futuros passam a gravar o nome correto.
