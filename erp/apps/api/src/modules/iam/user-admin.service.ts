import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain-error';
import { EntitlementsService } from '../tenancy/entitlements.service';

export interface SaveUserInput {
  name: string;
  email?: string | null;
  password?: string | null;
  pin?: string | null;
  roleCode: string;
  storeId?: string | null;
  status?: 'active' | 'inactive';
}

/**
 * Usuários da loja.
 *
 * Dois tipos convivem: quem entra na retaguarda por e-mail e senha, e quem só
 * opera o caixa por PIN. O mesmo cadastro serve aos dois — o que muda é qual
 * credencial existe.
 */
@Injectable()
export class UserAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(tenantId: string) {
    const users = await this.prisma.appUser.findMany({
      where: { tenantId },
      include: { roles: { include: { role: true } } },
      orderBy: { name: 'asc' },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      hasPin: Boolean(user.pinHash),
      hasPassword: Boolean(user.passwordHash),
      roles: user.roles.map((link) => ({ code: link.role.code, name: link.role.name, storeId: link.storeId })),
    }));
  }

  async roles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
  }

  async create(tenantId: string, input: SaveUserInput) {
    const active = await this.prisma.appUser.count({ where: { tenantId, status: 'active' } });
    await this.entitlements.assertWithinLimit(tenantId, 'users', active);

    if (input.email) await this.assertEmailAvailable(tenantId, input.email);
    const role = await this.requireRole(tenantId, input.roleCode);

    const user = await this.prisma.appUser.create({
      data: {
        tenantId,
        name: input.name,
        email: input.email ?? null,
        passwordHash: input.password ? await argon2.hash(input.password) : null,
        pinHash: input.pin ? await argon2.hash(input.pin) : null,
        roles: { create: { roleId: role.id, storeId: input.storeId ?? null } },
      },
    });
    return { id: user.id };
  }

  async update(tenantId: string, userId: string, input: SaveUserInput) {
    const user = await this.prisma.appUser.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundError('usuário', userId);

    if (input.email && input.email !== user.email) {
      await this.assertEmailAvailable(tenantId, input.email);
    }
    const role = await this.requireRole(tenantId, input.roleCode);

    await this.prisma.$transaction(async (tx) => {
      await tx.appUser.update({
        where: { id: userId },
        data: {
          name: input.name,
          email: input.email ?? null,
          status: input.status ?? user.status,
          // Senha e PIN em branco significam "não mexer": a retaguarda não
          // reescreve credencial que ninguém pediu para trocar.
          ...(input.password ? { passwordHash: await argon2.hash(input.password) } : {}),
          ...(input.pin ? { pinHash: await argon2.hash(input.pin) } : {}),
        },
      });

      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.create({ data: { userId, roleId: role.id, storeId: input.storeId ?? null } });
    });

    return { id: userId };
  }

  private async requireRole(tenantId: string, code: string) {
    const role = await this.prisma.role.findFirst({
      where: { code, OR: [{ tenantId }, { tenantId: null }] },
    });
    if (!role) throw new NotFoundError('papel', code);
    return role;
  }

  private async assertEmailAvailable(tenantId: string, email: string): Promise<void> {
    const taken = await this.prisma.appUser.findFirst({ where: { tenantId, email } });
    if (taken) throw new ConflictError('EMAIL_IN_USE', 'Já existe um usuário com este e-mail');
  }
}
