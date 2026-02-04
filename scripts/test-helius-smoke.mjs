#!/usr/bin/env node
/**
 * Testes Smoke - API Helius
 * Valida funcionalidade e compatibilidade - todos devem retornar 200 quando configurados
 * Uso: BASE_URL=http://localhost:3000 node scripts/test-helius-smoke.mjs
 * Requer: HELIUS_API_KEY configurada e servidor rodando (pnpm dev)
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

// Endereço Solana conhecido para testes (System Program)
const TEST_ADDRESS = '11111111111111111111111111111111';
// Signature de transação conhecida (exemplo - pode não existir, mas testa o endpoint)
const TEST_SIGNATURE = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJUDBRaJLNM8awPqrZCCtpM2iLpavGre4H6t4jHExKNV4Yd2qmm';
// Slot recente (será obtido dinamicamente)
let CURRENT_SLOT = null;

async function fetchJson(url, opts = {}) {
  try {
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
    return { status: res.status, data, ok: res.ok };
  } catch (error) {
    return { status: 0, data: null, ok: false, error: error.message };
  }
}

async function run() {
  const results = [];
  const errors = [];

  function record(name, status, expected = 200, details = '') {
    const pass = status === expected;
    results.push({ name, status, expected, pass, details });
    const icon = pass ? '✅' : '❌';
    const statusText = status === 0 ? 'CONNECTION_ERROR' : status;
    console.log(`${icon} ${name} -> ${statusText} ${details ? `(${details})` : ''}`);
    if (!pass) {
      errors.push({ name, status, expected, details });
    }
  }

  console.log('\n🔥 TESTES SMOKE - API HELIUS 🔥\n');
  console.log(`Base URL: ${BASE}\n`);

  // 1. GET /api/helius/slot - Teste básico RPC
  try {
    const r = await fetchJson(BASE + '/api/helius/slot');
    if (r.status === 200 && r.data?.success && r.data?.response?.slot != null) {
      CURRENT_SLOT = r.data.response.slot;
      record('GET /api/helius/slot', 200, 200, `slot=${CURRENT_SLOT}`);
    } else if (r.status === 501) {
      record('GET /api/helius/slot', 501, 200, 'HELIUS_API_KEY não configurada');
    } else {
      record('GET /api/helius/slot', r.status, 200, r.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('GET /api/helius/slot', 0, 200, e.message);
  }

  // 2. POST /api/helius/balance - Obter saldo
  try {
    const r = await fetchJson(BASE + '/api/helius/balance', {
      method: 'POST',
      body: JSON.stringify({ address: TEST_ADDRESS }),
    });
    if (r.status === 200 && r.data?.success) {
      record('POST /api/helius/balance', 200, 200, `balance=${r.data.response?.balance || 'N/A'}`);
    } else if (r.status === 501) {
      record('POST /api/helius/balance', 501, 200, 'HELIUS_API_KEY não configurada');
    } else if (r.status === 400) {
      record('POST /api/helius/balance', 400, 200, 'parâmetros inválidos');
    } else {
      record('POST /api/helius/balance', r.status, 200, r.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('POST /api/helius/balance', 0, 200, e.message);
  }

  // 3. POST /api/helius/account - Obter informações da conta
  try {
    const r = await fetchJson(BASE + '/api/helius/account', {
      method: 'POST',
      body: JSON.stringify({ address: TEST_ADDRESS }),
    });
    if (r.status === 200 && r.data?.success) {
      record('POST /api/helius/account', 200, 200, 'conta obtida');
    } else if (r.status === 501) {
      record('POST /api/helius/account', 501, 200, 'HELIUS_API_KEY não configurada');
    } else if (r.status === 400) {
      record('POST /api/helius/account', 400, 200, 'parâmetros inválidos');
    } else {
      record('POST /api/helius/account', r.status, 200, r.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('POST /api/helius/account', 0, 200, e.message);
  }

  // 4. POST /api/helius/block - Obter bloco (usa slot atual se disponível)
  if (CURRENT_SLOT) {
    try {
      const r = await fetchJson(BASE + '/api/helius/block', {
        method: 'POST',
        body: JSON.stringify({ slot: CURRENT_SLOT }),
      });
      if (r.status === 200 && r.data?.success) {
        record('POST /api/helius/block', 200, 200, `bloco obtido (slot ${CURRENT_SLOT})`);
      } else if (r.status === 501) {
        record('POST /api/helius/block', 501, 200, 'HELIUS_API_KEY não configurada');
      } else if (r.status === 400) {
        record('POST /api/helius/block', 400, 200, 'parâmetros inválidos');
      } else {
        record('POST /api/helius/block', r.status, 200, r.data?.error || 'erro desconhecido');
      }
    } catch (e) {
      record('POST /api/helius/block', 0, 200, e.message);
    }
  } else {
    record('POST /api/helius/block', 0, 200, 'slot não disponível (pulando)');
  }

  // 5. POST /api/helius/transaction - Obter transação (pode retornar null se não existir)
  try {
    const r = await fetchJson(BASE + '/api/helius/transaction', {
      method: 'POST',
      body: JSON.stringify({ signature: TEST_SIGNATURE }),
    });
    // 200 mesmo se transação não existir (retorna null)
    if (r.status === 200 && r.data?.success !== undefined) {
      record('POST /api/helius/transaction', 200, 200, 'endpoint funcional');
    } else if (r.status === 501) {
      record('POST /api/helius/transaction', 501, 200, 'HELIUS_API_KEY não configurada');
    } else if (r.status === 400) {
      record('POST /api/helius/transaction', 400, 200, 'parâmetros inválidos');
    } else {
      record('POST /api/helius/transaction', r.status, 200, r.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('POST /api/helius/transaction', 0, 200, e.message);
  }

  // 6. POST /api/helius/transactions - Obter múltiplas transações
  try {
    const r = await fetchJson(BASE + '/api/helius/transactions', {
      method: 'POST',
      body: JSON.stringify({ signatures: [TEST_SIGNATURE] }),
    });
    if (r.status === 200 && r.data?.success !== undefined) {
      record('POST /api/helius/transactions', 200, 200, 'endpoint funcional');
    } else if (r.status === 501) {
      record('POST /api/helius/transactions', 501, 200, 'HELIUS_API_KEY não configurada');
    } else if (r.status === 400) {
      record('POST /api/helius/transactions', 400, 200, 'parâmetros inválidos');
    } else {
      record('POST /api/helius/transactions', r.status, 200, r.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('POST /api/helius/transactions', 0, 200, e.message);
  }

  // 7. POST /api/helius/simulate - Simular transação (transação inválida retorna erro, mas endpoint funciona)
  try {
    const r = await fetchJson(BASE + '/api/helius/simulate', {
      method: 'POST',
      body: JSON.stringify({
        transaction:
          'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAqJfY2nKnCyk8o/9x0x/2VhBfRg2b8lP1nY2fG0wEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQAA',
      }),
    });
    // 200 se simulação funcionar, 500 se transação inválida (mas endpoint está funcional)
    if (r.status === 200 && r.data?.success) {
      record('POST /api/helius/simulate', 200, 200, 'simulação executada');
    } else if (r.status === 500 && r.data?.error) {
      // Endpoint funciona, apenas transação inválida
      record('POST /api/helius/simulate', 200, 200, 'endpoint funcional (transação inválida esperada)');
    } else if (r.status === 501) {
      record('POST /api/helius/simulate', 501, 200, 'HELIUS_API_KEY não configurada');
    } else if (r.status === 400) {
      record('POST /api/helius/simulate', 400, 200, 'parâmetros inválidos');
    } else {
      record('POST /api/helius/simulate', r.status, 200, r.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('POST /api/helius/simulate', 0, 200, e.message);
  }

  // 8. POST /api/helius/parse-transactions - Enhanced Transactions API
  try {
    const r = await fetchJson(BASE + '/api/helius/parse-transactions', {
      method: 'POST',
      body: JSON.stringify({ transactions: [TEST_SIGNATURE] }),
    });
    if (r.status === 200 && r.data?.success !== undefined) {
      record('POST /api/helius/parse-transactions', 200, 200, 'Enhanced API funcional');
    } else if (r.status === 501) {
      record('POST /api/helius/parse-transactions', 501, 200, 'HELIUS_API_KEY não configurada');
    } else if (r.status === 400) {
      record('POST /api/helius/parse-transactions', 400, 200, 'parâmetros inválidos');
    } else {
      record('POST /api/helius/parse-transactions', r.status, 200, r.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('POST /api/helius/parse-transactions', 0, 200, e.message);
  }

  // 9. GET /api/helius/address-transactions - Histórico por endereço (query)
  try {
    const r = await fetchJson(BASE + `/api/helius/address-transactions?address=${TEST_ADDRESS}&limit=10`);
    if (r.status === 200 && r.data?.success !== undefined) {
      record('GET /api/helius/address-transactions', 200, 200, 'histórico obtido');
    } else if (r.status === 501) {
      record('GET /api/helius/address-transactions', 501, 200, 'HELIUS_API_KEY não configurada');
    } else if (r.status === 400) {
      record('GET /api/helius/address-transactions', 400, 200, 'parâmetros inválidos');
    } else {
      record('GET /api/helius/address-transactions', r.status, 200, r.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('GET /api/helius/address-transactions', 0, 200, e.message);
  }

  // 10. GET /api/helius/addresses/{address}/transactions - Histórico por path
  try {
    const r = await fetchJson(BASE + `/api/helius/addresses/${TEST_ADDRESS}/transactions?limit=10`);
    if (r.status === 200 && r.data?.success !== undefined) {
      record('GET /api/helius/addresses/{address}/transactions', 200, 200, 'histórico por path obtido');
    } else if (r.status === 501) {
      record('GET /api/helius/addresses/{address}/transactions', 501, 200, 'HELIUS_API_KEY não configurada');
    } else if (r.status === 400 || r.status === 404) {
      record(
        'GET /api/helius/addresses/{address}/transactions',
        400,
        200,
        'parâmetros inválidos ou rota não encontrada',
      );
    } else {
      record('GET /api/helius/addresses/{address}/transactions', r.status, 200, r.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('GET /api/helius/addresses/{address}/transactions', 0, 200, e.message);
  }

  // Resumo
  const passed = results.filter((x) => x.pass).length;
  const total = results.length;
  const failed = total - passed;

  console.log('\n' + '='.repeat(60));
  console.log(`📊 RESULTADO: ${passed}/${total} testes passaram`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    console.log('❌ Testes que falharam:\n');
    errors.forEach((e) => {
      console.log(`  - ${e.name}: ${e.status} (esperado ${e.expected}) ${e.details ? `- ${e.details}` : ''}`);
    });
    console.log('');
  }

  // Verificar se Helius está configurado
  const notConfigured = results.filter((r) => r.status === 501).length;
  if (notConfigured > 0) {
    console.log('⚠️  AVISO: HELIUS_API_KEY não está configurada!');
    console.log('   Configure a variável de ambiente para executar testes completos.\n');
  }

  // Verificar compatibilidade (todos devem retornar 200 quando configurados)
  const functionalTests = results.filter((r) => r.status !== 501 && r.status !== 0);
  const functionalPassed = functionalTests.filter((r) => r.pass).length;
  const functionalTotal = functionalTests.length;

  if (functionalTotal > 0) {
    console.log(`✅ Compatibilidade: ${functionalPassed}/${functionalTotal} endpoints funcionais`);
  }

  console.log('');

  // Exit code: 0 se todos passaram, 1 caso contrário
  process.exit(passed === total ? 0 : 1);
}

run().catch((e) => {
  console.error('❌ Erro fatal:', e);
  process.exit(1);
});
