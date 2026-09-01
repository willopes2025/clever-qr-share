import { createBridgeServer, VERSION } from './server';
import { configPath, loadConfig } from './config';

/**
 * SM Bridge — agente local do PDV.
 *
 * Roda como serviço no computador do quiosque e é o único caminho entre a
 * página do PDV e os equipamentos do balcão: impressora térmica e gaveta.
 */
function main(): void {
  const path = configPath();
  const config = loadConfig(path);
  const server = createBridgeServer(config);

  // Só o próprio computador alcança o agente.
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`SM Bridge ${VERSION} em http://127.0.0.1:${config.port}`);
    console.log(`Configuração: ${path}`);
    console.log(`Impressora: ${describePrinter(config)}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function describePrinter(config: ReturnType<typeof loadConfig>): string {
  const printer = config.printer;
  if (printer.transport === 'tcp') return `rede ${printer.host}:${printer.port}`;
  return `${printer.transport} ${printer.path}`;
}

main();
