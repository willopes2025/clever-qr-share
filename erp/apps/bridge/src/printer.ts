import { createConnection } from 'node:net';
import { EscPosBuilder } from './escpos';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, closeSync, constants, openSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PrinterConfig } from './config';

const CONNECT_TIMEOUT_MS = 3000;

/**
 * O caminho da impressora entra numa linha de comando sem aspas, então só
 * passa o que não muda o sentido dela: nada de espaço, e nada que o `cmd`
 * interprete. Quem escreve o arquivo de configuração é o administrador da
 * máquina, mas a barreira fica aqui, explícita.
 */
const UNSAFE_IN_COMMAND_LINE = /[\s"&|<>^%()]/;

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
 * Entrega os bytes ao destino no Windows: porta COM, LPT ou fila de impressão.
 *
 * O redirecionamento do `cmd` é o único mecanismo que alcança os três. O
 * `fs.open` do Node não abre o namespace de dispositivo — `\\.\COM5` devolve
 * ENOENT com a porta livre e listada em `GetPortNames`, e é por isso que falar
 * com serial em Node costuma exigir binding nativo. E o `copy` trata uma fila
 * compartilhada como pasta, tentando criar um arquivo dentro dela. Já o `>`
 * abre o caminho em si, que é o que a porta e a fila esperam.
 */
function sendViaCmdRedirect(path: string, payload: Buffer): void {
  if (UNSAFE_IN_COMMAND_LINE.test(path)) {
    throw new Error(`caminho da impressora inválido para a linha de comando: ${path}`);
  }

  const scratch = join(tmpdir(), `soul-bridge-${randomUUID()}.bin`);
  try {
    writeFileSync(scratch, payload);
    // `execSync` e não `execFileSync`: o segundo reescapa os argumentos com
    // barra invertida antes de chamar o `cmd`, que usa outra convenção — a
    // linha chegava deformada e o `cmd` recusava, sem erro de sistema para
    // mostrar. O destino vai sem aspas porque é assim que a porta e a fila
    // aceitam o redirecionamento.
    execSync(`type "${scratch}" > ${path}`, { stdio: 'ignore', windowsHide: true });
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
 * `O_WRONLY` sozinho — sem `O_CREAT` nem `O_TRUNC` — é o que vira
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
    if (process.platform === 'win32') sendViaCmdRedirect(path, payload);
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
