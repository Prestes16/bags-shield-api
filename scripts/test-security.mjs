#!/usr/bin/env node
/**
 * Testes de Segurança - Military Grade
 *
 * Testa:
 * 1. Rate Limiting
 * 2. Parameter Pollution
 * 3. Method Filtering
 * 4. RPC Proxy
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
  return { status: res.status, data, text };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  const results = [];

  function record(name, status, expected, details = '') {
    const pass = status === expected;
    results.push({ name, status, expected, pass, details });
    const icon = pass ? '✅' : '❌';
    console.log(`${icon} ${name} -> ${status} ${details ? `(${details})` : ''}`);
  }

  console.log('\n🔒 TESTES DE SEGURANÇA - MILITARY GRADE\n');
  console.log(`Base URL: ${BASE}\n`);

  // ========================================================================
  // 1. Teste de Rate Limiting
  // ========================================================================
  console.log('1️⃣ Testando Rate Limiting (11 requisições rápidas)...\n');

  const rateLimitRequests = [];
  for (let i = 1; i <= 11; i++) {
    rateLimitRequests.push(
      fetchJson(`${BASE}/api/scan`, {
        method: 'POST',
        body: JSON.stringify({
          rawTransaction:
            'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAqJfY2nKnCyk8o/9x0x/2VhBfRg2b8lP1nY2fG0wEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQAA',
        }),
      }),
    );
  }

  const rateLimitResponses = await Promise.all(rateLimitRequests);

  // Primeiras 10 devem ser 200 ou 400 (validação), mas não 429
  const first10 = rateLimitResponses.slice(0, 10);
  const last1 = rateLimitResponses[10];

  const first10Ok = first10.every((r) => r.status !== 429);
  const last1RateLimited = last1.status === 429;

  record(
    'Rate Limiting (primeiras 10 requisições)',
    first10Ok ? 200 : 429,
    200,
    `${first10.filter((r) => r.status !== 429).length}/10 passaram`,
  );

  record('Rate Limiting (11ª requisição bloqueada)', last1.status, 429, last1.data?.error || 'sem erro');

  if (last1.status === 429) {
    console.log(`   ✅ Rate limit funcionando! Headers:`);
    console.log(`      X-RateLimit-Limit: ${last1.data?.meta?.rateLimitLimit || 'N/A'}`);
    console.log(`      Retry-After: ${last1.data?.retryAfter || 'N/A'}s\n`);
  }

  // Aguardar um pouco antes do próximo teste
  await sleep(2000);

  // ========================================================================
  // 2. Teste de Parameter Pollution
  // ========================================================================
  console.log('2️⃣ Testando Parameter Pollution (campo extra)...\n');

  try {
    const pollutionRes = await fetchJson(`${BASE}/api/rpc-proxy`, {
      method: 'POST',
      body: JSON.stringify({
        method: 'getHealth',
        params: [],
        malicious: 'attack', // Campo extra (deve ser rejeitado)
      }),
    });

    // Deve retornar erro de validação (400) por causa do campo extra
    const isRejected =
      pollutionRes.status === 400 &&
      (pollutionRes.data?.error === 'validation_error' || pollutionRes.data?.message?.includes('Validação'));

    record(
      'Parameter Pollution (campo extra rejeitado)',
      pollutionRes.status,
      400,
      isRejected ? 'campo extra rejeitado corretamente' : pollutionRes.data?.error || 'não rejeitado',
    );
  } catch (e) {
    record('Parameter Pollution', 0, 400, e.message);
  }

  // ========================================================================
  // 3. Teste de Method Filtering
  // ========================================================================
  console.log('\n3️⃣ Testando Method Filtering (PUT bloqueado)...\n');

  try {
    const putRes = await fetchJson(`${BASE}/api/scan`, {
      method: 'PUT',
    });

    record('Method Filtering (PUT bloqueado)', putRes.status, 405, putRes.data?.error || 'sem erro');

    if (putRes.status === 405) {
      console.log(`   ✅ Método PUT bloqueado corretamente!\n`);
    }
  } catch (e) {
    record('Method Filtering', 0, 405, e.message);
  }

  // ========================================================================
  // 4. Teste de RPC Proxy
  // ========================================================================
  console.log('4️⃣ Testando RPC Proxy (getHealth)...\n');

  try {
    const rpcRes = await fetchJson(`${BASE}/api/rpc-proxy`, {
      method: 'POST',
      body: JSON.stringify({
        method: 'getHealth',
        params: [],
      }),
    });

    if (rpcRes.status === 200 && rpcRes.data?.success) {
      record('RPC Proxy (getHealth)', 200, 200, `resultado: ${rpcRes.data.response || 'ok'}`);
      console.log(`   ✅ RPC Proxy funcionando! Chave nunca exposta ao cliente.\n`);
    } else if (rpcRes.status === 501) {
      record('RPC Proxy (getHealth)', 501, 200, 'HELIUS_API_KEY não configurada (esperado em dev)');
    } else {
      record('RPC Proxy (getHealth)', rpcRes.status, 200, rpcRes.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('RPC Proxy', 0, 200, e.message);
  }

  // ========================================================================
  // 5. Teste de Security Headers
  // ========================================================================
  console.log('5️⃣ Testando Security Headers...\n');

  try {
    const headersRes = await fetch(`${BASE}/api/scan`, {
      method: 'OPTIONS',
    });

    const headers = {
      'x-content-type-options': headersRes.headers.get('x-content-type-options'),
      'x-frame-options': headersRes.headers.get('x-frame-options'),
      'referrer-policy': headersRes.headers.get('referrer-policy'),
      'strict-transport-security': headersRes.headers.get('strict-transport-security'),
    };

    const hasSecurityHeaders =
      headers['x-content-type-options'] === 'nosniff' &&
      headers['x-frame-options'] === 'DENY' &&
      headers['referrer-policy'] === 'strict-origin-when-cross-origin' &&
      headers['strict-transport-security']?.includes('max-age=');

    record(
      'Security Headers (presentes)',
      hasSecurityHeaders ? 200 : 500,
      200,
      hasSecurityHeaders ? 'todos os headers presentes' : 'faltando headers',
    );

    if (hasSecurityHeaders) {
      console.log('   ✅ Security headers presentes:\n');
      Object.entries(headers).forEach(([key, value]) => {
        if (value) {
          const displayValue = key === 'strict-transport-security' ? value.substring(0, 50) + '...' : value;
          console.log(`      ${key}: ${displayValue}`);
        }
      });
      console.log('');
    }
  } catch (e) {
    record('Security Headers', 0, 200, e.message);
  }

  // Resumo
  const passed = results.filter((x) => x.pass).length;
  const total = results.length;

  console.log('='.repeat(60));
  console.log(`📊 RESULTADO: ${passed}/${total} testes passaram`);
  console.log('='.repeat(60) + '\n');

  if (passed < total) {
    console.log('❌ Testes que falharam:\n');
    results
      .filter((r) => !r.pass)
      .forEach((e) => {
        console.log(`  - ${e.name}: ${e.status} (esperado ${e.expected}) ${e.details ? `- ${e.details}` : ''}`);
      });
    console.log('');
  }

  process.exit(passed === total ? 0 : 1);
}

runTests().catch((e) => {
  console.error('❌ Erro fatal:', e);
  process.exit(1);
});
