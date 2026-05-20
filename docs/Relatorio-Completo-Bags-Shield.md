# Relatorio Completo - Bags Shield Protocol
## Truth Gate tecnico | Evidencias | Claims permitidos

**Data do Truth Gate:** 20 de Maio de 2026
**Documento revisado:** `docs/Relatorio-Completo-Bags-Shield.md`
**Repositorios avaliados:** `bags-shield-api` e `bags-shield-app2`
**Escopo desta passada:** somente documentacao; nenhum codigo de produto foi alterado.

---

## 1. Legenda Truth Gate

| Marcador | Significado |
|---|---|
| VERIFIED | Existe evidencia local no repo, rota, componente, config, comando registrado ou arquivo de implementacao. |
| PARTIAL | Existe implementacao parcial, mas falta prova de producao, teste ponta-a-ponta, contrato externo ou validacao mainnet. |
| ROADMAP | Ainda e plano, backlog ou proposta. |
| REMOVE/REWRITE | Claim exagerado, ambiguo ou sem evidencia suficiente. Deve ser removido ou reescrito. |

Regra editorial: este documento nao deve afirmar "100% pronto", "unico na Solana", "pronto para producao" ou "50+ indicadores vs concorrentes" sem evidencia objetiva, data e criterio reproduzivel.

---

## 2. Sumario executivo corrigido

O Bags Shield possui uma base funcional para scanner, swap, auth, portfolio e launchpad, mas o estado correto deve ser descrito em camadas:

| Area | Truth Gate | Estado honesto |
|---|---|---|
| Scanner de tokens | PARTIAL | Existe rota `/api/scan`, provedores e score engine. Falta matriz publica de todos os indicadores e validacao ampla em producao. |
| Swap/Jupiter Ultra | PARTIAL | Existem rotas `/api/order`, `/api/execute`, fee logic e frontend. Nao declarar "100%" sem teste mainnet controlado e evidencia de tx recente. |
| Launchpad Bags v2 | PARTIAL | Existem rotas Bags, fee quote, token-info, create-config, create-launch-transaction, send e UI. Ainda precisa validacao real de producao sem executar launch indevido. |
| LP Lock | PARTIAL | Bags Shield nao executa LP lock. O sistema agenda/consulta e verifica lock nativo do protocolo, especialmente Meteora DBC quando ha prova on-chain. |
| Fee claims Bags | PARTIAL | Existem rotas para claimable positions e claim transactions v3, assinadas pela wallet do usuario. Precisa teste com posicao real claimable. |
| Auth Google/X/Wallet | PARTIAL | Existem rotas e hooks, mas o documento nao deve prometer cobertura total sem teste OAuth atualizado. |
| Portfolio | PARTIAL | Existe tela e integracoes parciais; qualquer dado mockado/remanescente deve ser marcado. |
| Deploy/CI | PARTIAL | Existem configs/scripts, mas status de producao deve ser datado e separado do status local. |

---

## 3. Inconsistencia de contagem de rotas API

### Claim anterior

> "Backend: 14/14 rotas funcionais. Pronto para producao."

### Truth Gate

**REMOVE/REWRITE.**

Evidencia local:

- `Get-ChildItem src/app/api -Recurse -Filter route.ts` lista **37 arquivos `route.ts`** no backend atual.
- A contagem "14 rotas" e uma contagem por **grupos funcionais antigos**, nao uma contagem de rotas reais.
- Nao encontrei, nesta passada, documento atual no backend afirmando "32 rotas"; se algum documento externo/anterior usou "32", ele tambem deve ser tratado como contagem historica ou parcial.

### Redacao corrigida permitida

> O backend possui 37 arquivos `route.ts` em `src/app/api` nesta revisao local. Para fins de produto, eles podem ser agrupados em familias como scan, swap, auth, launchpad, rpc, wallet, market, webhooks e health. A contagem antiga de "14 rotas" nao deve ser usada como numero absoluto.

---

## 4. Claims fortes revisados

| Claim original | Gate | Decisao |
|---|---|---|
| "Backend 14/14 rotas funcionais" | REMOVE/REWRITE | Trocar por "37 route handlers locais; funcionalidade varia por familia e depende de env/teste". |
| "Pronto para producao" | REMOVE/REWRITE | So usar com data, commit, build, smoke, env e teste em producao. |
| "100% completo" em rotas/paginas | REMOVE/REWRITE | Trocar por VERIFIED/PARTIAL por evidencia. |
| "Unico scanner de tokens na Solana com swap nativo integrado" | REMOVE/REWRITE | Falta fonte externa forte e benchmark atualizado. |
| "50+ indicadores vs 1-5 concorrentes" | REMOVE/REWRITE | Falta lista fechada dos 50 indicadores e criterio reproduzivel de comparacao. |
| "Scanner com 50+ regras" | PARTIAL | Ha score engine e regras, mas a lista local visivel nao comprova 50 regras independentes. |
| "Swap com fee 0.5%" | PARTIAL | Ha referencias de fee no fluxo Jupiter, mas nao alterar/afirmar sem evidenciar `APP_FEE_BPS`/collector e tx real. |
| "Token-2022 support" | PARTIAL | Ha referencias a Token-2022/wallet tokens; precisa teste com token real Token-2022. |
| "i18n PT-BR/EN" | VERIFIED | Existe `frontend/src/lib/i18n/index.js`. Cobertura total deve continuar PARTIAL sem auditoria de todas as chaves. |
| "Launchpad real Bags v2" | PARTIAL | Rotas e UI existem; validacao e producao precisam ser separadas. |
| "LP Lock funcional" | PARTIAL | Verificacao/monitoramento existem; execucao de lock pelo Bags Shield nao existe e nao deve ser prometida. |

---

## 5. Estado por area

### 5.1 Scanner

**Gate:** PARTIAL.

Evidencia:

- `src/app/api/scan/route.ts`
- `src/lib/score/engine.ts`
- `src/lib/score/rules.ts`
- `src/lib/score/collectSignals.ts`
- `src/lib/providers/helius.ts`
- `src/lib/providers/birdeye.ts`
- `src/lib/providers/dexscreener.ts`
- `src/lib/providers/meteora.ts`
- `src/lib/providers/orca.ts`

Redacao permitida:

> O scanner combina sinais de Helius, Birdeye, DexScreener, Meteora, RPC e heuristicas locais de score. A quantidade exata de indicadores deve ser publicada em uma matriz auditavel antes de usar claims numericos como "50+".

### 5.2 Swap/Jupiter

**Gate:** PARTIAL.

Evidencia:

- `src/app/api/quote/route.ts`
- `src/app/api/order/route.ts`
- `src/app/api/execute/route.ts`
- `src/app/api/swap/route.ts`
- `src/lib/solana/fees.ts`
- Frontend com componentes/hook de swap no app2.

Limite:

- Nao declarar "swap 100% validado" sem tx mainnet recente, assinatura de wallet real, Solscan e logs.
- Nao misturar fees de Swap com fees de Launchpad.

### 5.3 Launchpad Bags v2

**Gate:** PARTIAL.

Evidencia:

- `src/app/api/launchpad/token-info/route.ts`
- `src/app/api/launchpad/create-config/route.ts`
- `src/app/api/launchpad/create-launch-transaction/route.ts`
- `src/app/api/launchpad/fee-quote/route.ts`
- `src/app/api/launchpad/send/route.ts`
- `src/lib/launchpad/bags-client.ts`
- `frontend/src/pages/LaunchpadPage.jsx`
- `frontend/src/lib/hooks/useApi.js`

Redacao permitida:

> A Launchpad esta integrada ao fluxo Bags v2 no backend e no frontend, com metadata, fee quote, fee-share e transacao unsigned para assinatura pela wallet. O status de producao deve continuar PARTIAL ate teste controlado com payload real e sem execucao de launch mainnet nao aprovada.

### 5.4 Fees e receita

**Gate:** PARTIAL.

Evidencia:

- `src/lib/launchpad/fees.ts`
- `src/app/api/launchpad/fee-quote/route.ts`
- `src/app/api/launchpad/create-config/route.ts`
- `src/app/api/launchpad/create-launch-transaction/route.ts`
- `src/app/api/launchpad/fee-claims/positions/route.ts`
- `src/app/api/launchpad/fee-claims/transactions/route.ts`

Separacao correta:

| Receita/custo | Gate | Nota |
|---|---|---|
| SWAP_FEE | PARTIAL | Fluxo separado em Jupiter; nao mexer sem aprovacao. |
| LAUNCHPAD_SERVICE_FEE | PARTIAL | Fee quote e tipLamports existem; precisa tx real auditada para VERIFIED. |
| BAGS_FEE_SHARE | PARTIAL | create-config deve incluir fee-share; precisa resposta Bags/tx real para VERIFIED. |
| VERIFIED_UPSELL | PARTIAL | Valor existe na fee quote; so VERIFIED quando incluido em tipLamports real assinado. |
| NETWORK_COST / RENT_COST | PARTIAL | Devem aparecer como estimativa quando nao vierem de simulacao/RPC. |
| UNKNOWN/UI_ONLY | REMOVE/REWRITE | Qualquer valor sem cobranca real deve ser rotulado como estimativa, roadmap ou removido. |

---

## 6. Narrativa correta do LP Lock

### Redacao obrigatoria

**Bags Shield nao executa LP lock.**

O papel correto do Bags Shield e:

1. Registrar a intencao de LP lock escolhida no launch.
2. Detectar quando existe pool do token.
3. Verificar o lock nativo do protocolo quando houver prova on-chain.
4. Exibir `Verified` somente quando a leitura on-chain confirmar lock real.
5. Exibir `pending`, `unknown`, `pool_detected` ou `unverified` como estados nao verificados.

### Meteora DBC

Para tokens Bags/Meteora DBC, o lock deve ser tratado como lock nativo do protocolo quando a migracao/graduation gerar evidencia verificavel. O repositorio possui leitor de estado em:

- `src/lib/lp-lock/meteora-dbc.ts`
- `src/lib/lp-lock/service.ts`
- `src/app/api/launchpad/lp-lock/route.ts`

Truth Gate:

| Estado | Pode aparecer como Verified? | Motivo |
|---|---:|---|
| `verified: true` vindo de leitura on-chain explicita | Sim | Ha prova on-chain/protocolar. |
| `pool_detected` | Nao | Pool existe, mas lock nao foi comprovado. |
| `awaiting_pool` | Nao | Ainda nao existe pool detectada. |
| `unknown` | Nao | Estado desconhecido. |
| Tags/estimativas de Meteora DBC sem prova explicita | Nao | Pode ser provavel, mas nao e comprovado. |
| `verified: false` | Nao | O proprio payload declara ausencia de verificacao. |

Observacao de auditoria: qualquer caminho de implementacao que marque tags/heuristica como `verified: true` deve ser tratado como PARTIAL e revisado antes de aparecer para usuario como "Verified".

### Resgate/claim de liquidez/fees

O modelo seguro atual nao deve prometer que liquidez "cai automaticamente" em conta OAuth. Sem custodia aprovada ou delegacao explicita, qualquer claim/resgate deve ser feito por transacao unsigned retornada ao frontend e assinada pela wallet do usuario.

Evidencia de claim Bags:

- `src/app/api/launchpad/fee-claims/positions/route.ts`
- `src/app/api/launchpad/fee-claims/transactions/route.ts`
- `src/lib/launchpad/bags-client.ts`
- `frontend/src/pages/PortfolioPage.jsx`

Gate: PARTIAL ate haver teste com posicao real claimable.

---

## 7. Implementado e validado

Esta secao so aceita itens com evidencia local clara.

| Item | Gate | Evidencia |
|---|---|---|
| Estrutura Next.js API backend | VERIFIED | `package.json`, `src/app/api/**/route.ts` |
| Estrutura React/Craco frontend | VERIFIED | `frontend/package.json`, `frontend/src/**` |
| i18n PT/EN centralizado | VERIFIED | `frontend/src/lib/i18n/index.js` |
| Security helpers de validacao/SSRF | VERIFIED | `src/lib/security/validate.ts`, `src/lib/security/ssrf.ts`, testes SSRF |
| Rotas Launchpad Bags presentes | VERIFIED | `src/app/api/launchpad/**/route.ts` |
| LP Lock como leitura/monitoramento | VERIFIED | `src/lib/lp-lock/service.ts`, `src/lib/lp-lock/meteora-dbc.ts` |

---

## 8. Implementado mas nao validado em producao

| Item | Gate | O que falta |
|---|---|---|
| Swap Jupiter ponta-a-ponta | PARTIAL | Tx mainnet controlada, logs, Solscan e verificacao de fee. |
| Launchpad Bags ponta-a-ponta | PARTIAL | Teste real ate transacao preparada/assinada, sem launch indevido. |
| Fee-share 9500/500 | PARTIAL | Resposta Bags com configKey real e posterior auditoria on-chain. |
| Fee claims Bags | PARTIAL | Wallet com posicao claimable real e tx assinada/broadcast. |
| OAuth Google/X | PARTIAL | Teste OAuth producao com callback atual e sessao. |
| Portfolio completo | PARTIAL | Validacao contra wallet real e remocao de qualquer mock remanescente. |

---

## 9. Parcial, mockado e roadmap

### Parcial

- Scanner multi-fonte: implementado, mas sem matriz publica de indicadores.
- LP Lock: verifica protocolo; nao cria lock.
- Portfolio: possui UI e integracoes, mas precisa auditoria de dados reais vs placeholders.
- Launchpad: fluxo integrado, mas precisa validacao de producao controlada.

### Mockado ou suspeito de UI-only

- Qualquer label de "Verified" sem `verified: true` vindo de leitura on-chain deve ser rebaixado.
- Qualquer valor financeiro sem origem em quote/fee/simulacao deve aparecer como estimativa.
- Qualquer "liquidez resgatavel" sem tx real Bags/protocolo deve ser reescrito.

### Roadmap

- Custodia/OAuth para recebimento automatico de liquidez.
- Extensao on-chain de lock pelo usuario.
- Withdraw on-chain de LP lock vencido.
- Analytics de produto.
- Benchmark publico contra concorrentes.
- Matriz fechada dos indicadores de risco.

---

## 10. Claims competitivos permitidos

### Nao permitido

- "Unico na Solana."
- "O melhor scanner."
- "50+ indicadores vs concorrentes com 1-5."
- "100% pronto."

### Permitido

> Bags Shield combina scanner de risco, swap Jupiter e Launchpad Bags em uma experiencia Solana mobile-first. O scanner usa multiplas fontes e heuristicas locais; a cobertura exata dos indicadores deve ser consultada na matriz tecnica quando publicada.

---

## 11. Evidence Log

Comandos e arquivos usados nesta passada:

```powershell
git status --short --branch
rg --files -g "Relatorio-Completo-Bags-Shield.md"
Get-Content docs\Relatorio-Completo-Bags-Shield.md
rg -n "100%|unico|50\+|32 rotas|14 rotas|LP Lock|Verified|mock|roadmap|pronto" docs\Relatorio-Completo-Bags-Shield.md
Get-ChildItem -Path src\app\api -Recurse -Filter route.ts
rg -n "32 rotas|14 rotas|rotas" docs README.md . -g "*.md"
Get-Content package.json
Get-Content C:\Dev\bags-shield-app2\frontend\package.json
Get-Content src\lib\lp-lock\meteora-dbc.ts
Get-Content src\lib\lp-lock\service.ts
Get-Content src\app\api\launchpad\lp-lock\route.ts
Get-Content C:\Dev\bags-shield-app2\frontend\src\components\ui\lp-lock-status.jsx
```

Arquivos-chave usados como evidencia:

- `src/app/api/scan/route.ts`
- `src/lib/score/rules.ts`
- `src/lib/score/engine.ts`
- `src/lib/score/collectSignals.ts`
- `src/lib/providers/orca.ts`
- `src/lib/providers/meteora.ts`
- `src/app/api/quote/route.ts`
- `src/app/api/order/route.ts`
- `src/app/api/execute/route.ts`
- `src/app/api/launchpad/token-info/route.ts`
- `src/app/api/launchpad/create-config/route.ts`
- `src/app/api/launchpad/create-launch-transaction/route.ts`
- `src/app/api/launchpad/fee-quote/route.ts`
- `src/app/api/launchpad/send/route.ts`
- `src/app/api/launchpad/lp-lock/route.ts`
- `src/app/api/launchpad/fee-claims/positions/route.ts`
- `src/app/api/launchpad/fee-claims/transactions/route.ts`
- `src/lib/lp-lock/meteora-dbc.ts`
- `src/lib/lp-lock/service.ts`
- `frontend/src/pages/LaunchpadPage.jsx`
- `frontend/src/pages/PortfolioPage.jsx`
- `frontend/src/components/ui/lp-lock-status.jsx`
- `frontend/src/lib/hooks/useApi.js`
- `frontend/src/lib/i18n/index.js`

---

## 12. Diff/resumo das mudancas sugeridas

| Antes | Depois |
|---|---|
| "14/14 rotas funcionais" | "37 route handlers locais; agrupar por familia e validar por teste." |
| "Pronto para producao" | "PARTIAL ate build/smoke/producao/commit/data estarem registrados." |
| "100%" | Removido em favor de VERIFIED/PARTIAL/ROADMAP/REMOVE-REWRITE. |
| "Unico na Solana" | Removido; precisa fonte externa forte. |
| "50+ indicadores vs concorrentes" | Rebaixado; precisa matriz de indicadores e benchmark reproduzivel. |
| LP Lock como execucao Bags Shield | Corrigido: Bags Shield verifica lock nativo, especialmente Meteora DBC, quando ha prova on-chain. |
| Pending/unknown como sinal positivo | Corrigido: pending/unknown/unverified nao podem aparecer como Verified. |
| "Liquidez cai automaticamente na conta OAuth" | Roadmap; hoje o caminho seguro e wallet assinar claim/tx. |

---

## 13. Veredito Truth Gate

O projeto tem base tecnica relevante, mas o documento anterior estava otimista demais. A versao correta deve vender menos promessa e mais evidencia:

- VERIFIED para estrutura, rotas existentes e componentes presentes.
- PARTIAL para fluxos financeiros/on-chain que ainda precisam prova real.
- ROADMAP para custodia, auto-resgate e extensao/withdraw on-chain de LP lock.
- REMOVE/REWRITE para claims absolutos sem fonte externa ou sem teste reproduzivel.

Este relatorio agora deve ser usado como fonte de verdade editorial ate novas evidencias de build, smoke, producao, tx real ou benchmark serem anexadas.
