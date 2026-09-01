import { createConnection } from 'node:net';
import { appendFileSync, writeFileSync } from 'node:fs';
import type { PrinterConfig } from './config';

const CONNECT_TIMEOUT_MS = 3000;

export class PrinterError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = 'PrinterError';
  }
}

/**
 * Entrega os bytes à impressora.
 *
 * Três caminhos cobrem o parque real: impressora de rede (o mais comum no
 * balcão), dispositivo local (COM, LPT ou fila de impressão do Windows) e
 * arquivo — este último para desenvolvimento e para o teste automatizado.
 */
export async function sendToPrinter(config: PrinterConfig, payload: Buffer): Promise<void> {
  switch (config.transport) {
    case 'tcp':
      return sendOverTcp(config.host, config.port, payload);
    case 'device':
      return sendToDevice(config.path, payload);
    case 'file':
      return appendToFile(config.path, payload);
  }
}

/** Diz se a impressora está acessível, sem imprimir nada. */
export async function probePrinter(config: PrinterConfig): Promise<boolean> {
  if (config.transport !== 'tcp') return true;
  try {
    await sendOverTcp(config.host, config.port, Buffer.alloc(0));
    return true;
  } catch {
    return false;
  }
}

function sendOverTcp(host: string, port: number, payload: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    socket.setTimeout(CONNECT_TIMEOUT_MS);

    const fail = (reason: string) => (error?: Error) => {
      socket.destroy();
      reject(new PrinterError(`Impressora ${host}:${port} — ${reason}`, error));
    };

    socket.once('error', fail('falha de conexão'));
    socket.once('timeout', fail('não respondeu a tempo'));
    socket.once('connect', () => {
      if (payload.length === 0) {
        socket.end();
        resolve();
        return;
      }
      socket.end(payload, () => resolve());
    });
  });
}

function sendToDevice(path: string, payload: Buffer): Promise<void> {
  try {
    // Escrever no caminho do dispositivo é como o Windows fala com COM/LPT e
    // com uma fila de impressão compartilhada.
    writeFileSync(path, payload);
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(new PrinterError(`Dispositivo ${path} indisponível`, error));
  }
}

function appendToFile(path: string, payload: Buffer): Promise<void> {
  try {
    appendFileSync(path, payload);
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(new PrinterError(`Não foi possível escrever em ${path}`, error));
  }
}
