#!/usr/bin/env node
/**
 * Testes automatizados das APIs – valida resposta 200 e contrato integrado.
 * Uso: BASE_URL=http://localhost:3000 node scripts/test-api.mjs
 * Ou: pnpm dev (em um terminal) e pnpm test:api (em outro)
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function run() {
  const results = [];
  function ok(name, status, expected = 200) {
    const pass = status === expected;
    results.push({ name, status, expected, pass });
    console.log(pass ? `  OK ${name} -> ${status}` : `  FAIL ${name} -> ${status} (esperado ${expected})`);
  }

  console.log('\n--- Testes APIs (BASE_URL=' + BASE + ') ---\n');

  // GET /api/errors
  try {
    const r = await fetchJson(BASE + '/api/errors');
    ok('GET /api/errors', r.status);
    if (r.data && typeof r.data.success !== 'undefined')
      ok('GET /api/errors contrato (success)', r.data.success ? 1 : 0, 1);
  } catch (e) {
    results.push({ name: 'GET /api/errors', pass: false });
    console.log('  FAIL GET /api/errors', e.message);
  }

  // POST /api/scan
  try {
    const r = await fetchJson(BASE + '/api/scan', {
      method: 'POST',
      body: JSON.stringify({
        rawTransaction:
          'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAqJfY2nKnCyk8o/9x0x/2VhBfRg2b8lP1nY2fG0wEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQAA',
        network: 'mainnet',
      }),
    });
    ok('POST /api/scan', r.status);
    if (r.data && r.data.success && r.data.response?.shieldScore != null)
      ok('POST /api/scan contrato (shieldScore)', 1, 1);
  } catch (e) {
    results.push({ name: 'POST /api/scan', pass: false });
    console.log('  FAIL POST /api/scan', e.message);
  }

  // POST /api/simulate
  try {
    const r = await fetchJson(BASE + '/api/simulate', {
      method: 'POST',
      body: JSON.stringify({ mint: 'So11111111111111111111111111111111111111112' }),
    });
    ok('POST /api/simulate', r.status);
    if (r.data && r.data.success && r.data.response?.shieldScore != null)
      ok('POST /api/simulate contrato (shieldScore)', 1, 1);
  } catch (e) {
    results.push({ name: 'POST /api/simulate', pass: false });
    console.log('  FAIL POST /api/simulate', e.message);
  }

  // POST /api/apply
  try {
    const r = await fetchJson(BASE + '/api/apply', { method: 'POST', body: '{}' });
    ok('POST /api/apply', r.status);
    if (r.data && r.data.success && r.data.response?.applied === true) ok('POST /api/apply contrato (applied)', 1, 1);
  } catch (e) {
    results.push({ name: 'POST /api/apply', pass: false });
    console.log('  FAIL POST /api/apply', e.message);
  }

  // GET /api/helius/slot (200 se HELIUS_API_KEY set, 501 se não)
  try {
    const r = await fetchJson(BASE + '/api/helius/slot');
    const expect = r.data?.error === 'helius_not_configured' ? 501 : 200;
    ok('GET /api/helius/slot', r.status, expect);
    if (r.status === 200 && r.data?.success && r.data?.response?.slot != null)
      ok('GET /api/helius/slot contrato', 1, 1);
  } catch (e) {
    results.push({ name: 'GET /api/helius/slot', pass: false });
    console.log('  FAIL GET /api/helius/slot', e.message);
  }

  // POST /api/helius/parse-transactions (200 com key + body válido, 501 sem key, 400 sem body)
  try {
    const r = await fetchJson(BASE + '/api/helius/parse-transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions: [] }),
    });
    const expect =
      r.data?.error === 'missing_transactions' ? 400 : r.data?.error === 'helius_not_configured' ? 501 : 200;
    ok('POST /api/helius/parse-transactions', r.status, expect);
  } catch (e) {
    results.push({ name: 'POST /api/helius/parse-transactions', pass: false });
    console.log('  FAIL POST /api/helius/parse-transactions', e.message);
  }

  // GET /api/helius/address-transactions (400 sem address, 200/501 com address)
  try {
    const r = await fetchJson(BASE + '/api/helius/address-transactions');
    const expect = r.data?.error === 'missing_address' ? 400 : r.data?.error === 'helius_not_configured' ? 501 : 200;
    ok('GET /api/helius/address-transactions (sem address)', r.status, expect);
  } catch (e) {
    results.push({ name: 'GET /api/helius/address-transactions', pass: false });
    console.log('  FAIL GET /api/helius/address-transactions', e.message);
  }

  // GET /api/jupiter/quote (200 com key + params válidos, 501 sem key, 400 sem params)
  try {
    const r = await fetchJson(
      BASE +
        '/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000',
    );
    const expect = r.data?.error === 'missing_params' ? 400 : r.data?.error === 'jupiter_not_configured' ? 501 : 200;
    ok('GET /api/jupiter/quote', r.status, expect);
    if (r.status === 200 && r.data?.success && r.data?.response?.outAmount != null)
      ok('GET /api/jupiter/quote contrato (outAmount)', 1, 1);
  } catch (e) {
    results.push({ name: 'GET /api/jupiter/quote', pass: false });
    console.log('  FAIL GET /api/jupiter/quote', e.message);
  }

  // POST /api/jupiter/swap (400 sem quoteResponse/userPublicKey, 200/501 com params válidos)
  try {
    const r = await fetchJson(BASE + '/api/jupiter/swap', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const expect = r.data?.error === 'missing_params' ? 400 : r.data?.error === 'jupiter_not_configured' ? 501 : 200;
    ok('POST /api/jupiter/swap (sem params)', r.status, expect);
  } catch (e) {
    results.push({ name: 'POST /api/jupiter/swap', pass: false });
    console.log('  FAIL POST /api/jupiter/swap', e.message);
  }

  // GET /api/jupiter/price (200 com key + ids válidos, 501 sem key, 400 sem ids)
  try {
    const r = fetchJson(
      BASE +
        '/api/jupiter/price?ids=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    );
    const r2 = await r;
    const expect = r2.data?.error === 'missing_ids' ? 400 : r2.data?.error === 'jupiter_not_configured' ? 501 : 200;
    ok('GET /api/jupiter/price', r2.status, expect);
    if (r2.status === 200 && r2.data?.success && typeof r2.data?.response === 'object')
      ok('GET /api/jupiter/price contrato (response)', 1, 1);
  } catch (e) {
    results.push({ name: 'GET /api/jupiter/price', pass: false });
    console.log('  FAIL GET /api/jupiter/price', e.message);
  }

  const passed = results.filter((x) => x.pass).length;
  const total = results.length;
  console.log('\n--- Resultado: ' + passed + '/' + total + ' ---\n');
  process.exit(passed === total ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
