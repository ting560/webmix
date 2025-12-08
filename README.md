# WebCraft DAW

Um DAW (Digital Audio Workstation) baseado na web construído com React e Web Audio API.

## Como executar o projeto

### Método recomendado (ambiente de desenvolvimento):

1. Instale as dependências:
   ```
   npm install
   ```

2. Execute o servidor de desenvolvimento:
   ```
   npm run dev
   ```
   O aplicativo estará disponível em: http://localhost:3000 (ou próxima porta disponível)

### Para produção (build otimizado):

1. Construa o projeto:
   ```
   npm run build
   ```

2. Visualize a versão de produção:
   ```
   npm run preview
   ```
   O aplicativo estará disponível em: http://localhost:4173 (ou próxima porta disponível)

## Implantação

### GitHub Pages

Consulte o arquivo [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md) para instruções detalhadas sobre como implantar no GitHub Pages.

### Outros serviços de hospedagem

O WebCraft DAW pode ser implantado em qualquer serviço de hospedagem que suporte arquivos estáticos, como:
- Netlify
- Vercel
- Firebase Hosting
- AWS S3 + CloudFront
- Azure Static Web Apps

Para todos esses serviços, basta fazer o build do projeto com `npm run build` e fazer o upload da pasta `dist/` gerada.

## Observações importantes

- Este projeto utiliza Vite como ferramenta de construção e não funciona corretamente quando servido diretamente pelo XAMPP
- O projeto requer Node.js instalado para execução
- Uma chave de API do Google Gemini é necessária para funcionalidades de IA (definida no arquivo .env.local)

## Estrutura do Projeto

- `App.tsx`: Componente principal da aplicação
- `index.tsx`: Ponto de entrada da aplicação
- `components/`: Componentes da interface do usuário
- `services/`: Serviços e utilitários (Áudio, IA, etc.)
- `types.ts`: Definições de tipos TypeScript

## Tecnologias utilizadas

- React 19 com Hooks
- TypeScript
- Vite 6
- Tailwind CSS (via PostCSS)
- Web Audio API
- Google Gemini AI