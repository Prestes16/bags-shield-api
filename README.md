# bags-shield-api
# Bags Shield API (MVP)

Microserviço serverless (Vercel) para o **Bags Shield**:
- **Scan**: calcula score 0–100 (SAFE/CAUTION/HIGH_RISK) com sinais on-chain (MVP usa mock).
- **Simulate (Creator Assist)**: prevê melhora do score ao aplicar ações.
- **Apply**: gera transação Solana (Devnet) com **fee em SOL** para a tesouraria + memos das ações.
- **(Opcional)** Publish: envia status para a Bags API.

## Endpoints
- `GET /api/health` → `{ ok: true, network }`
- `POST /api/shield/scan` → `{ score, badge, reasons[], signals{}, ts }`
- `POST /api/shield/simulate` → `{ predicted_score, predicted_badge, delta, explanations[] }`
- `POST /api/shield/apply` → `{ txBase64, amountSOL, treasury, actionsIncluded }`
- `POST /api/billing/confirm` → `{ ok, verified, lamports }`
- `POST /api/bags/publish` *(placeholder)*

## Variáveis de ambiente (Vercel)
- `BAGS_API_BASE` = `https://public-api-v2.bags.fm/api/v1`
- `BAGS_API_KEY`  = sua chave do portal Bags (NUNCA no código)
- `SOLANA_RPC`    = `https://api.devnet.solana.com`
- `NETWORK`       = `solana-devnet`
- `TREASURY_PUBKEY` = sua wallet Devnet para receber a fee
- `FEE_SOL`       = `0.03`
- `BAGS_PUBLISH_PATH` = `/tokens/{mint}/shield` *(placeholder)*

## Regras de score (v1)
- SAFE ≥ 80 | CAUTION 50–79 | HIGH_RISK < 50  
- Penalidades:
  - Mint ativa → **cap 60**  
  - LP lock: 0d −20 | <7d −10 | ≥30d 0  
  - Top-10: >70% −20 | 50–70% −10 | ≤50% 0  
  - Tax sell: >10% −15 | 6–10% −8 | ≤5% 0

## Fluxo de pagamento (opção A)
1. `/api/shield/apply` retorna `txBase64` contendo:
   - `SystemProgram.transfer` (fee → tesouraria)
   - memos das ações (placeholder)
2. Usuário assina com Phantom (Devnet).
3. `/api/billing/confirm` valida a assinatura e o valor enviado.

## Observações
- MVP usa **sinais mock**; depois plugar leitura real on-chain.
- Chave `BAGS_API_KEY` fica **somente** nas envs da Vercel.
