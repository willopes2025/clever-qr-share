import { createConnection } from 'node:net';
import { appendFileSync, closeSync, constants, openSync, writeSync } from 'node:fs';
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
  if (config.transport === 'file') return true;

  if (config.transport === 'tcp') {
    try {
      await sendOverTcp(config.host, config.port, Buffer.alloc(0));
      return true;
    } catch {
      return false;
    }
  }

  // Abrir e fechar sem escrever byte nenhum é o que diz se o dispositivo
  // existe e está livre. Sem isto o semáforo respondia "ok" para qualquer
  // coisa que não fosse rede — inclusive impressora desligada.
  try {
    closeSync(openDeviceForWrite(config.path));
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

/**
 * Abre uma porta COM, LPT ou fila de impressão para escrita.
 *
 * `O_WRONLY` sozinho — sem `O_CREAT` nem `O_TRUNC` — é o que o Windows traduz
 * para `OPEN_EXISTING`. Isso importa porque um dispositivo não pode ser criado
 * nem truncado: `writeFileSync` pede `CREATE_ALWAYS` e falha em todos os três
 * casos, mesmo com a impressora ligada e a porta livre.
 */
function openDeviceForWrite(path: string): number {
  return openSync(path, constants.O_WRONLY);
}

function sendToDevice(path: string, payload: Buffer): Promise<void> {
  let handle: number | undefined;
  try {
    handle = openDeviceForWrite(path);
    writeSync(handle, payload);
    return Promise.resolve();
  } catch (error) {
    // O código do erro (ENOENT, EACCES, EBUSY) é a diferença entre porta
    // errada, sem permissão e porta tomada por outro processo — quem instala
    // no balcão só vê a resposta do HTTP, então ele vai junto.
    const code = (error as NodeJS.ErrnoException | null)?.code;
    const detail = code ? ` (${code})` : '';
    return Promise.reject(new PrinterError(`Dispositivo ${path} indisponível${detail}`, error));
  } finally {
    if (handle !== undefined) {
      try {
        closeSync(handle);
      } catch {
        // Fechar já falhou depois da escrita ter ido: não muda o resultado.
      }
    }
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
