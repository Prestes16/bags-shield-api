#!/usr/bin/env node
/**
 * Testes Smoke - Jupiter API
 * Valida funcionalidade e compatibilidade - todos devem retornar 200 quando configurados
 * Uso: node scripts/test-jupiter-smoke.mjs
 * Requer: JUPITER_API_KEY configurada em .env.local ou variáveis de ambiente
 */

// Carrega variáveis de ambiente
let JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';
let JUPITER_API_BASE = process.env.JUPITER_API_BASE || 'https://api.jup.ag';

// Tenta carregar .env.local manualmente se dotenv não estiver disponível
if (!JUPITER_API_KEY) {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const keyMatch = envContent.match(/^\s*JUPITER_API_KEY\s*=\s*(.+?)\s*$/m);
      if (keyMatch) {
        JUPITER_API_KEY = keyMatch[1].trim().replace(/^["']|["']$/g, '');
      }
      const baseMatch = envContent.match(/^\s*JUPITER_API_BASE\s*=\s*(.+?)\s*$/m);
      if (baseMatch) {
        JUPITER_API_BASE = baseMatch[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch (e) {
    // Fallback: tenta dotenv se disponível
    try {
      const dotenv = await import('dotenv');
      const config = dotenv.config({ path: '.env.local' });
      if (!config.error) {
        JUPITER_API_KEY = process.env.JUPITER_API_KEY || JUPITER_API_KEY;
        JUPITER_API_BASE = process.env.JUPITER_API_BASE || JUPITER_API_BASE;
      }
    } catch (e2) {
      // dotenv não disponível, continua com process.env
    }
  }
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function fetchJson(url, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...opts.headers,
  };
  
  // x-api-key é OBRIGATÓRIO em todos os endpoints
  if (JUPITER_API_KEY) {
    headers['x-api-key'] = JUPITER_API_KEY;
  }

  const res = await fetch(url, {
    ...opts,
    headers,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return { status: res.status, ok: res.ok, data, text };
}

async function runJupiterTests() {
  console.log('🪐 TESTES SMOKE - JUPITER API');
  console.log(`📡 Base URL: ${JUPITER_API_BASE}`);
  console.log(`🔑 API Key: ${JUPITER_API_KEY ? '***' + JUPITER_API_KEY.slice(-4) : 'NÃO CONFIGURADA'}\n`);

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

  // Verificar se API key está configurada
  if (!JUPITER_API_KEY) {
    console.log('⚠️  AVISO: JUPITER_API_KEY não está configurada!');
    console.log('   Configure em .env.local ou variáveis de ambiente.\n');
  }

  try {
    // 1. TESTE DE COTAÇÃO (QUOTE) - GET /swap/v1/quote
    console.log('1️⃣ Testando GET /swap/v1/quote (SOL -> USDC)...');
    const quoteParams = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: '100000000', // 0.1 SOL (100000000 lamports)
      slippageBps: '50', // 0.5%
    });

    const quoteRes = await fetchJson(`${JUPITER_API_BASE}/swap/v1/quote?${quoteParams}`);

    if (quoteRes.status === 200 && quoteRes.data && quoteRes.data.outAmount) {
      record('GET /swap/v1/quote', 200, 200, `outAmount=${quoteRes.data.outAmount}`);
      if (quoteRes.data.priceImpactPct) {
        console.log(`   Price Impact: ${quoteRes.data.priceImpactPct}%`);
      }
    } else if (quoteRes.status === 401 || quoteRes.status === 403) {
      record('GET /swap/v1/quote', quoteRes.status, 200, 'x-api-key inválido ou ausente');
    } else if (quoteRes.status === 400) {
      record('GET /swap/v1/quote', quoteRes.status, 200, 'parâmetros inválidos');
    } else {
      record('GET /swap/v1/quote', quoteRes.status, 200, quoteRes.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('GET /swap/v1/quote', 0, 200, e.message);
  }

  console.log('');

  try {
    // 2. Obter cotação válida para usar no swap
    const quoteParams = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: '100000000',
      slippageBps: '50',
    });

    const quoteRes = await fetchJson(`${JUPITER_API_BASE}/swap/v1/quote?${quoteParams}`);

    if (quoteRes.status !== 200 || !quoteRes.data || !quoteRes.data.outAmount) {
      record('POST /swap/v1/swap', 0, 200, 'cotação não disponível (pulando)');
      console.log('');
    } else {
      // 3. TESTE DE SERIALIZAÇÃO DE SWAP (POST /swap/v1/swap)
      console.log('2️⃣ Testando POST /swap/v1/swap (Gerar Transação)...');
      
      // Wallet pública válida para teste (System Program)
      const DUMMY_WALLET = '11111111111111111111111111111111';

      const swapBody = {
        quoteResponse: quoteRes.data,
        userPublicKey: DUMMY_WALLET,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
      };

      const swapRes = await fetchJson(`${JUPITER_API_BASE}/swap/v1/swap`, {
        method: 'POST',
        body: JSON.stringify(swapBody),
      });

      if (swapRes.status === 200 && swapRes.data && swapRes.data.swapTransaction) {
        record('POST /swap/v1/swap', 200, 200, `TX gerada (${swapRes.data.swapTransaction.length} chars)`);
        if (swapRes.data.lastValidBlockHeight) {
          console.log(`   Last Valid Block Height: ${swapRes.data.lastValidBlockHeight}`);
        }
      } else if (swapRes.status === 401 || swapRes.status === 403) {
        record('POST /swap/v1/swap', swapRes.status, 200, 'x-api-key inválido ou ausente');
      } else if (swapRes.status === 400) {
        record('POST /swap/v1/swap', swapRes.status, 200, 'parâmetros inválidos ou quote expirado');
      } else {
        record('POST /swap/v1/swap', swapRes.status, 200, swapRes.data?.error || 'erro desconhecido');
      }
    }
  } catch (e) {
    record('POST /swap/v1/swap', 0, 200, e.message);
  }

  console.log('');

  try {
    // 4. TESTE DE PRICE API V3 - GET /price/v3
    console.log('3️⃣ Testando GET /price/v3 (Preços USD)...');
    const priceIds = `${SOL_MINT},${USDC_MINT}`;
    const priceRes = await fetchJson(`${JUPITER_API_BASE}/price/v3?ids=${priceIds}`);

    if (priceRes.status === 200 && priceRes.data && typeof priceRes.data === 'object') {
      const count = Object.keys(priceRes.data).length;
      record('GET /price/v3', 200, 200, `${count} preços obtidos`);
      if (priceRes.data[SOL_MINT]) {
        console.log(`   SOL: $${priceRes.data[SOL_MINT].usdPrice}`);
      }
      if (priceRes.data[USDC_MINT]) {
        console.log(`   USDC: $${priceRes.data[USDC_MINT].usdPrice}`);
      }
    } else if (priceRes.status === 401 || priceRes.status === 403) {
      record('GET /price/v3', priceRes.status, 200, 'x-api-key inválido ou ausente');
    } else if (priceRes.status === 400) {
      record('GET /price/v3', priceRes.status, 200, 'parâmetros inválidos');
    } else {
      record('GET /price/v3', priceRes.status, 200, priceRes.data?.error || 'erro desconhecido');
    }
  } catch (e) {
    record('GET /price/v3', 0, 200, e.message);
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

  // Verificar se Jupiter está configurado
  const notConfigured = results.filter((r) => r.status === 401 || r.status === 403).length;
  if (notConfigured > 0 && !JUPITER_API_KEY) {
    console.log('⚠️  AVISO: JUPITER_API_KEY não está configurada!');
    console.log('   Configure a variável de ambiente para executar testes completos.\n');
  }

  // Verificar compatibilidade (todos devem retornar 200 quando configurados)
  const functionalTests = results.filter((r) => r.status !== 401 && r.status !== 403 && r.status !== 0);
  const functionalPassed = functionalTests.filter((r) => r.pass).length;
  const functionalTotal = functionalTests.length;

  if (functionalTotal > 0) {
    console.log(`✅ Compatibilidade: ${functionalPassed}/${functionalTotal} endpoints funcionais`);
  }

  console.log('');

  // Exit code: 0 se todos passaram, 1 caso contrário
  process.exit(passed === total ? 0 : 1);
}

runJupiterTests().catch((e) => {
  console.error('❌ Erro fatal:', e);
  process.exit(1);
});
