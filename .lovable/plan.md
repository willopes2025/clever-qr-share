
# Como gerar e salvar os tokens Meta (7685 e 6204)

Cada número precisa de um token próprio, vindo do App Meta que está vinculado à WABA daquele número. O mesmo processo se repete duas vezes — uma para cada WABA.

---

## Parte 1 — Identificar a WABA de cada número

1. Abra o **Meta Business Manager**: https://business.facebook.com
2. Menu esquerdo → **Contas** → **Contas do WhatsApp**.
3. Anote o **ID da WABA** de cada número:
   - **7685 (Programa Seven)** → WABA `704155141972507` (é a que deu "Application has been deleted", vamos precisar recriar/reatribuir o app)
   - **6204 (Seven Ótica)** → clique nela e copie o ID que aparece.

---

## Parte 2 — Garantir que existe um App ativo para cada WABA

1. Menu esquerdo → **Contas** → **Aplicativos**.
2. Confirme que existe pelo menos **um App ativo** (não "deletado"). Se o app antigo do Programa Seven foi deletado, **crie um novo**:
   - developers.facebook.com → **Meus Apps** → **Criar App** → tipo **Business** → dê um nome (ex.: "WideZap Seven").
   - Dentro do app, adicione o produto **WhatsApp**.
3. No Business Manager → **Aplicativos** → selecione o app → **Adicionar assets** → vincule a **WABA** correspondente.

Ambas as WABAs podem usar o mesmo App, ou apps separados — tanto faz. O que importa é que o App esteja **ativo e vinculado à WABA** do número.

---

## Parte 3 — Gerar o token pelo Usuário do Sistema

Faça isso **duas vezes** (uma pra cada WABA):

1. Business Manager → engrenagem no canto → **Configurações do negócio**.
2. **Usuários** → **Usuários do sistema** → selecione um usuário do sistema **Admin** (ou crie um novo: "Adicionar" → tipo Admin).
3. Clique em **Adicionar assets** → **Contas do WhatsApp** → marque a WABA do 7685 (na 1ª vez) ou do 6204 (na 2ª vez) → marque **Controle total**.
4. Ainda no usuário do sistema → **Adicionar assets** → **Aplicativos** → marque o App ativo → **Controle total**.
5. Clique em **Gerar novo token**:
   - **App**: selecione o App vinculado à WABA daquele número.
   - **Expiração**: **Nunca** (recomendado).
   - **Permissões**: marque
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
6. **Copie o token na hora** — ele só aparece uma vez. Guarde num bloco de notas temporário.

---

## Parte 4 — Colar no WideZap

Pra cada número:

1. WideZap → **Configurações** → **WhatsApp Oficial (Meta)**.
2. Ache o card do número (7685 ou 6204) → clique no ícone de **chave 🔑** ("Definir token exclusivo deste número").
3. Cole o token → **Validar e salvar**.
4. O sistema valida direto na Meta antes de gravar. Se der erro, a mensagem da Meta aparece exata no toast (ex.: "não tem permissão na WABA X" → volte na Parte 3 passo 3 e confirme que a WABA certa está atribuída ao usuário do sistema).

Repita pro outro número, usando o token gerado pra WABA dele.

---

## Parte 5 — Confirmar que funcionou

Depois de colar os dois tokens, me avise. Eu rodo aqui:

- `meta-number-health` nos dois números pra ver inbound/outbound das últimas 24h.
- Teste real de sync de templates da WABA `704155141972507` (a que estava com erro 190).
- Reprocesso do disparo "Receitas vencidas" pra confirmar que o 6204 voltou a enviar.

---

## Erros comuns e como resolver

- **"Application has been deleted" (190)** → o App vinculado foi excluído. Refaça a Parte 2 criando/vinculando um App novo, gere token de novo (Parte 3).
- **"(#100) The parameter ... is required" / "(#33)"** → o token não tem a WABA daquele número nos assets. Volte na Parte 3 passo 3.
- **Token aceito mas templates não sincronizam** → falta `whatsapp_business_management` nas permissões. Gere de novo marcando as duas.
- **"Session has expired"** → você gerou com token de usuário pessoal em vez de usuário do sistema. Só o token do **usuário do sistema** com expiração "Nunca" é permanente.

---

Se preferir, posso montar um vídeo-tutorial curto em texto pra imprimir, ou entrar direto e disparar o `meta-number-health` assim que você colar cada um. Me diz quando quiser que eu valide.
