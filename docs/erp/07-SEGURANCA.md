# 07 · Segurança e Compliance

## 1. Modelo de ameaças (resumido)

| Ameaça | Impacto | Mitigação |
|--------|---------|-----------|
| Vazamento de dados entre tenants | **Crítico** — fim do produto de revenda | Isolamento em 2 camadas (app + RLS) + teste de invasão no CI |
| Fraude do operador (venda não registrada, sangria oculta) | Alto | Auditoria de tudo, conferência cega, alerta de padrão anômalo |
| Terminal roubado com dados offline | Médio | Dados locais cifrados, `deviceToken` revogável, expurgo remoto |
| Acesso indevido do suporte da revenda | Alto — quebra de confiança | Impersonation com motivo, prazo e visibilidade ao cliente |
| Manipulação de preço/estoque por usuário interno | Alto | Permissão granular + auditoria com antes/depois |
| Injeção via relatório dinâmico | Alto | Modelo semântico, zero SQL do usuário, timeout e limite de linhas |
| Falsificação de webhook fiscal | Alto | HMAC + allowlist de IP + idempotência por ID de evento |
| Roubo de credenciais | Alto | argon2id, refresh rotativo com detecção de reuso, TOTP para papéis altos |

## 2. Autenticação e sessão

- Senha com **argon2id**, mínimo 10 caracteres, verificação contra listas de senha vazada.
- **TOTP obrigatório** para `owner`, `admin` e `suporte` (revenda).
- Access token 15min; refresh 30d **rotativo** — reuso de refresh já usado invalida a família inteira
  de tokens e dispara alerta (sinal clássico de token roubado).
- **PIN do operador** (4–6 dígitos): só válido dentro de uma sessão de terminal pareado, com limite
  de 5 tentativas antes de exigir credencial de gerente. PIN nunca é credencial de API.
- Terminal pareado por código de ativação de uso único, gerado na retaguarda e válido por 15min.

## 3. Autorização

Permissão granular por ação, checada no servidor. O front esconde, o servidor bloqueia — e só o
segundo conta:

```typescript
@Post('sales/:id/cancel')
@RequiresPermission('sale.cancel')
@RequiresFeature('pos')
async cancel(@Param('id') id: string, @Body() dto: CancelSaleDto, @Ctx() ctx: RequestContext) {
  // ctx.tenantId vem do token — nunca do body ou da query
}
```

Permissões sensíveis que precisam existir desde o dia 1: `sale.cancel`, `sale.discount.above_limit`,
`cash.close`, `cash.withdrawal`, `product.cost.view`, `price.update`, `stock.adjust`,
`fiscal.cancel`, `report.export`, `user.manage`, `tenant.impersonate`.

## 4. Isolamento multi-tenant

Detalhado em [02 §8](./02-ARQUITETURA.md). Os controles inegociáveis:

1. `tenant_id` em toda tabela de negócio, **NOT NULL**.
2. RLS habilitada e **forçada** em todas elas.
3. A aplicação nunca usa role que ignora RLS — nem os workers, nem as migrations em runtime.
4. Suíte de testes tenta vazamento por 6 caminhos (rota REST, WebSocket, relatório, export,
   webhook, worker) e **precisa falhar nos 6**. Esse teste não pode ser marcado como `skip` — regra
   de revisão de PR.
5. Chaves de storage carregam o CNPJ no caminho, com política de bucket por prefixo.

## 5. Auditoria

Toda ação sensível grava em `audit_log`: quem, quando, de onde (IP e terminal), o quê, valor antes,
valor depois e motivo. A tabela é **append-only** — a role da aplicação não tem `UPDATE` nem
`DELETE` nela, garantido por permissão de banco, não por disciplina do time.

Eventos obrigatórios: login e falha de login · cancelamento de venda e de item · desconto acima do
limite · sangria e suprimento · fechamento com diferença · alteração de preço e de custo · ajuste de
estoque · cancelamento de nota · alteração de usuário e permissão · troca de plano · **toda
impersonation do suporte**.

O cliente enxerga a própria trilha, inclusive os acessos do suporte da revenda. Transparência aqui é
o que sustenta a confiança de quem entrega o faturamento inteiro do negócio ao sistema.

## 6. LGPD

**Papéis:** o cliente da revenda é o **controlador** dos dados dos consumidores dele; nós somos
**operador**. Isso precisa estar no contrato de licença, com cláusula de tratamento de dados.

| Dado | Finalidade | Base legal | Retenção |
|------|-----------|-----------|----------|
| CPF na nota | Obrigação fiscal | Obrigação legal | 5 anos |
| Cadastro do cliente (nome, telefone) | Fidelidade, delivery | Consentimento / execução de contrato | Enquanto ativo + 2 anos |
| Endereço de entrega | Delivery | Execução de contrato | 2 anos |
| Dados do funcionário (usuário) | Gestão de acesso | Execução de contrato | Vínculo + 5 anos |
| Telemetria do terminal | Operação e suporte | Legítimo interesse | 90 dias |

**Direitos do titular:** exportação em JSON/CSV, correção e eliminação (com preservação do que a
obrigação fiscal exige — a nota fiscal não se apaga, e isso precisa estar explicado na política).
Rotas: `GET /privacy/subject/{doc}/export` e `POST /privacy/subject/{doc}/erase`.

**Minimização:** o PDV não pede dado que não usa. CPF só quando o cliente quer na nota; telefone só
para fidelidade ou delivery.

## 7. Dados de cartão (PCI)

Nem na v1 (maquininha avulsa) nem na fase de TEF o sistema recebe PAN, CVV ou trilha. Guardamos
**apenas** NSU, código de autorização, bandeira, parcelas, valor e adquirente. O campo de número de
cartão **não existe no schema** — a melhor defesa é não ter onde guardar.

## 8. Segredos e criptografia

- Segredos em cofre gerenciado (AWS Secrets Manager / Doppler / Infisical), **nunca** em `.env` commitado.
- Rotação de chave de API do gateway fiscal a cada 6 meses.
- TLS 1.3 em tudo, inclusive no SM Bridge (certificado local próprio, pareado com o terminal).
- Dados locais do PDV (IndexedDB) cifrados com chave derivada do `deviceToken`, guardada no
  keystore do Windows via SM Bridge — máquina roubada não entrega o catálogo e as vendas do dia.
- Backup cifrado em repouso; restauração testada mensalmente ([10](./10-QUALIDADE-DEVOPS.md)).

## 9. Segurança da esteira

- `pnpm audit` + Dependabot/Renovate no CI; build falha em vulnerabilidade alta.
- SAST (CodeQL) e verificação de segredo (gitleaks) em todo PR.
- Imagens Docker escaneadas (Trivy); contêiner roda como usuário não-root.
- Deploy exige aprovação para produção; migração de banco revisada por segunda pessoa.
- Revisão de segurança obrigatória em PR que toque `iam`, `tenancy`, `fiscal` ou `payments`.

## 10. Resposta a incidente

1. **Detecção** — alerta automático ou relato do cliente.
2. **Contenção** — revogar token/sessão, suspender terminal, desligar feature por entitlement.
3. **Diagnóstico** — `traceId`, `audit_log` e logs estruturados.
4. **Comunicação** — cliente afetado em até 24h; ANPD quando houver dado pessoal, no prazo legal.
5. **Correção e post-mortem** sem culpados, com ação preventiva registrada.

Contato de segurança e runbook ficam no repositório de operações, não aqui.
