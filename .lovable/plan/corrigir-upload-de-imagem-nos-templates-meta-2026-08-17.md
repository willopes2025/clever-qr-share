# Corrigir upload de imagem nos templates Meta

## Diagnóstico confirmado

- As tentativas mais recentes continuam chegando à função `meta-template-upload-media`.
- A Meta identifica os tokens usados como pertencentes ao App ID `810749588135300` e responde que esse aplicativo foi excluído ou não permite a operação.
- O formulário de template não informa à função de upload qual conta WhatsApp Business foi selecionada. Com isso, a função tenta todos os tokens da organização, inclusive credenciais de outra conta ou de um app excluído.
- Os números “Programa Seven” e “Seven Ótica” estão ativos e possuem token por número, mas os tokens atuais não conseguem abrir uma sessão de upload no aplicativo que os emitiu.

## Implementação

1. **Vincular o template a uma conta Meta antes do upload**
   - Incluir no formulário a seleção da conta/número Meta quando houver mais de uma conta disponível.
   - Reutilizar a conta filtrada na tela como seleção inicial quando aplicável.
   - Enviar o `wabaId` escolhido tanto no upload da mídia quanto na criação do template.

2. **Usar somente a credencial correspondente à conta escolhida**
   - Alterar `meta-template-upload-media` para receber e validar o `wabaId`.
   - Resolver o token específico dessa WABA em `meta_number_tokens`, sem tentar tokens aleatórios da organização nem usar silenciosamente o token global de outra conta.
   - Confirmar via Meta que o token está válido e que o aplicativo emissor continua ativo antes de iniciar o upload.

3. **Tratar credencial emitida por aplicativo excluído**
   - Quando a Meta retornar “Application has been deleted”, responder em português informando que o token precisa ser substituído por um token emitido por um App Meta ativo para aquela conta.
   - Exibir a conta/número afetado na mensagem, sem expor o token.
   - Manter os demais erros reais da Meta visíveis para facilitar diagnóstico.

4. **Validar o fluxo completo**
   - Testar a função com autenticação e uma WABA selecionada.
   - Confirmar que uma credencial inválida gera a nova orientação específica.
   - Depois que houver um token de App Meta ativo, confirmar que o upload devolve o `header_handle` e que o template é enviado para a mesma WABA.

## Dependência externa

A alteração elimina a seleção incorreta de token e melhora o diagnóstico, mas não consegue reativar um aplicativo excluído pela Meta. Para o upload concluir, a conta escolhida precisa ter um token novo emitido por um App Meta ativo; o sistema passará a indicar exatamente qual conta precisa dessa atualização.