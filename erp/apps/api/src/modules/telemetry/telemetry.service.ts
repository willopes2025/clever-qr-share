import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { HeartbeatInput, TerminalAlertKind } from '@soul/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';

interface AlertRule {
  kind: TerminalAlertKind;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

const OFFLINE_AFTER_MINUTES = 15;
const UNSYNCED_AFTER_MINUTES = 30;

/**
 * Saúde do PDV.
 *
 * O dono precisa saber que o quiosque parou antes do cliente reclamar — por isso
 * telemetria aqui é funcionalidade de produto, não item de infraestrutura.
 */
@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordHeartbeat(tenantId: string, input: HeartbeatInput): Promise<void> {
    const fiscalQueue = await this.prisma.fiscalDocument.count({
      where: { tenantId, status: 'queued' },
    });

    await this.prisma.$transaction([
      this.prisma.terminalHeartbeat.create({
        data: {
          tenantId,
          terminalId: input.terminalId,
          appVersion: input.appVersion,
          bridgeVersion: input.bridgeVersion,
          pendingSales: input.pendingSales,
          fiscalQueue,
          printerOk: input.printerOk,
          scaleOk: input.scaleOk,
          lastSaleAt: input.lastSaleAt ? new Date(input.lastSaleAt) : null,
        },
      }),
      this.prisma.terminal.update({
        where: { id: input.terminalId },
        data: { lastSeenAt: new Date(), appVersion: input.appVersion },
      }),
    ]);

    await this.evaluateDeviceAlerts(tenantId, input);
  }

  /** Fotografia do parque de terminais — alimenta o painel do dono. */
  async terminalHealth(tenantIds: string[]) {
    const terminals = await this.prisma.terminal.findMany({
      where: { tenantId: { in: tenantIds } },
      include: {
        store: { select: { name: true } },
        heartbeats: { orderBy: { at: 'desc' }, take: 1 },
        alerts: { where: { resolvedAt: null } },
      },
    });

    const now = Date.now();
    return terminals.map((terminal) => {
      const last = terminal.heartbeats[0];
      const minutesSinceSeen = terminal.lastSeenAt
        ? Math.floor((now - terminal.lastSeenAt.getTime()) / 60_000)
        : null;

      return {
        id: terminal.id,
        code: terminal.code,
        store: terminal.store.name,
        online: minutesSinceSeen !== null && minutesSinceSeen < OFFLINE_AFTER_MINUTES,
        lastSeenAt: terminal.lastSeenAt,
        minutesSinceSeen,
        appVersion: terminal.appVersion,
        pendingSales: last?.pendingSales ?? 0,
        fiscalQueue: last?.fiscalQueue ?? 0,
        printerOk: last?.printerOk ?? null,
        scaleOk: last?.scaleOk ?? null,
        openAlerts: terminal.alerts.map((alert) => ({
          kind: alert.kind,
          severity: alert.severity,
          openedAt: alert.openedAt,
        })),
      };
    });
  }

  async openAlerts(tenantIds: string[]) {
    return this.prisma.terminalAlert.findMany({
      where: { tenantId: { in: tenantIds }, resolvedAt: null },
      include: { terminal: { include: { store: { select: { name: true } } } } },
      orderBy: { openedAt: 'desc' },
    });
  }

  /** Varredura periódica: pega o terminal que simplesmente parou de falar. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepSilentTerminals(): Promise<void> {
    const threshold = new Date(Date.now() - OFFLINE_AFTER_MINUTES * 60_000);
    const silent = await this.prisma.terminal.findMany({
      where: { status: 'active', OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }] },
    });

    for (const terminal of silent) {
      await this.raise(terminal.tenantId, terminal.id, {
        kind: 'offline',
        severity: 'critical',
        message: `Terminal ${terminal.code} sem comunicação há mais de ${OFFLINE_AFTER_MINUTES} minutos`,
      });
    }
  }

  private async evaluateDeviceAlerts(tenantId: string, input: HeartbeatInput): Promise<void> {
    await this.resolve(tenantId, input.terminalId, 'offline');

    const rules: Array<[boolean, AlertRule]> = [
      [
        input.printerOk === false,
        { kind: 'printer_down', severity: 'warning', message: 'Impressora não respondeu' },
      ],
      [
        input.scaleOk === false,
        // Em quiosque que vende no peso, balança fora é perda de venda direta.
        { kind: 'scale_down', severity: 'critical', message: 'Balança não respondeu' },
      ],
      [
        input.pendingSales > 0 && isStale(input.lastSaleAt, UNSYNCED_AFTER_MINUTES),
        {
          kind: 'unsynced_sales',
          severity: 'critical',
          message: `${input.pendingSales} venda(s) sem sincronizar`,
        },
      ],
    ];

    for (const [triggered, rule] of rules) {
      if (triggered) await this.raise(tenantId, input.terminalId, rule);
      else await this.resolve(tenantId, input.terminalId, rule.kind);
    }
  }

  private async raise(tenantId: string, terminalId: string, rule: AlertRule): Promise<void> {
    const open = await this.prisma.terminalAlert.findFirst({
      where: { tenantId, terminalId, kind: rule.kind, resolvedAt: null },
    });
    // Alerta que já está aberto não vira dez alertas iguais.
    if (open) return;

    await this.prisma.terminalAlert.create({
      data: {
        tenantId,
        terminalId,
        kind: rule.kind,
        severity: rule.severity,
        details: { message: rule.message },
      },
    });
    this.logger.warn(`[${rule.severity}] ${rule.message} (terminal ${terminalId})`);
  }

  private async resolve(tenantId: string, terminalId: string, kind: TerminalAlertKind): Promise<void> {
    await this.prisma.terminalAlert.updateMany({
      where: { tenantId, terminalId, kind, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  }
}

function isStale(timestamp: string | null, minutes: number): boolean {
  if (!timestamp) return true;
  return Date.now() - new Date(timestamp).getTime() > minutes * 60_000;
}
