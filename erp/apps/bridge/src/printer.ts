import { createConnection } from 'node:net';
import { EscPosBuilder } from './escpos';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, closeSync, constants, openSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PrinterConfig } from './config';

const CONNECT_TIMEOUT_MS = 3000;

/**
 * Caracteres que o `cmd` interpreta em vez de tratar como nome. O caminho vem
 * do arquivo de configuração, que só o administrador da máquina escreve, mas
 * ele entra numa linha de comando — então a barreira fica aqui, explícita.
 */
const CMD_METACHARACTERS = /["&|<>^%\r\n]/;

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

  // Percorrer o mesmo caminho de uma impressão real é o que responde de
  // verdade se a porta abre — antes o semáforo dizia "ok" para qualquer coisa
  // que não fosse rede, inclusive impressora desligada. Vai o comando de
  // inicialização em vez de zero byte: ele não gasta papel, e um arquivo vazio
  // faz o `copy` do Windows reclamar mesmo com a impressora boa.
  try {
    await sendToDevice(config.path, new EscPosBuilder().init().build());
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
 * Entrega os bytes a uma porta COM, LPT ou fila de impressão do Windows.
 *
 * O `fs.open` do Node não abre caminho do namespace de dispositivo: `\\.\COM5`
 * devolve ENOENT mesmo com a porta existindo e livre, e é por isso que falar
 * com serial em Node costuma exigir binding nativo. O `copy` do próprio
 * Windows abre os três casos que este transporte atende, então o caminho é
 * gravar num arquivo temporário e deixar o sistema entregar.
 */
function sendViaWindowsCopy(path: string, payload: Buffer): void {
  if (CMD_METACHARACTERS.test(path)) {
    throw new Error('caminho da impressora tem caractere que o cmd interpreta');
  }

  const scratch = join(tmpdir(), `soul-bridge-${randomUUID()}.bin`);
  try {
    writeFileSync(scratch, payload);
    execFileSync('cmd', ['/c', `copy /b "${scratch}" "${path}"`], { stdio: 'ignore' });
  } finally {
    try {
      unlinkSync(scratch);
    } catch {
      // Sobrar um arquivo no temporário não justifica falhar a impressão.
    }
  }
}

/**
 * Escreve direto no dispositivo, para Linux e macOS.
 *
 * `O_WRONLY` sozinho — sem `O_CREAT` nem `O_TRUNC` — é o que virá
 * `OPEN_EXISTING`: um dispositivo não pode ser criado nem truncado, e
 * `writeFileSync` pede exatamente as duas coisas.
 */
function writeToDeviceFile(path: string, payload: Buffer): void {
  const handle = openSync(path, constants.O_WRONLY);
  try {
    writeSync(handle, payload);
  } finally {
    closeSync(handle);
  }
}

function sendToDevice(path: string, payload: Buffer): Promise<void> {
  try {
    if (process.platform === 'win32') sendViaWindowsCopy(path, payload);
    else writeToDeviceFile(path, payload);
    return Promise.resolve();
  } catch (error) {
    // O código do erro (ENOENT, EACCES, EBUSY) é a diferença entre porta
    // errada, sem permissão e porta tomada por outro processo — quem instala
    // no balcão só vê a resposta do HTTP, então ele vai junto.
    const code = (error as NodeJS.ErrnoException | null)?.code;
    const detail = code ? ` (${code})` : '';
    return Promise.reject(new PrinterError(`Dispositivo ${path} indisponível${detail}`, error));
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
