# Gestão Parts: corrigir credenciais e tratamento de erro

## O que descobri testando a API real

1. **A senha gravada no sistema estava errada** (faltavam caracteres: estava `JbK7uwP1nO...`, o correto é `JBFMQk7uwP1nO...`). Por isso o retorno era "Usuário ou senha incorreto".
2. **Com a senha correta, o login avança e o erro muda** para:
   `401 {"detail":"Usuário não habilitado para empresa"}`
3. **O payload do WideZap está correto.** Conferi a documentação oficial da API (`/openapi.json`): o endpoint `/token` aceita `username`, `password`, `grant_type`, e opcionalmente `scope`, `client_id`, `client_secret` — nenhum campo de empresa. Testei variações com `scope` e `client_id` (código da empresa e CNPJ) e o erro é o mesmo. Ou seja, não é problema de formato do request.

**Conclusão:** o usuário `rrmartinswidezapws` existe e a senha está certa, mas ainda **não foi vinculado à empresa (Martins Distribuidora, CNPJ 59.336.127/0001-29) no lado da Gestão Parts**. É exatamente o que o e-mail pede: acionar o suporte (setor e-commerce/api, analista Bruno) para concluir a liberação.

## O que vou fazer

1. **Atualizar a senha correta** na integração da conta `comercial@martinspecas.com.br`.
2. **Melhorar o tratamento de erro** na função `gestao-parts-api`:
   - Distinguir os dois casos de 401 no `/token`: credencial inválida vs. usuário não habilitado para a empresa.
   - Mensagens em português na tela: "Credenciais inválidas — atualize em Configurações > Integrações" e "Usuário ainda não liberado para a empresa no ERP — acione o suporte da Gestão Parts".
   - Limpar o cache de token na falha e não repetir a chamada em loop.
3. **Sinalizar o status na tela de Integrações**: gravar a falha em `integrations.sync_error` e mostrar o aviso, em vez da integração aparecer como "conectada" mesmo sem funcionar.
4. **Rodar o teste de conexão** logo após a senha ser atualizada e reportar o resultado.

## O que depende da Gestão Parts

Enquanto o suporte não habilitar o usuário para a empresa, nenhuma consulta (peças, clientes, pedidos, financeiro) vai retornar dados — o bloqueio é do lado deles. Assim que liberarem, a integração deve funcionar sem novas mudanças: é só clicar em "Testar conexão".

Mensagem sugerida ao suporte: *"Usuário de webservice `rrmartinswidezapws` autentica mas retorna 'Usuário não habilitado para empresa'. Favor vincular o usuário à empresa Martins Distribuidora de Auto Peças Ltda — CNPJ 59.336.127/0001-29."*

## Detalhes técnicos

- `supabase/functions/gestao-parts-api/index.ts`: função `getToken` (~linhas 145-210) — mapear o corpo do 401 para códigos próprios (`invalid_credentials`, `company_not_enabled`) e propagar a mensagem amigável; invalidar o cache do token na falha.
- `src/hooks/useGestaoParts.ts`, `src/pages/GestaoParts.tsx`, `src/components/funnels/GestaoPartsDealSection.tsx`: exibir a mensagem tratada e um atalho para Configurações > Integrações.
- Atualização da senha é dado (não schema), feita direto no registro da integração.
- Recomendo trocar essa senha com o suporte depois da validação, já que circulou por e-mail.
