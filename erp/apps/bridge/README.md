# SM Bridge

Agente local do PDV. Roda no computador do quiosque e é o único caminho entre a página do PDV,
servida pela nuvem, e os equipamentos do balcão: **impressora térmica** e **gaveta de dinheiro**.

Existe porque o navegador não fala ESC/POS nem aciona gaveta. Sem ele o PDV vende, mas não imprime.

## Como funciona

```
PDV (navegador)  ──HTTP──►  SM Bridge (127.0.0.1:9123)  ──►  impressora / gaveta
```

- Escuta **apenas em 127.0.0.1**: nada fora do computador alcança a impressora.
- A origem do PDV é verificada contra a lista do arquivo de configuração.
- É HTTP, não HTTPS: o navegador trata `localhost` como origem segura, então a página em HTTPS
  conversa com o agente sem precisar de certificado autoassinado — que viraria um problema de
  instalação em cada loja, sem ganho real de segurança.
- Sem dependências de terceiros: só a biblioteca padrão do Node. Num computador de quiosque, leve e
  previsível vale mais que conveniente.

## Endpoints

| Método | Rota | Uso |
|--------|------|-----|
| `GET` | `/health` | Estado do agente e da impressora — o PDV usa para o semáforo do terminal |
| `GET` | `/version` | Versão instalada |
| `POST` | `/print/receipt` | Imprime o cupom da venda |
| `POST` | `/print/test` | Impressão de teste, usada na instalação |
| `POST` | `/drawer/open` | Abre a gaveta |

## Configuração

Fica em `%ProgramData%\SoulPDV\bridge.json` (Windows) ou `~/.soul-pdv/bridge.json`, e é criada com
os padrões na primeira execução.

```jsonc
{
  "port": 9123,
  "allowedOrigins": ["https://soulmuscle.wideic.com"],
  "printer": { "transport": "tcp", "host": "192.168.0.100", "port": 9100 },
  "drawer": { "enabled": true, "pin": 2 },
  "columns": 48
}
```

**Transporte da impressora** — três caminhos cobrem o parque real:

| Transporte | Quando usar | Exemplo |
|-----------|-------------|---------|
| `tcp` | Impressora de rede — o caso mais comum no balcão | `{ "transport": "tcp", "host": "192.168.0.100", "port": 9100 }` |
| `device` | USB, serial ou fila de impressão do Windows | `{ "transport": "device", "path": "\\\\.\\COM1" }` |
| `file` | Desenvolvimento e teste automatizado | `{ "transport": "file", "path": "/tmp/cupom.bin" }` |

`columns` é a largura do papel: **48** para bobina de 80mm, **32** para 58mm.

## Instalação na loja

```powershell
powershell -ExecutionPolicy Bypass -File install\install-windows.ps1
```

O script copia o agente, cria a configuração, registra como serviço do Windows (sobe junto com o
computador) e confere que respondeu. Depois: ajustar o endereço da impressora no arquivo de
configuração e rodar o teste de impressão.

> **Pendente:** empacotar num executável único, para dispensar o Node instalado na máquina.
> Hoje o serviço roda com o Node LTS do computador.

## Desenvolvimento

```bash
npm run dev -w @soul/bridge      # sobe o agente
npm run test -w @soul/bridge     # testes de layout do cupom e de comandos ESC/POS
```

Para desenvolver sem impressora, use o transporte `file` e leia o cupom gerado:

```bash
SOUL_BRIDGE_CONFIG=./bridge.dev.json npm run dev -w @soul/bridge
curl -X POST http://127.0.0.1:9123/print/test
```
