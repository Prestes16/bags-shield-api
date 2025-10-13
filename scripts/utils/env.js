import { loadDotenv } from './dotenv.js';

const loaded = loadDotenv('.env.local');
for (const [k, v] of Object.entries(loaded)) {
  if (process.env[k] == null) process.env[k] = v;
}

export function requireEnv(key) {
  const val = process.env[key];
  if (!val || `${val}`.trim() === '') {
    throw new Error(`Missing required env: ${key}`);
  }
  return val;
}

export function optionalEnv(key, fallback = undefined) {
  const val = process.env[key];
  return (val == null || `${val}`.trim() === '') ? fallback : val;
}

export const config = {
  baseUrl: optionalEnv('BAGS_SHIELD_BASE_URL', 'http://localhost:3000'),
  apiKey: requireEnv('BAGS_API_KEY'),
  apiBase: optionalEnv('BAGS_API_BASE_URL', 'https://api.bags.fm'),
  appId: optionalEnv('BAGS_APP_ID', 'bags-shield'),
  env: optionalEnv('BAGS_ENV', 'devnet'), // devnet | mainnet
};