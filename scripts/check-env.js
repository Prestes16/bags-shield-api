
import { config, requireEnv, optionalEnv } from './utils/env.js';
import { log } from './utils/log.js';

function mask(value) {
  if (!value) return '(empty)';
  const s = String(value);
  if (s.length <= 6) return '*'.repeat(s.length);
  return `${s.slice(0, 3)}***${s.slice(-3)}`;
}

try {
  requireEnv('BAGS_API_KEY');

  log.info('Ambiente carregado com sucesso ✅');
  console.log(JSON.stringify({
    BAGS_SHIELD_BASE_URL: optionalEnv('BAGS_SHIELD_BASE_URL', '(default http://localhost:3000)'),
    BAGS_API_BASE_URL: config.apiBase,
    BAGS_APP_ID: config.appId,
    BAGS_ENV: config.env,
    BAGS_API_KEY: mask(config.apiKey),
  }, null, 2));
  process.exit(0);
} catch (err) {
  log.error(String(err?.message || err));
  process.exit(1);
}
