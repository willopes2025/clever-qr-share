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

## Trocar o provedor fiscal

Enquanto `FISCAL_PROVIDER=fake`, as notas são simuladas — serve para treinar a
equipe sem emitir nada. Ao contratar o provedor:

```env
FISCAL_PROVIDER=plugnotas       # ou o adaptador contratado
FISCAL_ENVIRONMENT=2            # 2 homologação, 1 produção
FISCAL_BASE_URL=https://...
FISCAL_API_KEY=...
```

Suba o certificado A1 no painel do provedor, emita **uma nota em homologação** e
só então mude para `FISCAL_ENVIRONMENT=1`.

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
