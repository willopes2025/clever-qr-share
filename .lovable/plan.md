# Capacidade por horário no campo Agendamento

## Situação atual

A opção que você descreveu **já existe** no formulário, dentro das configurações do campo "Agendamento", chamada **"Capacidade por horário (pessoas)"** (`max_per_slot`).

Ela funciona exatamente como você descreveu: o valor é uníssono — vale para todo o calendário daquele campo. A edge function `check-availability` já lê esse valor, conta quantas submissões existem por slot e bloqueia o horário quando a capacidade é atingida.

Hoje ela aparece como um campo numérico livre (mín. 1), o que pode estar passando despercebido.

## Proposta

Tornar a opção mais visível e "à prova de erro", trocando o input numérico por um **seletor com opções predefinidas**, já que você descreveu como "selecionar uma opção".

### Mudanças

1. **`src/components/forms/builder/FieldProperties.tsx`** — bloco das configurações de agendamento:
   - Substituir o `<Input type="number">` do `max_per_slot` por um `<Select>` com as opções:
     - 1 pessoa por horário (padrão — exclusivo)
     - 2 pessoas
     - 3 pessoas
     - 5 pessoas
     - 10 pessoas
     - Ilimitado (valor alto, ex. `9999`)
   - Manter o texto auxiliar explicando que o limite vale para todos os dias/horários do calendário desse formulário.
   - Renomear o label para algo mais claro: **"Quantos agendamentos por horário"**.

2. **Nada muda no backend** — a edge function `check-availability` já respeita `max_per_slot`, então apenas a UI fica mais clara.

## Fora do escopo

- Limites diferentes por dia da semana ou por horário (você confirmou que a regra é uníssona).
- Mudanças na lógica de disponibilidade ou no formulário público.
