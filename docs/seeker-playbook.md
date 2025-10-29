# Bags Shield — Playbook de Integração com **Seeker** (Solana Mobile)

**Status:** rascunho operacional pronto para preencher.  
**Foco:** preparar o app/web para publicação no ecossistema Seeker, com trilha rápida PWA → APK e checklist de conformidade.

> Nota de engenharia: onde não houver especificação oficial à mão, tratamos como **hipótese de implementação** e marcamos com _[confirmar na doc Seeker]_.

---

## 1) Visão & Escopo
- Objetivo do lançamento: **Bags Shield** como app focado em _risk badges_ + _ShieldScore_ e leitura de tokens na Solana.
- Plataformas-alvo: **Seeker (Android)** e web mobile.
- Abordagem técnica: **PWA → TWA/APK** (_[confirmar na doc Seeker]_) para acelerar time‑to‑store.
- Carteira principal: **Phantom** (devnet e mainnet), fallback _read‑only_ quando desconectado.

### Entregáveis deste playbook
- [ ] APK assinada para submissão no ecossistema Seeker (_[confirmar canal/exigências]_)
- [ ] Página/listing com texto, ícones e screenshots no padrão exigido
- [ ] Matriz de conformidade (privacidade/segurança) preenchida
- [ ] Plano de QA e smoke tests (web + dispositivo físico Seeker)

---

## 2) Requisitos de Publicação (preencher)
- **Nome do app:** `Bags Shield`  
  _Curto (<=30) e sem termos bloqueados._
- **Package (Android Application Id):** `fm.bags.shield` _[confirmar padrão/namespace]_
- **Versão:** `1.0.0` (code: `1`) _[seguir semântica + code int]_
- **Min/Target SDK:** _[confirmar na doc Seeker]_
- **Assinatura:** Keystore + Upload Key _[confirmar fluxo Seeker]_ 
- **Categorias/Tags:** `Crypto`, `Wallet Tools`, `Security` _[confirmar taxonomia]_

### Metadados de Listing
- **Título curto (<=30):** `Bags Shield`
- **Descrição breve (<=80):** `Camada de confiança para tokens Solana: Risk Badges e ShieldScore.`
- **Descrição longa:** _texto de 3–6 parágrafos sobre proposta/segurança/limites_.
- **Políticas:** links de **Política de Privacidade** e **Termos de Uso** (hosteados no domínio do projeto).
- **Contato de suporte:** e‑mail e site.

---

## 3) Assets visuais (produzir/validar)
_Tamanhos sugeridos; ajustar conforme doc oficial do Seeker._
- **Ícone (round/adaptive):** 512×512 PNG (fundo sólido); exportar variantes se pedirem foreground/background.
- **Banner/Feature graphic:** 1024×500 PNG _[confirmar exigência]_
- **Screenshots (telefone):** 1080×2400 (sem moldura) **e** 1290×2796 (hi‑res) — mesmas telas usadas no brand kit.
- **Cores:** fundo escuro navy/blue; acentos em **verde neon** para CTAs; _risk badges_ consistentes A–E.
- **Proibições:** sem logos de terceiros sem permissão; sem promessas de ganho.

> Tarefas
- [ ] Exportar ícone final (escuro/claro se necessário)
- [ ] Gerar 4–6 screenshots: Home, Scan, Simulate, Token Details, Connect Wallet, Settings
- [ ] Banner/feature com _Bags + Shield_ (legível em 1024×500)

---

## 4) App/Tech — implementação
### 4.1 PWA → APK (TWA/Capacitor) — _hipótese_ (_[confirmar suporte Seeker]_) 
- **PWA** responsiva e _installable_ (manifest, service worker `no-store` para rotas sensíveis, offline básico).
- **TWA/Capacitor** gera o APK assinável, apontando para a PWA hospedada.
- **Deep Links** e _intent-filters_ para rotas `bags-shield://` e HTTPS do domínio.
- Pipeline de **build local/CI** que produz `.apk` e valida assinatura.

### 4.2 Wallet / Solana
- **Provider** Phantom: detecção, `connect/disconnect`, `signMessage`, `signAndSendTransaction`.
- Seleção de **cluster**: `devnet` / `mainnet` (UI + persistência).
- **Fallback read‑only**: se sem carteira, o app lê tokens e calcula _ShieldScore_ sem transacionar.
- **Deep link de retorno** após autorização _[confirmar esquema/URI na doc Seeker]_.

### 4.3 Backend (Bags Shield API)
- Endpoints ativos: `/api/health`, `/api/v0/scan`, `/api/v0/simulate` (envelope `{success,response,meta}`; `X-Request-Id`; `no-store`).
- Rate limiting por IP/chave; logs estruturados; retriable 429/500 com backoff.
- Ambientes: **preview** (dev) e **prod** (Vercel).

---

## 5) Conformidade & Segurança
- **Privacidade:** não coletar dados pessoais sem necessidade; documentar dados de telemetria.
- **Dados sensíveis:** nunca logar seed/keys; transações só via carteira do usuário.
- **Declarações/Isenções:** deixar claro que _ShieldScore_ é **sinal de risco**, não conselho financeiro.
- **CORS** e `Cache-Control: no-store` para rotas sensíveis.
- **Políticas de conteúdo:** proibir _user-generated content_ impróprio (se houver).

---

## 6) QA — plano mínimo (dispositivo físico ou emulador Seeker compatível)
| Caso | Passo | Esperado |
|---|---|---|
| Health | Abrir `/api/health` | `ok:true` |
| Scan v0 | POST com mint So111… | `success:true`, `shieldScore.grade in [A..E]` |
| Simulate v0 | BUY 0.5 SOL | `success:true`, `outcomeRisk.shieldScore` |
| Headers | Todas as respostas | `X-Request-Id` presente |
| Erro 400 | Scan faltando `tokenMint` | `success:false`, `issues[]` preenchido |
| Carteira | Conectar Phantom (devnet) | endereços válidos; transação _noop_ (se houver) |
| Offline | PWA sem rede | fallback de UI sem crash |

---

## 7) Pipeline de Release (rascunho)
1. **Build PWA** (`vite build` ou similar) — domínio público válido (HTTPS).
2. **Gerar APK** via **TWA** ou **Capacitor** (_[confirmar stack Seeker]_) com package `fm.bags.shield`.
3. **Assinar** com keystore local (guardada fora do repositório).
4. **Smoke** no dispositivo Seeker: abrir, conectar, scan/simulate OK.
5. **Checklist** de listing, screenshots e políticas.
6. **Submissão** no canal exigido pelo Seeker/dApp Store (_[confirmar fluxo]_).

---

## 8) Itens para confirmar na doc Seeker
- [ ] Canal de submissão (portal, formatos aceitos, SLA de review)
- [ ] Requisitos exatos de assets (ícones/banners, contagem e tamanhos de screenshots)
- [ ] Min/target SDK e permissões proibidas
- [ ] Políticas de segurança e _disclosures_ obrigatórios
- [ ] Suporte oficial a TWA/Capacitor (ou SDK específico)
- [ ] Esquemas de **deep link** recomendados para carteiras
- [ ] Regras de atualização/rollout e _crash reporting_ aceito

---

## 9) Próximos passos (preencher hoje)
- [ ] Confirmar com a doc Seeker os campos marcados como _[confirmar]_
- [ ] Preencher **metadados de listing** (títulos/descrições) aqui mesmo
- [ ] Exportar ícones e screenshots finais
- [ ] Validar **`npm test`** na API e travar “ALL GREEN”
- [ ] Definir stack PWA → APK e gerar primeiro build de prova

---

_Arquivo mantido em `/docs/seeker-playbook.md`._
