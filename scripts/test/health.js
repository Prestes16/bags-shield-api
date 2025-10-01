import { config } from '../utils/env.js';
import { http } from '../utils/http.js';
import { log } from '../utils/log.js';

const url = `${config.baseUrl}/api/health`;

try {
  log.info('Verificando saúde da API…', url);
  const res = await http.get(url);
  console.log('STATUS:', res.status);
  console.log('BODY  :', JSON.stringify(res.data, null, 2));
  if (!res.ok) process.exit(1);
  process.exit(0);
} catch (e) {
  log.error('Falha ao verificar /api/health', e);
  process.exit(1);
}
