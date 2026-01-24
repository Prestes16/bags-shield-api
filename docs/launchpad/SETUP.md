# Launchpad Setup Guide

## Configuração Rápida

Para habilitar a Launchpad com chamadas de API reais:

### 1. Habilitar Launchpad

Adicione ao seu `.env` ou variáveis de ambiente:

```bash
# Habilitar Launchpad
LAUNCHPAD_ENABLED=true

# Modo de operação (stub ou real)
LAUNCHPAD_MODE=real

# Configuração Bags API (necessário para modo real)
BAGS_API_BASE=https://public-api-v2.bags.fm/api/v1
BAGS_API_KEY=sua-chave-api-aqui
```

### 2. Modo Stub vs Real

#### Modo Stub (Desenvolvimento/Testes)
```bash
LAUNCHPAD_ENABLED=true
LAUNCHPAD_MODE=stub
```
- ✅ Não requer BAGS_API_KEY
- ✅ Respostas mockadas
- ✅ Funciona offline
- ✅ Ideal para desenvolvimento

#### Modo Real (Produção)
```bash
LAUNCHPAD_ENABLED=true
LAUNCHPAD_MODE=real
BAGS_API_BASE=https://public-api-v2.bags.fm/api/v1
BAGS_API_KEY=sua-chave-real
```
- ✅ Chamadas reais para Bags API
- ✅ Cria tokens reais
- ✅ Requer API key válida

### 3. Allowlist de Domínios (Opcional)

Para restringir URLs de imagem a domínios específicos:

```bash
ALLOWED_IMAGE_DOMAINS=ipfs.io,arweave.net,cdn.example.com
```

### 4. HMAC Secret (Opcional)

Para assinatura de manifests:

```bash
LAUNCHPAD_HMAC_SECRET=seu-secret-forte-aqui
```

## Verificação

Após configurar, verifique se está funcionando:

1. Acesse `/launchpad` no app
2. O status deve mostrar "✅ Launchpad está habilitado"
3. O modo deve aparecer (stub ou real)

## Troubleshooting

### Launchpad mostra "desabilitado"

**Causa**: `LAUNCHPAD_ENABLED` não está configurado ou é `false`

**Solução**: 
```bash
LAUNCHPAD_ENABLED=true
```

### Sempre usa modo stub

**Causa**: `LAUNCHPAD_MODE` não configurado ou é `stub`

**Solução**:
```bash
LAUNCHPAD_MODE=real
BAGS_API_KEY=sua-chave
```

### Erro "BAGS_NOT_CONFIGURED"

**Causa**: `BAGS_API_KEY` ou `BAGS_API_BASE` não configurados

**Solução**: Configure ambos:
```bash
BAGS_API_BASE=https://public-api-v2.bags.fm/api/v1
BAGS_API_KEY=sua-chave
```

### URLs de imagem rejeitadas

**Causa**: Domínio não está na allowlist ou é bloqueado

**Solução**: 
- Verifique se o domínio é público válido
- Adicione à `ALLOWED_IMAGE_DOMAINS` se necessário
- Certifique-se que não é localhost ou IP privado

## Exemplo Completo (.env)

```bash
# Launchpad
LAUNCHPAD_ENABLED=true
LAUNCHPAD_MODE=real

# Bags API
BAGS_API_BASE=https://public-api-v2.bags.fm/api/v1
BAGS_API_KEY=sua-chave-api-aqui
BAGS_TIMEOUT_MS=15000

# Opcional: Allowlist
ALLOWED_IMAGE_DOMAINS=ipfs.io,arweave.net

# Opcional: HMAC Secret
LAUNCHPAD_HMAC_SECRET=seu-secret-forte-aqui
```

## Próximos Passos

1. Configure as variáveis de ambiente
2. Reinicie o servidor (se necessário)
3. Acesse `/launchpad` no app
4. Crie seu primeiro token!
