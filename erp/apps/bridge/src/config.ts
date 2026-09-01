import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Configuração do agente, guardada em arquivo ao lado do executável.
 * Quem instala numa loja edita este arquivo — nada de recompilar por impressora.
 */
export interface BridgeConfig {
  port: number;
  /** Origens autorizadas a falar com o agente. Vazio bloqueia tudo, por segurança. */
  allowedOrigins: string[];
  printer: PrinterConfig;
  drawer: { enabled: boolean; pin: 2 | 5 };
  /** Largura do papel em colunas: 48 para 80mm, 32 para 58mm. */
  columns: number;
}

export type PrinterConfig =
  | { transport: 'tcp'; host: string; port: number }
  | { transport: 'device'; path: string }
  | { transport: 'file'; path: string };

export const DEFAULT_CONFIG: BridgeConfig = {
  port: 9123,
  allowedOrigins: ['https://soulmuscle.wideic.com', 'http://localhost:5173'],
  // Impressora de rede é o caso mais comum no balcão; trocar para 'device'
  // (\\\\.\\COM1 ou uma fila de impressão) quando for USB ou serial.
  printer: { transport: 'tcp', host: '192.168.0.100', port: 9100 },
  drawer: { enabled: true, pin: 2 },
  columns: 48,
};

export function configPath(): string {
  const base =
    process.env.SOUL_BRIDGE_CONFIG ??
    (process.platform === 'win32'
      ? join(process.env.PROGRAMDATA ?? 'C:\\ProgramData', 'SoulPDV', 'bridge.json')
      : join(process.env.HOME ?? '.', '.soul-pdv', 'bridge.json'));
  return base;
}

export function loadConfig(path = configPath()): BridgeConfig {
  if (!existsSync(path)) {
    // Primeira execução: grava o padrão para o instalador ter o que editar.
    saveConfig(DEFAULT_CONFIG, path);
    return DEFAULT_CONFIG;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<BridgeConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    // Arquivo corrompido não pode impedir o caixa de imprimir.
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: BridgeConfig, path = configPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}
