# 🚀 Bags Shield Launchpad

Sistema completo de lançamento de tokens com validação de segurança integrada.

## Status

✅ **Totalmente Integrado e Funcional**

- ✅ UI completa e navegável
- ✅ Chamadas de API reais
- ✅ Integração com Bags API
- ✅ Validação de segurança
- ✅ Histórico local
- ✅ Documentação completa

## Acesso Rápido

- **Landing**: `/launchpad`
- **Criar Token**: `/launchpad/create`
- **Histórico**: `/launchpad/history`
- **Token**: `/launchpad/[mint]`

## Configuração Rápida

```bash
# .env
LAUNCHPAD_ENABLED=true
LAUNCHPAD_MODE=real
BAGS_API_KEY=sua-chave
```

Veja [SETUP.md](./SETUP.md) para detalhes.

## Fluxo Completo

1. **Dashboard** → Botão "Launchpad"
2. **Landing** → "Create Token"
3. **Create** → Preencher formulário (auto-save)
4. **Review** → Preflight → Criar Token → Criar Config → Scan → Manifest → Launch
5. **Token Page** → Ver Shield Proof completo
6. **History** → Listar todos os tokens

## Documentação

- [API.md](./API.md) - Documentação completa da API
- [SETUP.md](./SETUP.md) - Guia de configuração
- [INTEGRATION.md](./INTEGRATION.md) - Guia de integração
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura do sistema
- [THREAT_MODEL.md](./THREAT_MODEL.md) - Modelo de ameaças
- [HARDENING.md](./HARDENING.md) - Hardening e segurança
- [TESTING.md](./TESTING.md) - Guia de testes

## Features

### Segurança

- ✅ Validação strict de schemas
- ✅ Anti-SSRF em URLs
- ✅ Rate limiting
- ✅ Security headers
- ✅ Logs sanitizados
- ✅ Feature flags

### Funcionalidades

- ✅ Criação de token via Bags API
- ✅ Configuração de launch
- ✅ Preflight validation
- ✅ Shield score real
- ✅ Manifest com hash e assinatura
- ✅ Histórico persistente

### UI/UX

- ✅ Navegação integrada
- ✅ Auto-save de drafts
- ✅ Loading states
- ✅ Error handling amigável
- ✅ Design consistente

## Próximos Passos

1. Configure as variáveis de ambiente (veja SETUP.md)
2. Acesse `/launchpad` no app
3. Crie seu primeiro token!

---

**Desenvolvido com segurança por padrão** 🛡️
