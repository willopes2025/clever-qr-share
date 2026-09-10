import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG, loadConfig } from './config';

const COM5 = { transport: 'device' as const, path: '\\\\.\\COM5' };

function writeConfigFile(contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'soul-bridge-')), 'bridge.json');
  writeFileSync(path, contents, 'utf8');
  return path;
}

describe('loadConfig', () => {
  it('lê a impressora escolhida por quem instalou', () => {
    const path = writeConfigFile(JSON.stringify({ printer: COM5 }));
    expect(loadConfig(path).printer).toEqual(COM5);
  });

  it('lê o arquivo mesmo gravado com BOM', () => {
    // O Bloco de Notas e o `Set-Content -Encoding UTF8` do PowerShell gravam
    // BOM. Sem tratá-lo, a configuração era descartada em silêncio e o agente
    // seguia mandando o cupom para a impressora de rede de fábrica.
    const path = writeConfigFile(`﻿${JSON.stringify({ printer: COM5 })}`);
    expect(loadConfig(path).printer).toEqual(COM5);
  });

  it('preenche o que o arquivo não trouxe', () => {
    const path = writeConfigFile(JSON.stringify({ printer: COM5 }));
    expect(loadConfig(path).port).toBe(DEFAULT_CONFIG.port);
  });

  it('cai no padrão quando o arquivo está corrompido', () => {
    const path = writeConfigFile('{ isto não é json');
    expect(loadConfig(path)).toEqual(DEFAULT_CONFIG);
  });
});
