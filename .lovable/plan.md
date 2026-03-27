

## Gerar conteúdo de template com IA

### O que será feito

Adicionar um botão "Gerar com IA" no formulário de criação/edição de template (`TemplateFormDialog`). Ao clicar, abre uma seção onde o usuário:
1. Escolhe a **categoria/objetivo** da mensagem (ex: follow-up, boas-vindas, promoção)
2. Vê uma **sugestão de prompt** pré-preenchida baseada na categoria selecionada
3. Vê a lista de **variáveis disponíveis** (campos personalizados + nome, telefone, email) que a IA pode usar
4. Clica em "Gerar" e a IA produz o conteúdo do template com as variáveis `{{campo}}` inseridas

### Arquivos a criar/editar

**1. Nova edge function: `supabase/functions/generate-template-content/index.ts`**
- Recebe: prompt do usuário, categoria do template, lista de variáveis disponíveis (key + label)
- Usa Lovable AI (Gemini 3 Flash) para gerar o conteúdo da mensagem
- System prompt instrui a IA a criar mensagens WhatsApp naturais usando as variáveis no formato `{{key}}`
- Retorna o conteúdo gerado

**2. Editar: `src/components/templates/TemplateFormDialog.tsx`**
- Adicionar botão "Gerar com IA" (ícone Sparkles) acima do campo de conteúdo
- Ao clicar, expande uma seção com:
  - Prompt de instrução (textarea) com sugestão pré-preenchida baseada na categoria
  - Chips mostrando variáveis disponíveis (nome, telefone, email + campos personalizados)
  - Botão "Gerar Mensagem" que chama a edge function
- O conteúdo gerado é inserido no campo de conteúdo existente
- Loading state durante a geração

**3. Sugestões de prompt por categoria:**
- **Promocional**: "Crie uma mensagem promocional oferecendo um desconto especial. Use o nome do cliente para personalizar."
- **Boas-vindas**: "Crie uma mensagem de boas-vindas calorosa para um novo cliente."
- **Lembrete**: "Crie um lembrete amigável sobre um compromisso ou pagamento pendente."
- **Transacional**: "Crie uma confirmação de pedido/transação com detalhes relevantes."
- **Notificação**: "Crie uma notificação informativa sobre uma atualização importante."
- **Outro**: "Crie uma mensagem personalizada para o contato."

### Fluxo
```text
Usuário seleciona categoria → Prompt sugerido aparece
    → Usuário ajusta prompt (opcional)
    → Clica "Gerar com IA"
    → Edge function gera conteúdo com variáveis {{nome}}, {{campo_x}}
    → Conteúdo inserido no textarea
    → Variáveis detectadas automaticamente
```

### Detalhes técnicos
- Edge function usa `LOVABLE_API_KEY` (já disponível) com modelo `google/gemini-3-flash-preview`
- Variáveis disponíveis são buscadas do hook `useCustomFields` (já usado no `VariableAutocomplete`)
- O conteúdo gerado substitui o conteúdo atual do textarea (com confirmação se já houver texto)

