# Helius API – Endpoints e URLs

## URLs oficiais (mainnet)

- **Analisar transação(ões)**  
  `POST https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=SUA_CHAVE`

- **Histórico de transações por endereço**  
  `GET https://api-mainnet.helius-rpc.com/v0/addresses/{address}/transactions/?api-key=SUA_CHAVE`

- **RPC Solana**  
  `https://mainnet.helius-rpc.com/?api-key=SUA_CHAVE`  
  (requisições JSON-RPC: getBalance, getSlot, getTransaction, etc.)

## Chave de API (exemplo)

Configure no `.env.local` ou nas variáveis de ambiente do Vercel:

```bash
HELIUS_API_KEY=1a9a5335-5b0b-444b-a24c-e477cca06a7c
HELIUS_API_BASE=https://api-mainnet.helius-rpc.com
HELIUS_RPC_URL=https://mainnet.helius-rpc.com
```

## Rotas da Bags Shield API (proxy Helius)

A API do projeto expõe os mesmos recursos via proxy (usa `HELIUS_API_KEY` do servidor):

### Analisar transação(ões)

```bash
POST /api/helius/parse-transactions
Content-Type: application/json

{
  "transactions": ["signature1", "signature2"],
  "commitment": "finalized"
}
```

Máximo 100 signatures por requisição. Retorna transações em formato legível (Enhanced Transactions).

### Histórico por endereço (query)

```bash
GET /api/helius/address-transactions?address=WALLET_ADDRESS&limit=100&sort-order=desc
```

Query opcionais: `before`, `after`, `commitment`, `limit` (1–100), `sort-order`, `type`, `source`, `gt-slot`, `gte-slot`, `lt-slot`, `lte-slot`, `gt-time`, `gte-time`, `lt-time`, `lte-time`.

### Histórico por endereço (path)

```bash
GET /api/helius/addresses/{address}/transactions?limit=100
```

Mesmas query opcionais do endpoint acima.

### RPC (slot, balance, transaction, etc.)

- `GET /api/helius/slot` – slot atual
- `POST /api/helius/balance` – body: `{ "address": "..." }`
- `POST /api/helius/transaction` – body: `{ "signature": "..." }`
- `POST /api/helius/simulate` – body: `{ "transaction": "base64..." }`
- Outros: `account`, `transactions`, `block`

## Referência Helius

- [Enhanced Transactions – Parse](https://www.helius.dev/docs/api-reference/enhanced-transactions/gettransactions)
- [Enhanced Transactions – By Address](https://www.helius.dev/docs/api-reference/enhanced-transactions/gettransactionsbyaddress)
