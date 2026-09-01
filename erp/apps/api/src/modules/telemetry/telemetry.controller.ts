import { Body, Controller, Get, Post } from '@nestjs/common';
import { heartbeatSchema, type HeartbeatInput } from '@soul/contracts';
import { Ctx } from '../../common/auth/decorators';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import type { RequestContext } from '../../common/tenancy/request-context';
import { TelemetryService } from './telemetry.service';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Post('heartbeat')
  async heartbeat(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(heartbeatSchema)) body: HeartbeatInput,
  ) {
    await this.telemetry.recordHeartbeat(ctx.tenantId, body);
    return { received: true };
  }

  @Get('terminals')
  terminals(@Ctx() ctx: RequestContext) {
    return this.telemetry.terminalHealth(ctx.tenantIds);
  }

  @Get('alerts')
  alerts(@Ctx() ctx: RequestContext) {
    return this.telemetry.openAlerts(ctx.tenantIds);
  }
}
