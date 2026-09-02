import { Injectable, Logger } from '@nestjs/common';
import type {
  FiscalEventResult,
  FiscalIssueInput,
  FiscalIssueResult,
  FiscalProvider,
} from '../fiscal-provider';
import { buildNfcePayload, describeRejection, parseFocusResponse } from './focus-mapping';

const PRODUCTION_URL = 'https://api.focusnfe.com.br';
const SANDBOX_URL = 'https://homologacao.focusnfe.com.br';
const TIMEOUT_MS = 20_000;

/**
 * Adaptador da Focus NFe.
 *
 * A Focus recebe a nota, assina com o certificado que está custodiado lá e
 * transmite à SEFAZ. Autenticação é HTTP Basic com o token no lugar do usuário
 * e senha vazia.
 *
 * A emissão é assíncrona por natureza: a Focus responde `processando_autorizacao`
 * e conclui depois. Duas coisas cobrem isso — o webhook (gatilho) que ela chama
 * quando termina, e a nossa própria fila, que reconsulta. Um é a garantia do
 * outro: se o webhook não chegar, a fila resolve.
 */
@Injectable()
export class FocusNfeProvider implements FiscalProvider {
  readonly name = 'focus';
  private readonly logger = new Logger(FocusNfeProvider.name);

  private get baseUrl(): string {
    // FOCUS_BASE_URL existe para apontar a um dublê em teste; em produção fica vazio
    // e o ambiente fiscal é quem decide entre homologação e produção.
    const override = process.env.FOCUS_BASE_URL?.trim();
    if (override) return override.replace(/\/$/, '');
    return Number(process.env.FISCAL_ENVIRONMENT ?? 2) === 1 ? PRODUCTION_URL : SANDBOX_URL;
  }

  private get token(): string {
    const token = process.env.FOCUS_TOKEN ?? process.env.FISCAL_API_KEY ?? '';
    if (!token) throw new Error('FOCUS_TOKEN não configurado');
    return token;
  }

  async issue(input: FiscalIssueInput): Promise<FiscalIssueResult> {
    // A referência é o id do nosso documento: reenviar não gera nota duplicada.
    const ref = input.documentId;
    const { status, body } = await this.request('POST', `/v2/nfce?ref=${ref}`, buildNfcePayload(input));

    // 422 com a nota já autorizada não é erro: é o reenvio encontrando o que já existe.
    if (status === 422 && body?.codigo === 'nfe_autorizada') {
      return this.status(ref);
    }

    if (status >= 500) {
      // Indisponibilidade do gateway volta para a fila em vez de virar rejeição.
      return {
        status: 'rejected',
        providerRef: ref,
        rejection: { code: `HTTP_${status}`, message: 'Focus NFe indisponível', retryable: true },
      };
    }

    return parseFocusResponse(body, this.baseUrl, ref);
  }

  async status(ref: string): Promise<FiscalIssueResult> {
    const { body } = await this.request('GET', `/v2/nfce/${ref}`);
    return parseFocusResponse(body, this.baseUrl, ref);
  }

  async cancel(ref: string, reason: string): Promise<FiscalEventResult> {
    if (reason.trim().length < 15) {
      return { status: 'rejected', message: 'A justificativa de cancelamento exige 15 caracteres' };
    }

    const { status, body } = await this.request('DELETE', `/v2/nfce/${ref}`, { justificativa: reason });
    if (status >= 400) {
      return { status: 'rejected', message: describeRejection(body ?? {}) };
    }
    return { status: 'accepted', protocol: body?.protocolo ?? body?.numero_protocolo };
  }

  private async request(
    method: string,
    path: string,
    payload?: unknown,
  ): Promise<{ status: number; body: any }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          // A Focus autentica com o token no usuário e a senha em branco.
          authorization: `Basic ${Buffer.from(`${this.token}:`).toString('base64')}`,
          'content-type': 'application/json',
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      const body = text ? safeParse(text) : null;

      if (response.status >= 400) {
        this.logger.warn(`Focus NFe ${method} ${path} → ${response.status}: ${text.slice(0, 300)}`);
      }
      return { status: response.status, body };
    } catch (error) {
      // Timeout e falha de rede são temporários: viram rejeição reenviável.
      this.logger.error(`Falha ao falar com a Focus NFe: ${(error as Error).message}`);
      return { status: 503, body: { codigo: 'NETWORK', mensagem: (error as Error).message } };
    } finally {
      clearTimeout(timer);
    }
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { mensagem: text };
  }
}
