# Prompt A, versão 2: cenários de integração (com contexto e restrições)

**Tipo:** geração de cenários de integração (fluxo principal, ponta a ponta dentro da SPA).
**Técnica:** zero-shot com contexto estruturado (papel, contexto, fronteira, oráculo, restrições e
formato de saída).
**Execução:** Claude Opus 5.5 numa sessão isolada, sem o histórico desta conversa, com leitura
apenas dos arquivos listados no prompt. Resposta salva sem edição em
[`resposta-A-v2.md`](resposta-A-v2.md). O código gerado foi copiado para
[`src/app/integration/consultar-clima.integration.spec.ts`](../../../src/app/integration/consultar-clima.integration.spec.ts)
e depois executado. Os ajustes feitos à mão estão no [README](../README.md#5-o-que-precisou-de-ajuste-humano).

**O que mudou em relação à v1** (cada item corrige um problema observado em
[`resposta-A-v1.md`](resposta-A-v1.md)):

| Problema na v1 | Ajuste na v2 |
| --- | --- |
| Inventou o serviço: cache, retry em 5xx, busca por coordenadas, vento em km/h | Manda ler o código e proíbe presumir comportamento que não está nele |
| Trocar °C/°F refazia a busca com `units=imperial` | Dá as invariantes como oráculo (INV04: a conversão é no cliente) |
| Testou o serviço sozinho e chamou isso de integração | Define a fronteira: tudo real, só o HTTP simulado |
| Usou `data-testid` que não existe no template | Proíbe alterar o código de produção e manda usar papéis ARIA e textos |
| Misturou Karma, Cypress e Jest | Fixa a stack existente e proíbe dependências novas |
| Assumiu `switchMap` (cancela a busca antiga) | Separa regra decidida (invariante) de regra em aberto (lacuna) |

---

Atue como engenheiro de QA especialista em testes de integração de front-end Angular.

**Contexto.** O repositório é o Dashboard de Clima: uma SPA Angular 19 (standalone components,
signals, OnPush) que consulta a API do OpenWeatherMap direto do navegador, sem backend próprio.
Leia estes arquivos antes de responder e não presuma nada que não esteja neles:

- `src/app/features/dashboard/dashboard.component.ts` e `.html`
- `src/app/shared/components/search-bar/search-bar.component.ts`
- `src/app/shared/components/weather-card/weather-card.component.ts`
- `src/app/shared/components/forecast-card/forecast-card.component.ts`
- `src/app/shared/components/error-message/error-message.component.ts`
- `src/app/shared/pipes/temperature-unit.pipe.ts`
- `src/app/core/services/weather.service.ts`
- `src/app/core/interceptors/api-key.interceptor.ts` e `src/app/core/tokens/api-config.token.ts`
- `src/app/core/models/weather.model.ts` e `forecast.model.ts`
- `docs/arquitetura/invariantes.md` (regras decididas, INV01 a INV10)
- `docs/arquitetura/lacunas.md` (regras ainda não decididas, L01 a L14)
- `docs/arquitetura/contratos/openweathermap-consumido.openapi.yaml` e `localstorage.schema.json`
- `src/app/features/dashboard/dashboard.component.spec.ts` (estilo dos testes atuais)

**Cenário de integração.** A jornada "consultar o clima de uma cidade" atravessa esta cadeia:
usuário → `SearchBarComponent` (debounce de 400 ms e submit) → `DashboardComponent` (`forkJoin`
de clima atual + previsão, sinais, `localStorage`) → `WeatherService` (normalização) →
`apiKeyInterceptor` (anexa `appid`, `units`, `lang`) → `HttpClient` → OpenWeatherMap. A
resposta volta pela mesma cadeia até o DOM (`WeatherCardComponent`, `ForecastCardComponent`,
pipe `temperatureUnit`) e até o `localStorage`.

**Fronteira do teste.**

- Use os componentes, o serviço, o interceptor e os pipes **reais**. Não use `spyOn`, mock ou
  stub de nenhuma classe da aplicação.
- Simule **apenas** a fronteira HTTP com `provideHttpClientTesting()` e `HttpTestingController`,
  e registre o interceptor real com `provideHttpClient(withInterceptors([apiKeyInterceptor]))`.
- Dirija o teste pelo DOM, como um usuário: escreva no `input` e dispare `input`, envie o
  formulário, clique nos botões. Não chame métodos `protected` do componente.
- As respostas simuladas devem respeitar o contrato `openweathermap-consumido.openapi.yaml`.

**Tarefa.** Gere os cenários de integração do **caminho feliz** desta jornada. Cubra, no
mínimo: a busca confirmada com Enter; a busca disparada pela digitação (debounce); o que de fato
sai na requisição (URL, `q`, `appid`, `units`, `lang`); a renderização do clima atual e dos
cartões de previsão (agrupamento por dia, mínima e máxima do dia); a gravação do histórico
(INV06) e a busca a partir de um item do histórico; a alternância °C/°F sem nova requisição
(INV04); e as preferências restauradas do `localStorage` ao abrir a tela (INV07).

**Oráculo.** O resultado esperado vem das invariantes e do contrato, não da implementação. Se o
código atual contrariar uma invariante, mantenha o teste com o comportamento correto e registre
o defeito como achado. Se o cenário cair numa lacuna (regra não decidida), não escolha a regra:
escreva um teste de caracterização com `[Lxx]` no nome e diga isso na tabela.

**Restrições.**

- Jasmine + Karma, como no projeto. Nada de Cypress, Jest, Testing Library ou dependência nova.
- Não altere o código de produção. Não há `data-testid`: localize elementos por papel ARIA,
  `aria-label` ou texto visível.
- Padrão AAA (Arrange, Act, Assert) explícito com comentários. `fakeAsync`/`tick` para o tempo.
  `httpMock.verify()` e `localStorage.clear()` no `afterEach`.
- Cada teste tem um ID estável `CI-xx` no início do nome.

**Formato de saída.**

1. Uma tabela com: ID, objetivo, componentes integrados, pré-condição, passos, resultado esperado
   e regra de origem (INV, contrato ou Lxx).
2. Um único arquivo TypeScript completo, pronto para ser salvo em
   `src/app/integration/consultar-clima.integration.spec.ts`.
3. Uma lista curta de achados ou dúvidas, se houver.
