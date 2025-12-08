# Instruções de Deploy

## Ambiente de Desenvolvimento

Para executar o WebCraft DAW em ambiente de desenvolvimento:

1. Certifique-se de ter o Node.js instalado (versão 16 ou superior)
2. Instale as dependências do projeto:
   ```
   npm install
   ```
3. Crie um arquivo `.env.local` na raiz do projeto com sua chave de API do Google Gemini:
   ```
   GEMINI_API_KEY=sua_chave_real_aqui
   ```
4. Execute o servidor de desenvolvimento:
   ```
   npm run dev
   ```
5. Acesse o aplicativo em http://localhost:3000

## Build para Produção

Para criar uma versão otimizada para produção:

1. Execute o comando de build:
   ```
   npm run build
   ```
2. Os arquivos compilados serão gerados na pasta `dist/`

## Preview da Versão de Produção

Para visualizar a versão de produção localmente:

1. Após executar o build, inicie o servidor de preview:
   ```
   npm run preview
   ```
2. Acesse o aplicativo em http://localhost:4173

## Importante

Este projeto utiliza Vite como ferramenta de construção e não funcionará corretamente se servido diretamente pelo XAMPP ou Apache, pois:
- Utiliza módulos ES6 e import maps que requerem um servidor com suporte adequado
- Arquivos TypeScript precisam ser compilados antes do uso
- Dependências são gerenciadas pelo Node.js e npm

Para ambientes de produção reais, recomenda-se utilizar um servidor web moderno como Nginx ou configurar adequadamente um servidor Node.js.