# Fees & Cost Splits (Bags Shield)

## Fee formula
```
fee(amount) = clamp(fee_base + amount * fee_rate, fee_base, fee_cap)
```

- `amount`: volume da operação (ex.: em SOL ou USD-equivalente)
- `fee_base`: mínimo por transação (anti-spam / custo fixo)
- `fee_rate`: taxa proporcional
- `fee_cap`: teto (pra não punir whale)

## Split por carteiras (separação de cofres)
Objetivo: separar claramente "fundos do projeto" vs "custos operacionais".

### Vaults
- **Treasury** (fundos do projeto / runway / reserva)
- **Ops** (infra: host, server, observabilidade, domínios, APIs)
- **Payroll** (equipe / dev / auditorias / contractors)
- **Community** (incentivos, grants, recompensas, campanhas)

### Split inicial sugerido
- 55% Treasury
- 20% Ops
- 15% Payroll
- 10% Community

## Creator cut (opcional)
Antes do split acima:
- `creator_cut = X%` da fee total (ex.: 0–20%)
- restante entra no split padrão

## Governança e segurança
- Preferência por **multisig** (Treasury, Community, Ops)
- Limites mensais (Ops/Payroll)
- Signer frio para Treasury
- Transparência: relatório periódico de entradas/saídas

## Exemplo numérico
Se fee total = 0.010 SOL e creator_cut = 10%:
- 0.001 SOL para Creator
- 0.009 SOL split:
  - Treasury: 0.00495
  - Ops: 0.00180
  - Payroll: 0.00135
  - Community: 0.00090
