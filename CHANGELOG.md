# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-05-03

### Added
- Estrutura inicial do projeto Angular 19 com componentes 100% standalone.
- Integração com a API do OpenWeatherMap (`/weather` e `/forecast`).
- Dashboard com busca por cidade, debounce de 400 ms e exibição de:
  temperatura atual, sensação térmica, umidade, vento, pressão e cobertura de nuvens.
- Previsão consolidada de 5 dias (cards horizontais responsivos).
- Histórico das últimas 5 cidades pesquisadas, persistido via `effect` + localStorage.
- Toggle Celsius ↔ Fahrenheit usando `computed signals` e pipe customizado.
- Tema claro/escuro com persistência e respeito ao `prefers-color-scheme`.
- Interceptor functional para anexar `appid`, `units` e `lang` automaticamente.
- Tratamento de erros: 404, 401, falha de rede e erro genérico.
- Estilização com Tailwind CSS v3, design responsivo mobile-first.
- Skeleton loading e spinners com `role="status"` para acessibilidade.
- Suite de testes unitários (Jasmine + Karma) com 28 testes e cobertura ≥ 70%.
- ESLint (`angular-eslint`) e Prettier configurados.
- Pipeline de CI (GitHub Actions) — install → lint → test → build.
- Documentação completa: README, CHANGELOG, LICENSE.
- **Docker**: `Dockerfile` multi-stage (Node 22 → nginx 1.27 alpine), `nginx.conf`
  com SPA fallback + cache imutável + gzip + security headers, `docker-compose.yml`
  com healthcheck e variável `HOST_PORT`, `.dockerignore` enxuto.
