# Launchpad Testing Guide

## Overview

Testes focados em segurança e contratos para garantir que a Launchpad funciona corretamente e mantém as garantias de segurança.

## Testes de Schema

Testa que inputs inválidos retornam 400 com `issues[]` estruturado.

**Arquivo**: `scripts/test-launchpad-schemas.js`

**Cobertura**:
- Validação de campos obrigatórios
- Limites de tamanho (nome, símbolo, descrição)
- Validação de decimais (0-18)
- Validação de endereços base58
- Validação condicional (tipWallet requer tipLamports)
- Rejeição de propriedades extras (strict mode)

**Executar**:
```bash
node scripts/test-launchpad-schemas.js
```

## Testes Anti-SSRF

Testa que URLs maliciosas são bloqueadas.

**Arquivo**: `scripts/test-launchpad-ssrf.js`

**Cobertura**:
- Bloqueio de `localhost`
- Bloqueio de `127.0.0.1`
- Bloqueio de `169.254.169.254` (AWS metadata)
- Bloqueio de `file://`
- Bloqueio de IPs privados (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- Aceitação de URLs públicas HTTP/HTTPS válidas
- Rejeição de protocolos não-HTTP/HTTPS

**Executar**:
```bash
node scripts/test-launchpad-ssrf.js
```

## Testes de Manifest Hash

Testa que o hash do manifest é determinístico.

**Arquivo**: `scripts/test-launchpad-manifest-hash.js`

**Cobertura**:
- Mesmo payload produz mesmo hash
- Ordem de badges não afeta hash
- Ordem de tags não afeta hash
- Payloads diferentes produzem hashes diferentes
- Campos extras são ignorados na normalização

**Executar**:
```bash
node scripts/test-launchpad-manifest-hash.js
```

## Smoke Tests

Testes de integração que verificam que os endpoints respondem corretamente.

**Arquivo**: `scripts/smoke-launchpad.ps1`

**Endpoints testados**:
- `POST /api/launchpad/token-info`
- `POST /api/launchpad/create-config`
- `POST /api/launchpad/preflight`
- `POST /api/launchpad/manifest`

**Executar**:

```powershell
# Local
.\scripts\smoke-launchpad.ps1 -BaseUrl "http://localhost:3000"

# Production
.\scripts\smoke-launchpad.ps1 -BaseUrl "https://bags-shield-api.vercel.app" -LaunchWallet "YourWalletAddress"
```

**Parâmetros**:
- `-BaseUrl`: URL base da API (default: `http://localhost:3000`)
- `-LaunchWallet`: Endereço da wallet Solana (default: SOL mint)
- `-TipWallet`: Wallet opcional para tip
- `-TipLamports`: Valor do tip em lamports (default: 1000000)

## Executar Todos os Testes

```bash
# Testes unitários
npm run test:launchpad

# Smoke tests (PowerShell)
npm run smoke:launchpad
```

## Estrutura de Testes

```
scripts/
  ├── test-launchpad-all.js          # Runner de todos os testes
  ├── test-launchpad-schemas.js      # Testes de schema
  ├── test-launchpad-ssrf.js         # Testes anti-SSRF
  ├── test-launchpad-manifest-hash.js # Testes de hash
  └── smoke-launchpad.ps1            # Smoke tests PowerShell

src/lib/launchpad/__tests__/
  ├── schemas.test.ts                 # Testes TypeScript (referência)
  ├── ssrf.test.ts                    # Testes TypeScript (referência)
  └── manifest-hash.test.ts          # Testes TypeScript (referência)
```

## Notas

- Os testes TypeScript em `__tests__/` são para referência e requerem um test runner (Jest, Vitest, etc.)
- Os scripts JavaScript podem ser executados diretamente com Node.js
- Os smoke tests usam `curl.exe` e requerem PowerShell
- Todos os testes são focados em segurança e contratos, não em cobertura completa

## Integração CI/CD

Os testes podem ser integrados no CI/CD:

```yaml
# .github/workflows/ci-launchpad.yml
- name: Test Launchpad
  run: npm run test:launchpad

- name: Smoke Launchpad (local)
  run: |
    npm run dev &
    sleep 5
    npm run smoke:launchpad
```

## Dependências

**Nenhuma dependência nova adicionada**. Os testes usam:
- Node.js built-in modules (`crypto`, `fs`, `child_process`)
- Zod (já presente no projeto)
- PowerShell (sistema operacional)
