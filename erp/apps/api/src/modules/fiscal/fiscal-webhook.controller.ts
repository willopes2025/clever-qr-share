import { Body, Controller, ForbiddenException, Param, Post, Query } from '@nestjs/common';
import { Public } from '../../common/auth/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FiscalService } from './fiscal.service';
import { parseFocusResponse } from './providers/focus-mapping';

/**
 * Retorno do provedor fiscal.
 *
 * A Focus chama esta rota (o "gatilho") quando a nota termina de processar, em
 * vez de nos deixar perguntando. Não é a única garantia: a fila continua
 * reconsultando por conta própria, então um webhook perdido não deixa nota presa.
 *
 * A Focus não assina a chamada, então a proteção é o segredo no próprio
 * endereço configurado no painel dela — o mesmo mecanismo que ela recomenda.
 */
@Controller('webhooks/fiscal')
export class FiscalWebhookController {
  constructor(
    private readonly fiscal: FiscalService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('focus')
  async focus(@Query('key') key: string, @Body() body: Record<string, any>) {
    this.assertSecret(key);

    // A referência que mandamos na emissão é o id do nosso documento.
    const ref = String(body?.ref ?? '');
    if (!ref) return { received: true, ignored: 'sem referência' };

    const document = await this.prisma.fiscalDocument.findUnique({ where: { id: ref } });
    if (!document) return { received: true, ignored: 'documento desconhecido' };

    const baseUrl =
      Number(process.env.FISCAL_ENVIRONMENT ?? 2) === 1
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br';

    await this.fiscal.applyProviderResult(ref, parseFocusResponse(body, baseUrl, ref));
    return { received: true };
  }

  @Public()
  @Post(':provider')
  async unknown(@Param('provider') provider: string) {
    // Responder 200 evita que o provedor entre em tempestade de reenvio.
    return { received: true, ignored: `provedor ${provider} não configurado` };
  }

  private assertSecret(key: string): void {
    const expected = process.env.FISCAL_WEBHOOK_SECRET;
    if (!expected) throw new ForbiddenException('Webhook fiscal não configurado');
    if (key !== expected) throw new ForbiddenException('Segredo inválido');
  }
}
