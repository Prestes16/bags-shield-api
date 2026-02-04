# ⚠️ Resultado da Verificação Helius

## Status: Variáveis não configuradas

O script `verify-helius-env.ps1` executou, mas as variáveis Helius não estão no `.env.local`.

## 📋 Variáveis Necessárias

Adicione as seguintes variáveis ao seu `.env.local`:

```bash
# Helius API Configuration
HELIUS_API_KEY=b472996c-2166-4f29-8e41-c06251e6ee3c
HELIUS_API_BASE=https://api-mainnet.helius-rpc.com
HELIUS_RPC_URL=https://mainnet.helius-rpc.com
HELIUS_TIMEOUT_MS=15000
```

## 🔧 Como Adicionar

### Opção 1: Editar manualmente

Abra `.env.local` e adicione as variáveis acima.

### Opção 2: Via PowerShell

```powershell
# Adicionar variáveis Helius ao .env.local
@"
# Helius API Configuration
HELIUS_API_KEY=b472996c-2166-4f29-8e41-c06251e6ee3c
HELIUS_API_BASE=https://api-mainnet.helius-rpc.com
HELIUS_RPC_URL=https://mainnet.helius-rpc.com
HELIUS_TIMEOUT_MS=15000
"@ | Add-Content -Path .env.local
```

## ✅ Após Configurar

Execute novamente o script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-helius-env.ps1
```

## 📊 Resultado Esperado

Quando configurado corretamente, você verá:

```
=== HELIUS (bags-shield-api) ===
RPC (sanitizado): https://mainnet.helius-rpc.com/?api-key=***
Enhanced base (sanitizado): https://api-mainnet.helius-rpc.com (api-key=***)

=== RPC: getHealth ===
OK: getHealth = ok

=== ENHANCED: GET /v0/addresses/.../transactions (sanitizado) ===
https://api-mainnet.helius-rpc.com/v0/addresses/11111111111111111111111111111111/transactions?api-key=***&limit=1
HTTP/1.1 200 OK
content-type: application/json

--- BODY (primeiros 200 chars) ---
{"jsonrpc":"2.0","id":1,"result":[...]}
```

## 📝 Notas

- O script valida **RPC** (`getHealth`) e **Enhanced API** (`/v0/addresses/.../transactions`)
- Todas as URLs são sanitizadas (api-key mascarada) na saída
- Arquivos temporários (`.tmp.helius.*`) são removidos automaticamente
