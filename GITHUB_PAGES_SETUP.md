# Implantação no GitHub Pages

## Pré-requisitos

1. Uma conta no GitHub
2. O projeto já configurado e funcionando localmente
3. Git instalado na sua máquina

## Passo a passo para implantação

### 1. Crie um repositório no GitHub

1. Acesse o GitHub e faça login
2. Clique em "New repository"
3. Dê um nome ao repositório (ex: webcraft-daw)
4. Escolha se será público ou privado
5. Não inicialize com README, .gitignore ou licença
6. Clique em "Create repository"

### 2. Prepare o projeto para deploy

1. No seu projeto local, inicialize o git se ainda não estiver:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Conecte ao repositório remoto do GitHub:
   ```bash
   git remote add origin https://github.com/seu-usuario/nome-do-repositorio.git
   git branch -M main
   git push -u origin main
   ```

### 3. Configure o GitHub Actions para deploy automático

1. Crie o diretório `.github/workflows` na raiz do projeto:
   ```bash
   mkdir -p .github/workflows
   ```

2. Crie um arquivo chamado `deploy.yml` dentro deste diretório com o seguinte conteúdo:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 4. Configure o GitHub Pages

1. Vá para as configurações do seu repositório no GitHub
2. Na barra lateral esquerda, clique em "Pages"
3. Em "Source", selecione "GitHub Actions"
4. Salve as alterações

### 5. Faça o deploy

1. Commit e push as alterações:
   ```bash
   git add .
   git commit -m "Add GitHub Pages deployment workflow"
   git push
   ```

2. O GitHub Actions iniciará automaticamente o workflow de deploy
3. Você pode acompanhar o progresso na aba "Actions" do repositório

### 6. Acesse seu site

Após o workflow terminar com sucesso:
1. Vá para as configurações do repositório
2. Na seção "Pages", você verá a URL do seu site
3. Geralmente será algo como: `https://seu-usuario.github.io/nome-do-repositorio/`

## Configurações adicionais

### Variáveis de ambiente

Se você estiver usando variáveis de ambiente (como a GEMINI_API_KEY), você precisará configurá-las nas configurações do repositório:

1. Vá para Settings > Secrets and variables > Actions
2. Clique em "New repository secret"
3. Adicione sua variável de ambiente

### Caminho base para GitHub Pages

Se você estiver implantando em um subdiretório (ex: username.github.io/repo-name), você pode precisar ajustar o caminho base no vite.config.ts:

```typescript
export default defineConfig({
  base: '/nome-do-repositorio/',
  // ... outras configurações
})
```

## Limitações importantes

1. **API Keys**: Não é seguro colocar chaves de API no código do frontend. Para aplicações em produção, você deve usar um backend proxy para chamar APIs sensíveis.

2. **Recursos de áudio**: Alguns navegadores podem ter restrições de autoplay para áudio. O usuário geralmente precisa interagir com a página primeiro antes que o áudio possa ser reproduzido.

3. **HTTPS**: O GitHub Pages serve sites via HTTPS, o que é ótimo para segurança, mas algumas APIs podem exigir configurações adicionais.

## Atualizando o site

Para atualizar seu site após fazer alterações:

1. Faça as alterações no código
2. Commit e push para o repositório:
   ```bash
   git add .
   git commit -m "Descrição das alterações"
   git push
   ```

3. O GitHub Actions irá automaticamente reconstruir e implantar o site