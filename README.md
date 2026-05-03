# Dashboard de Clima

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](.github/workflows/ci.yml)
[![Angular](https://img.shields.io/badge/Angular-19-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Coverage](https://img.shields.io/badge/coverage-%E2%89%A570%25-brightgreen)](#testes)

Dashboard moderno de monitoramento meteorológico construído com **Angular 19**, **Signals**, **standalone components** e **Tailwind CSS**. Consome a API do [OpenWeatherMap](https://openweathermap.org/api) para exibir clima atual e previsão de 5 dias para qualquer cidade do mundo.

> Pronto para produção, com testes (Jasmine + Karma), lint (`angular-eslint`), formatação (Prettier) e CI (GitHub Actions).

## Sumário

- [Recursos](#recursos)
- [Capturas de tela](#capturas-de-tela)
- [Pré-requisitos](#pré-requisitos)
- [Configuração da API key](#configuração-da-api-key)
- [Como rodar](#como-rodar)
- [Comandos disponíveis](#comandos-disponíveis)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Decisões arquiteturais](#decisões-arquiteturais)
- [Testes](#testes)
- [Estratégia de branches](#estratégia-de-branches)
- [Release](#release)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

## Recursos

- 🔍 Busca por cidade com debounce de 400 ms (Reactive Forms + `takeUntilDestroyed`)
- 🌡️ Toggle Celsius ↔ Fahrenheit (computed signal + pipe `temperatureUnit`)
- 🌤️ Card principal: temperatura atual, sensação térmica, mín/máx, umidade, vento, pressão, cobertura de nuvens
- 📅 Previsão consolidada de **5 dias** (a API retorna intervalos de 3h, agrupados por dia)
- 🕘 Histórico das últimas 5 cidades, persistido em `localStorage` via `effect`
- 🌗 Tema claro/escuro com toggle, respeitando `prefers-color-scheme` na primeira visita
- 📱 Layout responsivo (mobile, tablet, desktop)
- ♿ Acessibilidade: ARIA labels, navegação por teclado, contraste WCAG AA
- ⚡ Lazy loading via `loadComponent`, `ChangeDetectionStrategy.OnPush` em todos os componentes
- 🧪 28 testes unitários, cobertura ≥ 70%

## Capturas de tela

> _Adicione GIFs/PNGs em `docs/screenshots/` após o primeiro deploy._

```
docs/
└─ screenshots/
   ├─ dashboard-light.png
   ├─ dashboard-dark.png
   └─ mobile.png
```

## Pré-requisitos

| Ferramenta        | Versão mínima              |
| ----------------- | -------------------------- |
| Node.js           | **22 LTS** (≥ 20.11)       |
| npm               | **10+**                    |
| Angular CLI       | 19.x (instalada via `npx`) |
| Chrome / Chromium | para `ng test`             |

## Configuração da API key

1. Crie uma conta gratuita em <https://home.openweathermap.org/users/sign_up>.
2. Acesse <https://home.openweathermap.org/api_keys> e copie a chave _default_.
   > A chave pode levar **alguns minutos** até ficar ativa após a criação.
3. Copie o template de ambiente e preencha sua chave:

   ```bash
   cp src/environments/environment.example.ts src/environments/environment.ts
   ```

4. Abra `src/environments/environment.ts` e substitua `YOUR_OPENWEATHERMAP_API_KEY_HERE` pela sua chave.

> ⚠️ **Nunca commite** `src/environments/environment.ts` — ele já está listado no `.gitignore`.

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar API key (ver seção acima)

# 3. Iniciar servidor de desenvolvimento (http://localhost:4200)
npm start
```

Build de produção:

```bash
npm run build:prod
# artefato em dist/dashboard-clima/
```

## Comandos disponíveis

| Comando                 | Descrição                                    |
| ----------------------- | -------------------------------------------- |
| `npm start`             | Servidor de desenvolvimento na porta 4200    |
| `npm run build`         | Build de produção (default)                  |
| `npm run build:prod`    | Build de produção otimizado                  |
| `npm run watch`         | Build em modo watch (desenvolvimento)        |
| `npm test`              | Roda os testes em ChromeHeadless (sem watch) |
| `npm run test:watch`    | Testes em modo watch                         |
| `npm run test:coverage` | Testes + relatório de cobertura              |
| `npm run lint`          | Executa ESLint                               |
| `npm run lint:fix`      | Aplica fixes automáticos                     |
| `npm run format`        | Formata `src/` com Prettier                  |
| `npm run format:check`  | Apenas verifica formatação                   |

## Estrutura do projeto

```
dashboard-clima/
├── .github/workflows/ci.yml         # Pipeline GitHub Actions
├── src/
│   ├── app/
│   │   ├── core/                    # Models, tokens, service, interceptor
│   │   │   ├── models/
│   │   │   │   ├── weather.model.ts
│   │   │   │   └── forecast.model.ts
│   │   │   ├── tokens/api-config.token.ts
│   │   │   ├── interceptors/api-key.interceptor.ts
│   │   │   └── services/weather.service.ts
│   │   ├── features/dashboard/      # Feature dashboard (lazy loaded)
│   │   ├── shared/                  # Componentes e pipes reutilizáveis
│   │   │   ├── components/
│   │   │   │   ├── search-bar/
│   │   │   │   ├── weather-card/
│   │   │   │   ├── forecast-card/
│   │   │   │   ├── spinner/
│   │   │   │   └── error-message/
│   │   │   └── pipes/temperature-unit.pipe.ts
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   ├── environments/
│   │   ├── environment.example.ts   # Template (commitado)
│   │   └── environment.ts           # Local (NÃO commitar)
│   ├── styles.css                   # Tailwind + tokens de design
│   ├── index.html
│   └── main.ts
├── karma.conf.js                    # Configuração de testes + thresholds
├── tailwind.config.js
├── eslint.config.js
├── .prettierrc
├── tsconfig.json                    # strict + strictTemplates
├── angular.json
├── package.json
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## Decisões arquiteturais

### Por que **standalone components** em vez de NgModules?

Caminho oficial recomendado pelo Angular desde a v17. Reduzem boilerplate, deixam dependências explícitas no campo `imports`, melhoram tree-shaking e facilitam lazy loading via `loadComponent`.

### Por que **Signals** em vez de `BehaviorSubject`/RxJS para estado local?

Signals são síncronos, têm zero dependência em zone, integram-se com `computed` e `effect` para reatividade declarativa, e abrem caminho para _zoneless change detection_. Para fluxos assíncronos contínuos ainda usamos RxJS (ex.: `valueChanges` do form com debounce).

### Por que **`inject()`** em vez de constructor injection?

- Funciona em funções (interceptors, guards, resolvers).
- Permite herança sem repetir `super()` com argumentos.
- Estilo consistente em componentes, services e factories.

### Por que **functional interceptor**?

Interceptors funcionais são a API moderna (`provideHttpClient(withInterceptors([...]))`). Mais leves, testáveis e composáveis que a interface `HttpInterceptor`.

### Por que **`InjectionToken<ApiConfig>`** para configuração da API?

Isola o service do detalhe de build (`environment.ts`). Em testes, basta sobrescrever o token com um config mock — sem precisar de `TestBed.overrideProvider` em múltiplos lugares.

### Por que **agrupar a forecast por dia no cliente**?

A API `/forecast` retorna 40 itens (8 por dia, intervalos de 3h). Para o uso "previsão de 5 dias", o componente precisa de um item por dia. Agrupar no service mantém o template simples e a tipagem (`ForecastDay`) honesta.

## Testes

Stack: **Jasmine + Karma + ChromeHeadless**.

```bash
npm run test:coverage
```

Relatório HTML em `coverage/dashboard-clima/index.html`. Thresholds (configurados em [karma.conf.js](karma.conf.js)):

| Métrica    | Mínimo |
| ---------- | ------ |
| Statements | 70%    |
| Lines      | 70%    |
| Functions  | 70%    |
| Branches   | 60%    |

Cobertura atual da última execução: **statements 90%, lines 94%, functions 81%, branches 63%**.

## Estratégia de branches

- `main`: branch principal — sempre deployável, protegida (requer PR + CI verde).
- `feature/<nome>`: trabalho em desenvolvimento.
- `fix/<nome>`: correções pontuais.
- `chore/<nome>`: configurações, dependências, documentação.

Commits seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `style:`, `ci:`).

## Release

```bash
# Após mergear na main e atualizar CHANGELOG.md:
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
```

## Contribuindo

1. Faça fork e crie uma branch: `git checkout -b feature/minha-feature`.
2. Garanta que `npm run lint`, `npm test` e `npm run build` passam.
3. Use Conventional Commits.
4. Abra um PR descrevendo motivação e mudanças.

## Licença

[MIT](LICENSE) © 2026 Dashboard de Clima.

Dados meteorológicos fornecidos por [OpenWeatherMap](https://openweathermap.org/).
