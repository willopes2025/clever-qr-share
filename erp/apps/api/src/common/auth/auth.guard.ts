import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ForbiddenError } from '../errors/domain-error';
import { setContext, type RequestContext } from '../tenancy/request-context';
import { FEATURE_KEY, PERMISSIONS_KEY, PUBLIC_KEY } from './decorators';
import type { TokenPayload } from './token-payload';

/**
 * Porta de entrada única: valida o token, monta o contexto da requisição e
 * checa permissão e plano. Nenhuma rota lê tenantId do cliente.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const payload = await this.verify(request);

    this.assertPermissions(context, payload);
    this.assertFeature(context, payload);

    const requestContext: RequestContext = {
      tenantId: payload.tenantId,
      tenantIds: payload.tenantIds?.length ? payload.tenantIds : [payload.tenantId],
      userId: payload.kind === 'user' ? payload.sub : undefined,
      storeId: payload.storeId,
      terminalId: payload.terminalId,
      permissions: payload.permissions ?? [],
      features: payload.features ?? [],
    };

    // O escopo já foi aberto pelo middleware; aqui só o preenchemos.
    setContext(requestContext);
    return true;
  }

  private async verify(request: Request): Promise<TokenPayload> {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }
    try {
      return await this.jwt.verifyAsync<TokenPayload>(header.slice(7));
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }

  private assertPermissions(context: ExecutionContext, payload: TokenPayload): void {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return;

    const granted = payload.permissions ?? [];
    const missing = required.filter((permission) => !granted.includes(permission) && !granted.includes('*'));
    if (missing.length) {
      throw new ForbiddenError('PERMISSION_DENIED', 'Permissão insuficiente', { missing });
    }
  }

  private assertFeature(context: ExecutionContext, payload: TokenPayload): void {
    const feature = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return;

    if (!(payload.features ?? []).includes(feature)) {
      throw new ForbiddenError('FEATURE_NOT_IN_PLAN', 'Funcionalidade não incluída no plano contratado', {
        feature,
      });
    }
  }
}
