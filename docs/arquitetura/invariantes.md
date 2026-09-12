# Invariantes arquiteturais

São decisões que um agente de desenvolvimento **não pode alterar silenciosamente**. Mudar
qualquer uma delas é decisão de arquitetura ou de produto: exige registrar o motivo aqui,
atualizar os diagramas e, quando houver, fechar a lacuna correspondente em
[`lacunas.md`](lacunas.md).

Todas foram lidas no código, no commit
[`6bc8a92`](https://github.com/lfdeus/dashboard-clima-pos/tree/6bc8a92) do repositório
de código. A coluna **Status** diz se o código atual cumpre a invariante.

| ID | Invariante | Evidência no código | Status |
| --- | --- | --- | --- |
| **INV01** | **Não existe backend próprio.** A SPA chama a OpenWeatherMap direto do navegador e o nginx só entrega arquivos estáticos, sem `proxy_pass`. Criar um proxy é decisão que resolve a L04, e não uma refatoração. | [`nginx.conf`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/nginx.conf), [`app.config.ts#L20-L21`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/app/app.config.ts#L20-L21) | Cumpre |
| **INV02** | **A tela não conhece status HTTP.** Toda tradução de erro HTTP acontece no `WeatherService`, que devolve `WeatherApiError` com um destes códigos: `NOT_FOUND` (404), `UNAUTHORIZED` (401), `NETWORK` (status 0) ou `UNKNOWN` (qualquer outro). Componentes só leem a `message`. Um novo tratamento, como 429, entra no service, não na tela. | [`weather.service.ts#L99-L117`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/app/core/services/weather.service.ts#L99-L117) | Cumpre |
| **INV03** | **Só o interceptor anexa `appid`, `units` e `lang`, e só em URLs que começam com `baseUrl`.** A chave não pode vazar para o servidor de ícones, para o Google Fonts nem para qualquer outro host. O service não monta a chave na URL. | [`api-key.interceptor.ts#L9-L24`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/app/core/interceptors/api-key.interceptor.ts#L9-L24) | Cumpre |
| **INV04** | **A API é sempre consultada em unidades métricas.** °F é conversão de apresentação feita no cliente, no pipe `temperatureUnit`. Alternar a unidade não gera requisição. | [`temperature-unit.pipe.ts`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/app/shared/pipes/temperature-unit.pipe.ts), [`environment.example.ts#L20`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/environments/environment.example.ts#L20) | Cumpre |
| **INV05** | **Clima atual e previsão são uma unidade atômica.** Ou os dois aparecem, ou nenhum: se uma chamada falha, a outra é cancelada e o resultado parcial é descartado. Exibir resultado parcial é decisão de produto (L06). | [`dashboard.component.ts#L102-L121`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/app/features/dashboard/dashboard.component.ts#L102-L121) | Cumpre |
| **INV06** | **Regras do histórico:** grava só depois de sucesso; guarda o nome **devolvido pela API**, não o termo digitado; mantém no máximo 5 itens; o mais recente fica no topo; não repete cidade (comparação sem diferenciar maiúsculas de minúsculas). | [`dashboard.component.ts#L110`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/app/features/dashboard/dashboard.component.ts#L110), [`#L125-L130`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/app/features/dashboard/dashboard.component.ts#L125-L130) | Cumpre |
| **INV07** | **O estado do usuário vive só no `localStorage` do navegador,** nas chaves `clima:history`, `clima:unit` e `clima:theme`, com os formatos de [`contratos/localstorage.schema.json`](contratos/localstorage.schema.json). Nada é enviado a servidor. Renomear uma chave apaga as preferências de quem já usa. | [`dashboard.component.ts#L22-L25`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/app/features/dashboard/dashboard.component.ts#L22-L25), [`#L59-L69`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/app/features/dashboard/dashboard.component.ts#L59-L69) | Cumpre |
| **INV08** | **O arquivo com a chave nunca é versionado.** `environment.ts` está no `.gitignore`, só o `environment.example.ts` (placeholder) vai para o Git, e o CI builda com o placeholder. | [`ci.yml#L28-L29`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/.github/workflows/ci.yml#L28-L29), [`Dockerfile#L17-L20`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/Dockerfile#L17-L20) | Cumpre |
| **INV09** | **A busca exige no mínimo 2 caracteres e usa debounce de 400 ms** (RN01 e RN02 da análise de requisitos). | [`search-bar.component.ts#L75-L92`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/app/shared/components/search-bar/search-bar.component.ts#L75-L92) | Cumpre |
| **INV10** | **Interface e dados em português do Brasil** (RN10). | [`forecast-card.component.ts#L18-L20`](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/src/app/shared/components/forecast-card/forecast-card.component.ts#L18-L20) | **Violada:** os dias da semana saem em inglês (ver D01 no README) |

## Como um agente deve usar este arquivo

- Antes de alterar código que toca uma dessas regras, confira se a mudança preserva a
  invariante. Se não preservar, pare e registre a decisão; não "corrija" o comportamento.
- Uma invariante marcada como **Violada** descreve a intenção. Corrigir o código para
  cumpri-la está alinhado com a arquitetura e não precisa de nova decisão.
- Uma regra que não aparece aqui e também não está em [`lacunas.md`](lacunas.md) ainda não
  foi decidida: pergunte em vez de escolher.
