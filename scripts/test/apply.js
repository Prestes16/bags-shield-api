import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from '../utils/env.js';
import { http } from '../utils/http.js';
import { log } from '../utils/log.js';

const payloadPath = resolve(process.cwd(), 'scripts/payloads/apply.json');
const payload = JSON.parse(readFileSync(payloadPath, 'utf8'));
const url = `${config.baseUrl}/api/apply`;

try {
  log.info('POST /api/apply', payload);
  const res = await http.post(url, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'X-Bags-API-Key': config.apiKey,
    },
    body: payload,
  });
  console.log('STATUS:', res.status);
  console.log('BODY  :', JSON.stringify(res.data, null, 2));
  if (!res.ok) process.exit(1);
  process.exit(0);
} catch (e) {
  log.error('Falha em /api/apply', e);
  process.exit(1);
}


