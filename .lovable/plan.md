

# Plano: Melhorar Importação de Leads do Instagram

## O que muda

### 1. Seleção/Criação de Campos Personalizados
Adicionar ao dialog de importação (`ImportInstagramLeadsDialog.tsx`) uma seção para selecionar campos personalizados existentes (`custom_field_definitions` com `entity_type='contact'`) e definir valores que serão aplicados a todos os contatos importados. O usuário poderá também criar novos campos personalizados inline (similar ao que já existe para tags).

**Campos do perfil Instagram mapeáveis:**
- `username`, `biography`, `business_category`, `external_url`, `followers_count`, `following_count`, `posts_count`
- Valores definidos manualmente pelo usuário (ex: "Origem: Campanha X")

### 2. Suporte a Múltiplos Telefones
Atualmente, cada contato tem um campo `phone` (texto único). O Instagram pode fornecer um telefone via enriquecimento. O plano:
- Manter o `phone` principal como identificador do contato (instagram:username ou telefone normalizado)
- Adicionar telefones extras no `custom_fields` do contato como array (`additional_phones`)
- Na UI de importação, mostrar opção para o usuário informar telefones adicionais ou mapear dados extras

## Detalhes Técnicos

### Arquivo: `src/components/instagram/ImportInstagramLeadsDialog.tsx`

**Mudanças:**
1. **Buscar `custom_field_definitions`** com `entity_type='contact'` (mesmo padrão do `ImportContactsToFunnelDialog.tsx`)
2. **Seção de campos personalizados** — Lista os campos existentes com inputs para definir valores. Cada campo selecionado terá seu valor aplicado a todos os contatos importados via `custom_fields` JSONB
3. **Criar campo inline** — Input para nome + tipo do campo, cria em `custom_field_definitions` e já seleciona
4. **Seção de telefones adicionais** — Para cada perfil que tenha telefone E use `instagram:username` como identificador principal, mostrar opção de vincular o telefone como campo adicional. Armazenar no `custom_fields` como `additional_phones: string[]`
5. **Atualizar `handleImport`** — Mesclar os valores dos campos personalizados selecionados no objeto `custom_fields` do insert, incluindo telefones adicionais

### Sem alteração de schema
Tudo será armazenado no JSONB `custom_fields` existente na tabela `contacts`, sem necessidade de migração.

