# Disparo de e-mail por etiqueta (tag)

## O que foi verificado

Consultei os 444 contatos importados com a etiqueta "Associação de Moradores":
- 322 têm e-mail preenchido no campo de e-mail do contato
- 122 realmente vieram sem e-mail

Ou seja, os e-mails foram importados corretamente. O problema é outro: na tela de campanhas de e-mail, as origens de destinatários disponíveis hoje são apenas **colar lista**, **formulário**, **lista de transmissão** e **todos os contatos com e-mail**. Não existe a opção de selecionar contatos por **etiqueta**. Se a origem escolhida foi uma lista de transmissão (especialmente do tipo dinâmica, que não tem contatos materializados), a busca retorna zero e aparece a mensagem "nenhum contato dessa lista possui e-mail".

## O que será feito

1. **Nova origem "Etiqueta (tag)"** na criação de campanha de e-mail
   - Seletor de uma ou mais etiquetas
   - Busca os contatos com aquelas etiquetas, com paginação, considerando e-mail do contato e e-mail em campos personalizados
   - Deduplicação por e-mail

2. **Contador de destinatários antes de criar**
   - Mostrar "X contatos com e-mail de Y selecionados" na origem escolhida, para que dê para conferir antes de disparar

3. **Mensagem de erro mais precisa**
   - Quando nenhum destinatário for encontrado, informar quantos contatos foram avaliados e quantos estavam sem e-mail (ex.: "444 contatos na etiqueta, 122 sem e-mail, 0 válidos"), em vez do texto genérico

4. **Origem "lista de transmissão" dinâmica**
   - Resolver os contatos pelos filtros da lista dinâmica quando ela não tiver contatos fixos, evitando o resultado vazio

## Detalhes técnicos

- `src/pages/EmailCampaigns.tsx`: adicionar `"tags"` ao tipo `sourceType`, novo bloco em `collectRecipients()` consultando `contact_tags` → `contacts (id,name,email,custom_fields)` paginado em 1000, e salvar `source_config: { tagIds }`
- Reuso de `findEmailIn` para achar e-mail em `custom_fields`
- Preview de contagem via consulta `head: true` com `count: 'exact'` ao trocar a origem
- Sem mudanças de banco de dados
