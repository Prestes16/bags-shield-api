# 🔒 UI Locked - Regras de Proteção

## ⚠️ REGRAS ABSOLUTAS (NÃO QUEBRAR)

Este documento define áreas do código que **NÃO PODEM SER ALTERADAS** durante o desenvolvimento da Launchpad ou qualquer outra feature.

### Áreas Protegidas

#### 1. `public/**`
- **Status**: 🔒 BLOQUEADO
- **Motivo**: Contém assets estáticos, HTML, CSS e JavaScript compilados que são servidos diretamente
- **Impacto**: Alterações podem quebrar o layout visual existente, páginas HTML standalone, e recursos públicos
- **Permitido**: Apenas leitura para referência

#### 2. `ui-vault/**`
- **Status**: 🔒 BLOQUEADO
- **Motivo**: Vault de componentes UI reutilizáveis e temas que devem permanecer estáveis
- **Impacto**: Alterações podem afetar múltiplas páginas e quebrar consistência visual
- **Permitido**: Apenas leitura para referência

### Regras Adicionais

#### CSS/Tema/Base Visual
- ❌ **NÃO** alterar estilos globais existentes sem aprovação explícita
- ❌ **NÃO** modificar variáveis de tema CSS sem coordenação
- ❌ **NÃO** sobrescrever classes utilitárias existentes

#### Rotas Existentes
- ❌ **NÃO** renomear rotas existentes
- ❌ **NÃO** refatorar páginas fora do escopo da feature atual
- ✅ **PERMITIDO**: Criar novas rotas em `src/app/launchpad/**`

### Como Trabalhar com UI Protegida

1. **Leia apenas**: Use como referência para manter consistência
2. **Crie novo**: Desenvolva novos componentes em áreas permitidas
3. **Documente**: Se precisar alterar algo protegido, documente o motivo e obtenha aprovação

### Verificação

O arquivo `.cursorignore` está configurado para proteger automaticamente essas áreas. Ferramentas de IA e editores devem respeitar essas regras.

---

**Última atualização**: 2024-12-19  
**Responsável**: Equipe de Desenvolvimento Bags Shield
