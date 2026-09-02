# Publicar o Soul ERP

Roteiro para pôr o sistema no ar em **soulmuscle.wideic.com**. Um servidor Linux
com Docker resolve — não há serviço gerenciado obrigatório.

## O que sobe

Uma imagem única com três coisas dentro, servidas pelo mesmo processo:

| Endereço | O que é |
|----------|---------|
| `https://soulmuscle.wideic.com/` | Retaguarda: desempenho, produtos, lojas, usuários |
| `https://soulmuscle.wideic.com/pdv/` | Frente de caixa, instalável no computador do quiosque |
| `https://soulmuscle.wideic.com/v1/` | API (documentação em `/v1/docs`) |

Ao lado: PostgreSQL e um proxy Caddy que cuida do HTTPS.

## Antes de começar

1. **Servidor**: 2 vCPU e 4 GB de RAM atendem com folga a operação atual.
2. **DNS**: aponte `soulmuscle.wideic.com` para o IP do servidor **antes** de
   subir — o Caddy emite o certificado na primeira subida e precisa do domínio
   resolvendo.
3. **Portas 80 e 443** abertas.

> **HTTPS não é opcional.** Sem certificado válido o navegador recusa o service
> worker, e o PDV deixa de abrir com a internet caída.

## Subir

```bash
git clone <repositório> soul-erp && cd soul-erp/erp
cp .env.production.example .env
openssl rand -base64 48        # cole em JWT_SECRET
$EDITOR .env                   # preencha senha do banco e JWT_SECRET

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f app
```

As migrações rodam sozinhas na subida. Quando o log mostrar *"Soul ERP API em
http://localhost:3000/v1"*, o sistema está no ar.

## Primeiro acesso

O banco sobe vazio. Provisione o cliente — isso cria os planos, o CNPJ, os
papéis, o usuário dono e a primeira loja com um terminal:

```bash
docker compose -f docker-compose.prod.yml exec app \
  npx ts-node --transpile-only apps/api/prisma/provision.ts \
    --cnpj 12345678000190 \
    --razao "Soul Muscle Alimentos LTDA" \
    --fantasia "Soul Muscle" \
    --ie 110042490114 \
    --email will@soulmuscle.com.br \
    --senha "uma senha forte" \
    --loja "Quiosque Shopping Norte" \
    --plano completo
```

Ele imprime o **código de ativação** do primeiro terminal — anote, é o que se
digita no PDV. Nenhum dado fictício é criado: produto, preço e operadores entram
pela retaguarda.

> Para demonstrar o sistema com dados de exemplo (duas semanas de vendas, catálogo
> de sorvete), use `prisma/seed.ts` em vez deste — **nunca em produção**, porque
> ele apaga o banco antes de semear.

## Instalar o PDV no quiosque

1. Abrir `https://soulmuscle.wideic.com/pdv/` **com internet** e instalar como
   aplicativo (o navegador oferece; em Chrome/Edge, ícone na barra de endereço).
2. Digitar o código de ativação gerado na retaguarda.
3. Instalar o **SM Bridge** (`apps/bridge/install/install-windows.ps1`) e apontar
   o endereço da impressora.
4. Testar: desconectar o cabo de rede e confirmar que o PDV **abre e vende**.

## Ligar a emissão fiscal (Focus NFe)

Enquanto `FISCAL_PROVIDER=fake`, as notas são simuladas — serve para treinar a
equipe sem emitir nada. A emissão de verdade é feita pela **Focus NFe**: o
certificado A1 fica custodiado lá, ela assina e transmite à SEFAZ, e nós nunca
tocamos em certificado nem em configuração da Receita.

### 1. No painel da Focus

1. Cadastre a empresa (**uma por CNPJ** — cada quiosque com CNPJ próprio é um
   cadastro separado, e cada um tem o seu token).
2. Suba o **certificado A1** da empresa e informe a senha dele.
3. Confira **CSC/Token IBPT de NFC-e** (código de segurança do contribuinte),
   emitido pela SEFAZ do estado. Sem ele a NFC-e não autoriza.
4. Copie o **token de homologação** e o **token de produção**. São diferentes.
5. Em *Gatilhos* (webhooks), registre a URL de retorno:

   ```
   https://soulmuscle.wideic.com/v1/webhooks/fiscal/focus?key=SEU_SEGREDO
   ```

   O `key` é o mesmo valor de `FISCAL_WEBHOOK_SECRET`. A Focus não assina a
   chamada — o segredo na URL é a proteção que ela própria recomenda, e a rota
   recusa (403) qualquer chamada sem ele.

### 2. No servidor

```env
FISCAL_PROVIDER=focus
FISCAL_ENVIRONMENT=2                  # 2 homologação, 1 produção
FOCUS_TOKEN=<token da empresa na Focus>
FISCAL_WEBHOOK_SECRET=<openssl rand -hex 24>
```

`docker compose -f docker-compose.prod.yml up -d app` para aplicar.

### 3. Validar em homologação antes de valer

Com `FISCAL_ENVIRONMENT=2`, faça **uma venda real no PDV** e acompanhe em
*Retaguarda → Fiscal*:

- a nota sai de `na fila` para `autorizada` em segundos;
- a chave de acesso tem 44 dígitos e o cupom imprime com QR Code;
- os links de XML e DANFE abrem.

Nota de homologação **não tem valor fiscal** — é exatamente por isso que ela é o
teste seguro. Só depois disso troque para `FISCAL_ENVIRONMENT=1` e o
`FOCUS_TOKEN` para o de produção (os dois juntos, sempre).

### Como se comporta quando algo dá errado

| Situação | O que acontece |
| --- | --- |
| Internet ou Focus fora do ar | A venda é concluída e a nota fica na fila; a fila reenvia sozinha com espera crescente. |
| Rejeição da SEFAZ que passa (108, 109, 110, 539, 999) | Volta para a fila automaticamente. |
| Erro de cadastro (NCM, CFOP, CSOSN errados) | A nota vai para `rejeitada` com o campo exato na mensagem — precisa de correção, não adianta reenviar. |
| Gatilho perdido | A fila reconsulta por conta própria; nenhuma nota fica presa por causa de um webhook que não chegou. |
| Reenvio de uma nota já autorizada | A referência enviada é o id do nosso documento — a Focus reconhece e devolve a nota existente, sem duplicar. |

## Atualizar

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

O PDV dos quiosques se atualiza sozinho: o service worker busca a versão nova e
troca na próxima abertura, sem visita técnica.

## Backup

```bash
crontab -e
0 3 * * * /caminho/soul-erp/erp/scripts/backup.sh >> /var/log/soul-backup.log 2>&1
```

Guarda 30 dias em `backups/` e falha em voz alta se o arquivo sair suspeito de
vazio. **Uma vez por mês, restaure o backup mais recente num banco de teste** —
backup que nunca foi restaurado não é backup.

```bash
gunzip -c backups/soul-erp-XXXX.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U soul -d soul_erp_teste
```

## Conferir que está tudo de pé

```bash
curl -fsS https://soulmuscle.wideic.com/v1/health     # {"status":"ok"}
docker compose -f docker-compose.prod.yml ps          # tudo "healthy"
```

Na retaguarda, o painel **Terminais** mostra quem está online, com fila de venda
ou de nota — é o primeiro lugar a olhar quando alguém reclamar.
