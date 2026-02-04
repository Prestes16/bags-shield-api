# Testes manuais – APIs (resposta 200 e integração)

Use estes exemplos após configurar as variáveis de ambiente. Todos devem retornar **200** quando a API e o body/query estiverem corretos.

**Local:** defina `BASE=http://localhost:3000` ou use a URL direto.  
**Produção:** use a URL do deploy (ex.: `https://seu-app.vercel.app`).

---

## 1. Rastreamento de erros

```bash
# GET /api/errors – lista erros rastreados (sempre 200)
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/errors"
# Esperado: 200

curl -s "http://localhost:3000/api/errors?limit=10" | head -c 500
# Esperado: JSON com success: true, response.errors, meta
```

---

## 2. Scan de transação

```bash
# POST /api/scan – body base64 válido (200)
curl -s -X POST "http://localhost:3000/api/scan" \
  -H "Content-Type: application/json" \
  -d '{"rawTransaction":"AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAqJfY2nKnCyk8o/9x0x/2VhBfRg2b8lP1nY2fG0wEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQAA","network":"mainnet"}' \
  -w "\nHTTP %{http_code}\n"
# Esperado: 200 e JSON com success: true, response.shieldScore, response.grade
```

---

## 3. Simulação (mint)

```bash
# POST /api/simulate – mint base58 válido (200)
curl -s -X POST "http://localhost:3000/api/simulate" \
  -H "Content-Type: application/json" \
  -d '{"mint":"So11111111111111111111111111111111111111112"}' \
  -w "\nHTTP %{http_code}\n"
# Esperado: 200 e JSON com success: true, response.shieldScore, response.grade
```

---

## 4. Apply (decisão)

```bash
# POST /api/apply – sem body obrigatório (200)
curl -s -X POST "http://localhost:3000/api/apply" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nHTTP %{http_code}\n"
# Esperado: 200 e JSON com success: true, response.applied: true
```

---

## 5. Helius – slot (requer HELIUS_API_KEY)

```bash
# GET /api/helius/slot (200 se key configurada)
curl -s "http://localhost:3000/api/helius/slot" -w "\nHTTP %{http_code}\n"
# Esperado: 200 e JSON com success: true, response.slot (número)
# Sem key: 501 e error: helius_not_configured
```

---

## 6. Helius – analisar transações (requer HELIUS_API_KEY)

```bash
# POST /api/helius/parse-transactions – array de signatures (200 com key)
curl -s -X POST "http://localhost:3000/api/helius/parse-transactions" \
  -H "Content-Type: application/json" \
  -d '{"transactions":["SIGNATURE_DE_UMA_TX_REAL"],"commitment":"finalized"}' \
  -w "\nHTTP %{http_code}\n"
# Esperado: 200 e JSON com success: true, response (array de transações legíveis)
# Sem key: 501. Sem body/transactions: 400
```

---

## 7. Helius – histórico por endereço (requer HELIUS_API_KEY)

```bash
# GET /api/helius/address-transactions?address=... (200 com key)
curl -s "http://localhost:3000/api/helius/address-transactions?address=86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY&limit=10" \
  -w "\nHTTP %{http_code}\n"
# Esperado: 200 e JSON com success: true, response (array)
# Alternativa por path:
curl -s "http://localhost:3000/api/helius/addresses/86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY/transactions?limit=10" \
  -w "\nHTTP %{http_code}\n"
```

---

## 8. Helius – saldo (requer HELIUS_API_KEY)

```bash
# POST /api/helius/balance (200 com key)
curl -s -X POST "http://localhost:3000/api/helius/balance" \
  -H "Content-Type: application/json" \
  -d '{"address":"86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY"}' \
  -w "\nHTTP %{http_code}\n"
# Esperado: 200 e JSON com success: true, response.balance, response.sol
```

---

## 9. Jupiter – cotação de swap (requer JUPITER_API_KEY)

```bash
# GET /api/jupiter/quote – obter cotação SOL -> USDC (200 com key)
curl -s "http://localhost:3000/api/jupiter/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&slippageBps=50" \
  -w "\nHTTP %{http_code}\n"
# Esperado: 200 e JSON com success: true, response.outAmount, response.routePlan
# Sem key: 501. Sem params: 400
```

---

## 10. Jupiter – construir transação de swap (requer JUPITER_API_KEY)

```bash
# POST /api/jupiter/swap – construir transação (200 com key + quoteResponse)
# Primeiro obtenha uma quote (endpoint acima), depois use:
curl -s -X POST "http://localhost:3000/api/jupiter/swap" \
  -H "Content-Type: application/json" \
  -d '{
    "quoteResponse": { ...quote_obtida_acima... },
    "userPublicKey": "SUA_WALLET_PUBLIC_KEY",
    "dynamicComputeUnitLimit": true,
    "dynamicSlippage": true
  }' \
  -w "\nHTTP %{http_code}\n"
# Esperado: 200 e JSON com success: true, response.swapTransaction (base64)
# Sem key: 501. Sem quoteResponse/userPublicKey: 400
```

---

## 11. Jupiter – preços de tokens (requer JUPITER_API_KEY)

```bash
# GET /api/jupiter/price – obter preços USD de tokens (200 com key)
curl -s "http://localhost:3000/api/jupiter/price?ids=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" \
  -w "\nHTTP %{http_code}\n"
# Esperado: 200 e JSON com success: true, response.{mint: {usdPrice, decimals, priceChange24h}}
# Sem key: 501. Sem ids: 400. Máximo 50 tokens por requisição
```

---

## Checklist rápido (todos 200)

| Endpoint                           | Método | Condição                                 | Esperado |
| ---------------------------------- | ------ | ---------------------------------------- | -------- |
| `/api/errors`                      | GET    | -                                        | 200      |
| `/api/scan`                        | POST   | body com rawTransaction base64           | 200      |
| `/api/simulate`                    | POST   | body com mint base58                     | 200      |
| `/api/apply`                       | POST   | -                                        | 200      |
| `/api/helius/slot`                 | GET    | HELIUS_API_KEY set                       | 200      |
| `/api/helius/parse-transactions`   | POST   | key + body.transactions                  | 200      |
| `/api/helius/address-transactions` | GET    | key + query address                      | 200      |
| `/api/helius/balance`              | POST   | key + body.address                       | 200      |
| `/api/jupiter/quote`               | GET    | JUPITER_API_KEY + query params           | 200      |
| `/api/jupiter/swap`                | POST   | key + body.quoteResponse + userPublicKey | 200      |
| `/api/jupiter/price`               | GET    | key + query ids (mint addresses)         | 200      |

---

## Rodar testes automatizados

1. **Inicie o app** em um terminal: `pnpm dev`
2. **Em outro terminal**, rode os testes: `pnpm test:api`  
   (o script usa `BASE_URL=http://localhost:3000` por padrão; para produção use `BASE_URL=https://seu-dominio.vercel.app pnpm test:api`)

Os testes verificam status 200 e presença de campos do contrato (`success`, `response`, `meta`) integrados ao sistema do app. Se o servidor não estiver rodando, verá "fetch failed" e 0/N – inicie o app antes.

---

## Resumo da integração

- **Libs criadas** para o build e as APIs: `lib/cors.ts`, `lib/http.ts`, `lib/env.ts`, `lib/rate.ts`, `lib/payload-validation.ts`. Todas as rotas usam o mesmo contrato (`success`, `response`, `meta`, `requestId`) e rastreamento de erros.
- **Script** `pnpm test:api` chama as APIs e valida status e contrato.
- **Exemplos manuais** acima cobrem todas as rotas; use `http://localhost:3000` local ou a URL do deploy em produção.
