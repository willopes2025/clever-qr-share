import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundError } from '../../common/errors/domain-error';
import { expiresIn, type TokenPayload } from '../../common/auth/token-payload';
import { EntitlementsService } from '../tenancy/entitlements.service';

export interface AuthResult {
  accessToken: string;
  user: { id: string; name: string; tenantId: string; permissions: string[] };
}

export interface TerminalAuthResult {
  accessToken: string;
  terminal: { id: string; code: string; storeId: string; storeName: string; fiscalSeries: number };
}

/**
 * Dois tipos de sessão, de propósito:
 * - usuário (retaguarda), curta;
 * - terminal (PDV), longa e presa ao dispositivo pareado.
 * O operador entra por PIN *dentro* da sessão do terminal, o que permite trocar
 * de atendente em segundos e continuar funcionando offline.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async loginWithPassword(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.appUser.findFirst({
      where: { email, status: 'active' },
      include: { roles: { include: { role: true } } },
    });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      // Mesma resposta para usuário inexistente e senha errada: não entregamos pista.
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const permissions = collectPermissions(user.roles.map((link) => link.role.permissions));
    const { features } = await this.entitlements.resolve(user.tenantId);
    const tenantIds = await this.economicGroupTenants(user.tenantId);

    await this.prisma.appUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const payload: TokenPayload = {
      sub: user.id,
      kind: 'user',
      tenantId: user.tenantId,
      tenantIds,
      permissions,
      features,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, name: user.name, tenantId: user.tenantId, permissions },
    };
  }

  /** Pareamento do PDV: o terminal troca seu deviceToken por uma sessão longa. */
  async authenticateTerminal(deviceToken: string): Promise<TerminalAuthResult> {
    const terminal = await this.prisma.terminal.findUnique({
      where: { deviceToken },
      include: { store: true },
    });
    if (!terminal || terminal.status !== 'active') {
      throw new UnauthorizedException('Terminal não pareado ou inativo');
    }

    const { features } = await this.entitlements.resolve(terminal.tenantId);
    const payload: TokenPayload = {
      sub: terminal.id,
      kind: 'terminal',
      tenantId: terminal.tenantId,
      tenantIds: [terminal.tenantId],
      storeId: terminal.storeId,
      terminalId: terminal.id,
      permissions: ['sale.create', 'cash.open'],
      features,
    };

    return {
      accessToken: await this.jwt.signAsync(payload, { expiresIn: expiresIn(process.env.JWT_TERMINAL_TTL, '24h') }),
      terminal: {
        id: terminal.id,
        code: terminal.code,
        storeId: terminal.storeId,
        storeName: terminal.store.name,
        fiscalSeries: terminal.fiscalSeries,
      },
    };
  }

  /** Login do operador por PIN, já dentro de um terminal autenticado. */
  async verifyOperatorPin(tenantId: string, userId: string, pin: string): Promise<{ id: string; name: string; permissions: string[] }> {
    const user = await this.prisma.appUser.findFirst({
      where: { id: userId, tenantId, status: 'active' },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundError('operador', userId);
    if (!user.pinHash || !(await argon2.verify(user.pinHash, pin))) {
      throw new UnauthorizedException('PIN inválido');
    }
    return {
      id: user.id,
      name: user.name,
      permissions: collectPermissions(user.roles.map((link) => link.role.permissions)),
    };
  }

  private async economicGroupTenants(tenantId: string): Promise<string[]> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.economicGroupId) return [tenantId];
    const siblings = await this.prisma.tenant.findMany({
      where: { economicGroupId: tenant.economicGroupId },
      select: { id: true },
    });
    return siblings.map((sibling) => sibling.id);
  }
}

function collectPermissions(lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}
