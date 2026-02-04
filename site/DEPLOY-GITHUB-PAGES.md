# Guia de Deploy para GitHub Pages

## ⚠️ PROBLEMA RESOLVIDO

Os erros foram corrigidos:

- ✅ `organizationName` e `projectName` atualizados no `docusaurus.config.js`
- ✅ `onBrokenMarkdownLinks` migrado para `markdown.hooks.onBrokenMarkdownLinks`
- ✅ `trailingSlash` adicionado no config
- ✅ Script `deploy` corrigido no `package.json`

## 🚨 ERRO PRINCIPAL: Branch gh-pages não existe

O erro `fatal: Remote branch gh-pages not found in upstream origin` acontece porque o branch `gh-pages` **não existe no GitHub ainda**. O Docusaurus precisa clonar esse branch para fazer o deploy.

## 📋 Setup Inicial (Execute UMA VEZ)

### Opção 1: Script Rápido (Recomendado)

```powershell
cd c:\Dev\bags-shield-api\site
.\CREATE-GH-PAGES.ps1
```

### Opção 2: Script Completo

```powershell
cd c:\Dev\bags-shield-api\site
.\scripts\setup-gh-pages.ps1
```

### Opção 3: Manual (se os scripts não funcionarem)

```powershell
# 1. Salva branch atual
$currentBranch = git rev-parse --abbrev-ref HEAD

# 2. Remove branch local se existir
git branch -D gh-pages 2>$null

# 3. Cria branch órfão gh-pages
git checkout --orphan gh-pages

# 4. Remove tudo do staging
git rm -rf . 2>$null

# 5. Cria arquivo .nojekyll (importante!)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText(".nojekyll", "", $utf8NoBom)
[IO.File]::WriteAllText("README.md", "# GitHub Pages", $utf8NoBom)

# 6. Commit inicial
git add .nojekyll README.md
git commit -m "chore: bootstrap gh-pages"

# 7. Push para GitHub
git push -u origin gh-pages

# 8. Volta para branch de trabalho
git checkout $currentBranch
```

## 🚀 Deploy Normal

Após criar o branch `gh-pages` inicial, sempre que quiser fazer deploy:

```powershell
cd c:\Dev\bags-shield-api\site

# Opcional: define variáveis de ambiente (já está no config)
$env:GIT_USER = "Prestes16"
$env:ORGANIZATION_NAME = "Prestes16"
$env:PROJECT_NAME = "bags-shield-api"

# Executa deploy
npm run deploy
```

O comando `docusaurus deploy` vai:

1. ✅ Fazer build do site (`npm run build`)
2. ✅ Clonar o branch `gh-pages` do GitHub
3. ✅ Copiar os arquivos do `build/` para o branch
4. ✅ Fazer commit e push automático

## ⚙️ Configuração no GitHub

1. Acesse o repositório: `https://github.com/Prestes16/bags-shield-api`
2. Vá em **Settings** → **Pages**
3. Configure:
   - **Source**: `Deploy from a branch`
   - **Branch**: `gh-pages` / `/ (root)`
   - **Save**

O site estará disponível em: `https://prestes16.github.io/bags-shield-api/`

## ✅ Verificação

Após o deploy:

1. Acesse `https://prestes16.github.io/bags-shield-api/`
2. Verifique que o site carrega corretamente
3. Teste navegação e docs

## 🔧 Troubleshooting

### Erro: "Remote branch gh-pages not found"

**Solução**: Execute o script `CREATE-GH-PAGES.ps1` primeiro

### Erro: "fatal: pathspec did not match any files"

**Solução**: Normal em branch órfão. Continue com `git add .` e `git commit`

### Erro: "Permission denied" no push

**Solução**: Verifique credenciais Git:

```powershell
git config --global user.name "Prestes16"
git config --global user.email "seu-email@example.com"
```

### Warnings sobre onBrokenMarkdownLinks

**Solução**: Já corrigido no `docusaurus.config.js` (migrado para `markdown.hooks`)

### Warnings sobre trailingSlash

**Solução**: Já corrigido no `docusaurus.config.js` (`trailingSlash: false`)
