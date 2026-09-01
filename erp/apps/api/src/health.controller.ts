import { Controller, Get } from '@nestjs/common';
import { Public } from './common/auth/decorators';
import { PrismaService } from './common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', at: new Date().toISOString() };
  }
}
