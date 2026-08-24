#!/usr/bin/env node
// Gera uma API key para a Public API + hash SHA-256 para inserir no banco.
// Uso: node scripts/generate-api-key.js

const crypto = require('crypto');

// Gera key aleatória: wz_live_ + 32 bytes hex
const rawKey = 'wz_live_' + crypto.randomBytes(24).toString('hex');

// Hash SHA-256
const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

// Prefix (primeiros 12 chars da key)
const prefix = rawKey.substring(0, 12);

console.log('');
console.log('=== API Key gerada ===');
console.log('');
console.log('Key (guarde! só aparece uma vez):');
console.log('  ' + rawKey);
console.log('');
console.log('Prefix para logs: ' + prefix);
console.log('');
console.log('Hash SHA-256 (para o banco):');
console.log('  ' + hash);
console.log('');
console.log('SQL para inserir (substitua user_id e organization_id):');
console.log('');
console.log(`INSERT INTO public.api_keys (user_id, organization_id, name, key_hash, key_prefix)`);
console.log(`VALUES (`);
console.log(`  'SEU_USER_ID_AQUI',`);
console.log(`  'SUA_ORG_ID_AQUI',`);
console.log(`  'Key de teste',`);
console.log(`  '${hash}',`);
console.log(`  '${prefix}'`);
console.log(`);`);
console.log('');
