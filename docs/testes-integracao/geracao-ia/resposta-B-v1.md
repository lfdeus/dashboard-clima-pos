# Testes de integração de erro: dashboard de clima (Angular + OpenWeatherMap)

Abaixo está uma suíte de testes de integração focada em **cenários de erro**. Ela cobre três grupos:

1. **Dados inválidos**: entrada do usuário e payloads malformados da API.
2. **Falhas da API**: HTTP 4xx/5xx, rede e timeout.
3. **Casos de borda**: valores extremos, caracteres especiais e concorrência.

Os testes integram **componente + serviço + interceptor + template** de verdade. Só o backend HTTP é substituído, via `HttpTestingController`. Não são testes unitários com tudo mockado: o fluxo real de requisição, tratamento de erro e renderização é exercitado.

---

## 1. Premissas sobre a aplicação

Como não tenho o código do seu projeto, assumi a estrutura abaixo. Se os nomes forem diferentes, ajuste os seletores e as assinaturas.

| Peça | Responsabilidade |
|---|---|
| `WeatherService` | `getCurrentWeather(city)` → `GET /data/2.5/weather?q=...&appid=...&units=metric&lang=pt_br` e `getForecast(city)` → `GET /data/2.5/forecast?...` |
| `errorInterceptor` | Converte `HttpErrorResponse` em `WeatherError { code, message }` amigável. Faz retry (até 2x) apenas em 5xx/rede. |
| `WeatherDashboardComponent` | Campo de busca, botão "Buscar", card de clima atual, lista de previsão, mensagem de erro, spinner. |
| Seletores (`data-testid`) | `city-input`, `search-btn`, `error-msg`, `loading`, `weather-card`, `temp`, `city-name`, `forecast-item`, `retry-btn` |

Versões consideradas: Angular 17+ (standalone, `provideHttpClient`), Jasmine/Karma (compatível com Jest, trocando `jasmine.clock` por `jest.useFakeTimers`).

---

## 2. Matriz de casos de teste

### 2.1 Dados inválidos (entrada e payload)

| ID | Cenário | Entrada / estímulo | Resultado esperado |
|---|---|---|---|
| DI-01 | Cidade vazia | `""` | Nenhuma requisição HTTP; mensagem "Informe o nome de uma cidade" |
| DI-02 | Apenas espaços | `"    "` | Nenhuma requisição; mesma mensagem do DI-01 |
| DI-03 | Somente números | `"12345"` | Validação local bloqueia ("Nome de cidade inválido") **ou**, se a validação for permitida, trata o 404 da API |
| DI-04 | Tentativa de XSS | `<script>alert(1)</script>` | Texto escapado no DOM e nenhum `<script>` injetado; query string codificada |
| DI-05 | Tentativa de injeção na query | `London&appid=HACK` | O `&` é codificado (`%26`) e não sobrescreve o `appid` |
| DI-06 | Payload sem `main` | 200 com `{ name, weather }` | Erro "Dados de clima incompletos", sem `TypeError` no console |
| DI-07 | `weather` como array vazio | 200 com `weather: []` | Card renderiza sem ícone/descrição (fallback "—"), sem quebrar |
| DI-08 | Temperatura não numérica | `main.temp: "abc"` / `null` | Exibe "—" em vez de `NaN °C` |
| DI-09 | Corpo não-JSON | 200 com HTML (`<html>...`) | Erro genérico "Resposta inválida do servidor" |
| DI-10 | `cod` de erro no corpo com status 200 | `{ cod: "404", message: "city not found" }` | Tratado como erro (o OpenWeatherMap às vezes coloca o `cod` no corpo) |

### 2.2 Falhas da API

| ID | Cenário | Status / evento | Resultado esperado |
|---|---|---|---|
| FA-01 | API key inválida | 401 `{cod:401, message:"Invalid API key..."}` | "Falha de autenticação com o serviço de clima"; **sem retry**; a key não aparece na tela |
| FA-02 | Cidade não encontrada | 404 `{cod:"404", message:"city not found"}` | "Cidade não encontrada"; card anterior removido |
| FA-03 | Limite de requisições | 429 | "Muitas requisições, tente em instantes"; sem retry imediato |
| FA-04 | Erro interno | 500 → 500 → 500 | 3 tentativas no total (1 + 2 retries); mensagem "Serviço indisponível"; botão "Tentar novamente" |
| FA-05 | Recuperação após retry | 503 → 200 | Dados exibidos; nenhuma mensagem de erro |
| FA-06 | Sem conexão | `ProgressEvent('error')` (status 0) | "Sem conexão com a internet" |
| FA-07 | Timeout | Sem resposta por mais de 10 s | "Tempo de resposta excedido"; requisição cancelada |
| FA-08 | Falha parcial | Clima atual 200, previsão 500 | Card atual exibido + aviso "Previsão indisponível" (degradação graciosa) |
| FA-09 | Gateway | 502 sem corpo | Mensagem genérica; nada de `undefined` na tela |
| FA-10 | Spinner após erro | Qualquer erro | `loading` desaparece; botão "Buscar" reabilitado |

### 2.3 Casos de borda

| ID | Cenário | Estímulo | Resultado esperado |
|---|---|---|---|
| CB-01 | Acentos e cedilha | `"São Paulo"` | Query `q=S%C3%A3o%20Paulo`; nome exibido corretamente |
| CB-02 | Nome muito longo | 256 caracteres | Validação local bloqueia (limite de 100) **ou** truncamento; sem requisição gigante |
| CB-03 | Temperatura extrema baixa | `-89.2` | Exibe `-89 °C` (arredondado) |
| CB-04 | Temperatura extrema alta | `56.7` | Exibe `57 °C` |
| CB-05 | Zero absoluto do layout | `temp: 0` | Exibe `0 °C` (não pode virar "—" por checagem *falsy*) |
| CB-06 | Previsão vazia | `list: []` | "Sem dados de previsão"; nenhum `forecast-item` |
| CB-07 | Buscas rápidas em sequência | "Lon" → "London" | Só a última resposta é renderizada (a primeira é cancelada via `switchMap`) |
| CB-08 | Duplo clique em "Buscar" | 2 cliques seguidos | No máximo 1 requisição pendente |
| CB-09 | Erro após sucesso | Busca OK, depois 404 | Card antigo some; não mostra dado velho junto com o erro |
| CB-10 | Sucesso após erro | 404, depois 200 | Mensagem de erro some |
| CB-11 | Fuso horário | `timezone: 32400` (+9h) e `-36000` (-10h) | Horário local da cidade calculado corretamente, sem depender do fuso da máquina |
| CB-12 | Umidade/vento limites | `humidity: 100`, `wind.speed: 0` | Exibe `100%` e `0 m/s` |

---

## 3. Dados de teste

`src/testing/weather.fixtures.ts`

```typescript
import { HttpErrorResponse } from '@angular/common/http';

export const API_BASE = 'https://api.openweathermap.org/data/2.5';

/** Resposta válida e completa: base para derivar as variações inválidas. */
export const VALID_WEATHER = {
  coord: { lon: -46.6361, lat: -23.5475 },
  weather: [{ id: 800, main: 'Clear', description: 'céu limpo', icon: '01d' }],
  main: { temp: 24.6, feels_like: 24.9, temp_min: 22.1, temp_max: 26.3, pressure: 1015, humidity: 60 },
  wind: { speed: 3.6, deg: 140 },
  dt: 1729771200,
  sys: { country: 'BR', sunrise: 1729757400, sunset: 1729803600 },
  timezone: -10800,
  id: 3448439,
  name: 'São Paulo',
  cod: 200,
};

export const VALID_FORECAST = {
  cod: '200',
  message: 0,
  cnt: 2,
  list: [
    { dt: 1729782000, main: { temp: 25.1, humidity: 55 }, weather: [{ description: 'nuvens dispersas', icon: '03d' }], dt_txt: '2026-10-24 15:00:00' },
    { dt: 1729792800, main: { temp: 21.4, humidity: 70 }, weather: [{ description: 'chuva leve', icon: '10n' }], dt_txt: '2026-10-24 18:00:00' },
  ],
  city: { name: 'São Paulo', country: 'BR', timezone: -10800 },
};

// ---------- Dados inválidos (payload) ----------
export const INVALID_PAYLOADS = {
  missingMain: (() => { const { main, ...rest } = VALID_WEATHER; return rest; })(),
  emptyWeatherArray: { ...VALID_WEATHER, weather: [] },
  tempAsString: { ...VALID_WEATHER, main: { ...VALID_WEATHER.main, temp: 'abc' } },
  tempNull: { ...VALID_WEATHER, main: { ...VALID_WEATHER.main, temp: null } },
  htmlBody: '<html><body>502 Bad Gateway</body></html>',
  errorCodeInBody: { cod: '404', message: 'city not found' },
};

// ---------- Corpos de erro reais do OpenWeatherMap ----------
export const API_ERRORS = {
  unauthorized: {
    status: 401, statusText: 'Unauthorized',
    body: { cod: 401, message: 'Invalid API key. Please see https://openweathermap.org/faq#error401 for more info.' },
  },
  notFound: { status: 404, statusText: 'Not Found', body: { cod: '404', message: 'city not found' } },
  tooManyRequests: {
    status: 429, statusText: 'Too Many Requests',
    body: { cod: 429, message: 'Your account is temporary blocked due to exceeding of requests limitation of your subscription type.' },
  },
  internal: { status: 500, statusText: 'Internal Server Error', body: { cod: 500, message: 'Internal error' } },
  unavailable: { status: 503, statusText: 'Service Unavailable', body: null },
  badGateway: { status: 502, statusText: 'Bad Gateway', body: null },
};

// ---------- Entradas do usuário ----------
export const USER_INPUTS = {
  empty: '',
  whitespace: '    ',
  numeric: '12345',
  xss: '<script>alert(1)</script>',
  queryInjection: 'London&appid=HACK',
  accented: 'São Paulo',
  tooLong: 'A'.repeat(256),
};

// ---------- Casos de borda ----------
export const EDGE_VALUES = {
  coldest: { ...VALID_WEATHER, name: 'Vostok', main: { ...VALID_WEATHER.main, temp: -89.2 } },
  hottest: { ...VALID_WEATHER, name: 'Death Valley', main: { ...VALID_WEATHER.main, temp: 56.7 } },
  zeroTemp: { ...VALID_WEATHER, main: { ...VALID_WEATHER.main, temp: 0 } },
  limits: { ...VALID_WEATHER, main: { ...VALID_WEATHER.main, humidity: 100 }, wind: { speed: 0, deg: 0 } },
  tokyo: { ...VALID_WEATHER, name: 'Tokyo', timezone: 32400, dt: 1729771200 },   // 12:00 UTC → 21:00 local
  honolulu: { ...VALID_WEATHER, name: 'Honolulu', timezone: -36000, dt: 1729771200 }, // 12:00 UTC → 02:00 local
  emptyForecast: { ...VALID_FORECAST, cnt: 0, list: [] },
};

export const networkError = () => new ProgressEvent('error');
export const isHttpError = (e: unknown): e is HttpErrorResponse => e instanceof HttpErrorResponse;
```

---

## 4. Código de apoio (contrato esperado do serviço e do interceptor)

Incluo aqui só como referência do comportamento que os testes validam. Se o seu código já existe, compare o contrato.

`src/app/core/weather-error.interceptor.ts`

```typescript
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, retry, throwError, timeout, timer, TimeoutError } from 'rxjs';

export interface WeatherError { code: string; message: string; }

const RETRYABLE = (status: number) => status === 0 || status >= 500;

export const weatherErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    timeout(10_000),
    retry({
      count: 2,
      delay: (err, attempt) =>
        err instanceof HttpErrorResponse && RETRYABLE(err.status)
          ? timer(attempt * 500)
          : throwError(() => err),
    }),
    catchError((err) => throwError(() => toWeatherError(err))),
  );

export function toWeatherError(err: unknown): WeatherError {
  if (err instanceof TimeoutError) return { code: 'TIMEOUT', message: 'Tempo de resposta excedido' };
  if (!(err instanceof HttpErrorResponse)) return { code: 'UNKNOWN', message: 'Erro inesperado' };
  switch (true) {
    case err.status === 0:   return { code: 'NETWORK', message: 'Sem conexão com a internet' };
    case err.status === 401: return { code: 'AUTH', message: 'Falha de autenticação com o serviço de clima' };
    case err.status === 404: return { code: 'NOT_FOUND', message: 'Cidade não encontrada' };
    case err.status === 429: return { code: 'RATE_LIMIT', message: 'Muitas requisições, tente em instantes' };
    case err.status >= 500:  return { code: 'SERVER', message: 'Serviço indisponível' };
    default:                 return { code: 'UNKNOWN', message: 'Erro inesperado' };
  }
}
```

---

## 5. Testes de integração: serviço + interceptor

`src/app/core/weather.service.integration.spec.ts`

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { WeatherService } from './weather.service';
import { weatherErrorInterceptor, WeatherError } from './weather-error.interceptor';
import { API_BASE, API_ERRORS, INVALID_PAYLOADS, USER_INPUTS, VALID_WEATHER, networkError } from '../../testing/weather.fixtures';

describe('WeatherService (integração com interceptor) - cenários de erro', () => {
  let service: WeatherService;
  let http: HttpTestingController;

  const matchWeather = (r: { url: string }) => r.url === `${API_BASE}/weather`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([weatherErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(WeatherService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify()); // garante que não sobrou requisição inesperada

  function expectError(done: DoneFn | null, code: string) {
    return {
      next: () => fail('deveria ter falhado'),
      error: (e: WeatherError) => { expect(e.code).toBe(code); done?.(); },
    };
  }

  // ---------- FA-01 ----------
  it('FA-01: 401 vira AUTH e NÃO faz retry', (done) => {
    service.getCurrentWeather('London').subscribe(expectError(done, 'AUTH'));
    const { body, ...opts } = API_ERRORS.unauthorized;
    http.expectOne(matchWeather).flush(body, opts);
    http.expectNone(matchWeather); // nenhuma segunda tentativa
  });

  // ---------- FA-02 ----------
  it('FA-02: 404 vira NOT_FOUND sem retry', (done) => {
    service.getCurrentWeather('Cidadeinexistente').subscribe(expectError(done, 'NOT_FOUND'));
    const { body, ...opts } = API_ERRORS.notFound;
    http.expectOne(matchWeather).flush(body, opts);
  });

  // ---------- FA-03 ----------
  it('FA-03: 429 vira RATE_LIMIT sem retry', (done) => {
    service.getCurrentWeather('London').subscribe(expectError(done, 'RATE_LIMIT'));
    const { body, ...opts } = API_ERRORS.tooManyRequests;
    http.expectOne(matchWeather).flush(body, opts);
    http.expectNone(matchWeather);
  });

  // ---------- FA-04 ----------
  it('FA-04: 500 é tentado 3 vezes no total e então falha com SERVER', fakeAsync(() => {
    let erro: WeatherError | undefined;
    service.getCurrentWeather('London').subscribe({ error: (e) => (erro = e) });
    const { body, ...opts } = API_ERRORS.internal;

    http.expectOne(matchWeather).flush(body, opts); // tentativa 1
    tick(500);
    http.expectOne(matchWeather).flush(body, opts); // retry 1
    tick(1000);
    http.expectOne(matchWeather).flush(body, opts); // retry 2

    expect(erro?.code).toBe('SERVER');
  }));

  // ---------- FA-05 ----------
  it('FA-05: 503 seguido de 200 recupera sem erro', fakeAsync(() => {
    let nome: string | undefined;
    let erro: unknown;
    service.getCurrentWeather('São Paulo').subscribe({ next: (w) => (nome = w.name), error: (e) => (erro = e) });

    const { body, ...opts } = API_ERRORS.unavailable;
    http.expectOne(matchWeather).flush(body, opts);
    tick(500);
    http.expectOne(matchWeather).flush(VALID_WEATHER);

    expect(erro).toBeUndefined();
    expect(nome).toBe('São Paulo');
  }));

  // ---------- FA-06 ----------
  it('FA-06: erro de rede (status 0) vira NETWORK após esgotar retries', fakeAsync(() => {
    let erro: WeatherError | undefined;
    service.getCurrentWeather('London').subscribe({ error: (e) => (erro = e) });

    http.expectOne(matchWeather).error(networkError());
    tick(500);
    http.expectOne(matchWeather).error(networkError());
    tick(1000);
    http.expectOne(matchWeather).error(networkError());

    expect(erro?.code).toBe('NETWORK');
  }));

  // ---------- FA-07 ----------
  it('FA-07: sem resposta em 10 s vira TIMEOUT e a requisição é cancelada', fakeAsync(() => {
    let erro: WeatherError | undefined;
    service.getCurrentWeather('London').subscribe({ error: (e) => (erro = e) });

    const req = http.expectOne(matchWeather);
    tick(10_001);

    expect(req.cancelled).toBeTrue();
    expect(erro?.code).toBe('TIMEOUT');
  }));

  // ---------- DI-05 / CB-01 ----------
  it('DI-05: caracteres de controle de query são codificados e não sobrescrevem appid', () => {
    service.getCurrentWeather(USER_INPUTS.queryInjection).subscribe();
    const req = http.expectOne(matchWeather);

    expect(req.request.params.get('q')).toBe('London&appid=HACK');
    expect(req.request.params.getAll('appid')?.length).toBe(1);
    expect(req.request.params.get('appid')).not.toBe('HACK');
    expect(req.request.urlWithParams).toContain('q=London%26appid%3DHACK');
    req.flush(VALID_WEATHER);
  });

  it('CB-01: nome acentuado é enviado com encoding UTF-8 correto', () => {
    service.getCurrentWeather(USER_INPUTS.accented).subscribe();
    const req = http.expectOne(matchWeather);
    expect(req.request.urlWithParams).toMatch(/q=S%C3%A3o(%20|\+)Paulo/);
    req.flush(VALID_WEATHER);
  });

  // ---------- DI-09 ----------
  it('DI-09: corpo HTML com status 200 resulta em erro, não em sucesso', (done) => {
    service.getCurrentWeather('London').subscribe({
      next: () => fail('não deveria emitir sucesso'),
      error: (e: WeatherError) => { expect(e.code).toBeDefined(); done(); },
    });
    // responseType json + corpo texto → HttpClient lança erro de parse
    http.expectOne(matchWeather).flush(INVALID_PAYLOADS.htmlBody, {
      status: 200, statusText: 'OK', headers: { 'Content-Type': 'text/html' },
    });
  });

  // ---------- DI-10 ----------
  it('DI-10: corpo com cod "404" e status 200 é tratado como erro', (done) => {
    service.getCurrentWeather('X').subscribe(expectError(done, 'NOT_FOUND'));
    http.expectOne(matchWeather).flush(INVALID_PAYLOADS.errorCodeInBody);
  });
});
```

> **Observação sobre o DI-09:** o comportamento depende da versão do Angular. No `HttpTestingController`, `flush` de string com `responseType: 'json'` pode chegar como string em vez de erro. Se for o seu caso, o serviço deve validar o formato (`typeof body === 'object' && 'main' in body`). Isso é justamente o que o teste força a existir.

---

## 6. Testes de integração: componente + serviço + interceptor + DOM

`src/app/features/dashboard/weather-dashboard.component.integration.spec.ts`

```typescript
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';

import { WeatherDashboardComponent } from './weather-dashboard.component';
import { weatherErrorInterceptor } from '../../core/weather-error.interceptor';
import {
  API_BASE, API_ERRORS, EDGE_VALUES, INVALID_PAYLOADS, USER_INPUTS,
  VALID_FORECAST, VALID_WEATHER, networkError,
} from '../../../testing/weather.fixtures';

describe('WeatherDashboardComponent (integração) - cenários de erro', () => {
  let fixture: ComponentFixture<WeatherDashboardComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const weatherReq = (r: { url: string }) => r.url === `${API_BASE}/weather`;
  const forecastReq = (r: { url: string }) => r.url === `${API_BASE}/forecast`;

  const $ = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const $$ = (id: string) => el.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherDashboardComponent],
      providers: [
        provideHttpClient(withInterceptors([weatherErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WeatherDashboardComponent);
    el = fixture.nativeElement;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  /** Digita no campo e clica em Buscar, como o usuário faria. */
  function search(city: string) {
    const input = $('city-input') as HTMLInputElement;
    input.value = city;
    input.dispatchEvent(new Event('input'));
    $('search-btn')!.click();
    fixture.detectChanges();
  }

  function flushError(req: TestRequest, err: { status: number; statusText: string; body: unknown }) {
    req.flush(err.body, { status: err.status, statusText: err.statusText });
    fixture.detectChanges();
  }

  function flushSuccess(weather: unknown = VALID_WEATHER, forecast: unknown = VALID_FORECAST) {
    http.expectOne(weatherReq).flush(weather);
    http.expectOne(forecastReq).flush(forecast);
    fixture.detectChanges();
  }

  // ======================= DADOS INVÁLIDOS =======================

  describe('Dados inválidos', () => {
    it('DI-01: cidade vazia não dispara requisição e mostra validação', () => {
      search(USER_INPUTS.empty);
      http.expectNone(weatherReq);
      expect($('error-msg')?.textContent).toContain('Informe o nome de uma cidade');
    });

    it('DI-02: apenas espaços é tratado como vazio', () => {
      search(USER_INPUTS.whitespace);
      http.expectNone(weatherReq);
      expect($('error-msg')?.textContent).toContain('Informe o nome de uma cidade');
    });

    it('DI-04: conteúdo com <script> é escapado no DOM', () => {
      search(USER_INPUTS.xss);
      const req = http.expectOne(weatherReq);
      flushError(req, API_ERRORS.notFound);

      expect(el.querySelector('script')).toBeNull();
      expect(el.innerHTML).not.toContain('<script>alert(1)</script>');
    });

    it('DI-06: payload sem "main" mostra erro de dados incompletos sem quebrar', () => {
      const consoleErr = spyOn(console, 'error');
      search('London');
      http.expectOne(weatherReq).flush(INVALID_PAYLOADS.missingMain);
      http.expectOne(forecastReq).flush(VALID_FORECAST);
      fixture.detectChanges();

      expect($('error-msg')?.textContent).toContain('Dados de clima incompletos');
      expect($('weather-card')).toBeNull();
      expect(consoleErr).not.toHaveBeenCalledWith(jasmine.objectContaining({ name: 'TypeError' }));
    });

    it('DI-07: weather vazio renderiza card com fallback', () => {
      search('London');
      flushSuccess(INVALID_PAYLOADS.emptyWeatherArray);
      expect($('weather-card')).not.toBeNull();
      expect($('weather-card')!.textContent).toContain('—');
    });

    it('DI-08: temperatura não numérica nunca exibe "NaN"', () => {
      search('London');
      flushSuccess(INVALID_PAYLOADS.tempAsString);
      expect($('temp')?.textContent).not.toContain('NaN');
      expect($('temp')?.textContent?.trim()).toBe('—');
    });

    it('DI-08b: temperatura null exibe fallback', () => {
      search('London');
      flushSuccess(INVALID_PAYLOADS.tempNull);
      expect($('temp')?.textContent?.trim()).toBe('—');
    });
  });

  // ======================= FALHAS DA API =======================

  describe('Falhas da API', () => {
    it('FA-01: 401 mostra erro de autenticação e não vaza a API key', () => {
      search('London');
      const req = http.expectOne(weatherReq);
      const apiKey = req.request.params.get('appid')!;
      flushError(req, API_ERRORS.unauthorized);
      http.match(forecastReq).forEach((r) => r.flush(API_ERRORS.unauthorized.body, { status: 401, statusText: 'Unauthorized' }));
      fixture.detectChanges();

      expect($('error-msg')?.textContent).toContain('Falha de autenticação');
      expect(el.textContent).not.toContain(apiKey);
      expect(el.textContent).not.toContain('openweathermap.org/faq'); // não repassa mensagem crua da API
    });

    it('FA-02: 404 mostra "Cidade não encontrada"', () => {
      search('Cidadeinexistente');
      flushError(http.expectOne(weatherReq), API_ERRORS.notFound);
      http.match(forecastReq).forEach((r) => r.flush(API_ERRORS.notFound.body, { status: 404, statusText: 'Not Found' }));
      fixture.detectChanges();

      expect($('error-msg')?.textContent).toContain('Cidade não encontrada');
      expect($('weather-card')).toBeNull();
    });

    it('FA-03: 429 mostra mensagem de limite', () => {
      search('London');
      flushError(http.expectOne(weatherReq), API_ERRORS.tooManyRequests);
      http.match(forecastReq).forEach((r) => r.flush(null, { status: 429, statusText: 'Too Many Requests' }));
      fixture.detectChanges();

      expect($('error-msg')?.textContent).toContain('Muitas requisições');
    });

    it('FA-04: 5xx persistente mostra "Serviço indisponível" e botão de nova tentativa', fakeAsync(() => {
      search('London');
      const { body, ...opts } = API_ERRORS.internal;

      for (const wait of [0, 500, 1000]) {
        tick(wait);
        http.match(weatherReq).forEach((r) => r.flush(body, opts));
        http.match(forecastReq).forEach((r) => r.flush(body, opts));
      }
      fixture.detectChanges();

      expect($('error-msg')?.textContent).toContain('Serviço indisponível');
      expect($('retry-btn')).not.toBeNull();

      // Clicar em "Tentar novamente" refaz a busca e sucesso limpa o erro
      $('retry-btn')!.click();
      fixture.detectChanges();
      flushSuccess();
      expect($('error-msg')).toBeNull();
      expect($('city-name')?.textContent).toContain('São Paulo');
    }));

    it('FA-06: sem conexão mostra mensagem específica', fakeAsync(() => {
      search('London');
      for (const wait of [0, 500, 1000]) {
        tick(wait);
        http.match(weatherReq).forEach((r) => r.error(networkError()));
        http.match(forecastReq).forEach((r) => r.error(networkError()));
      }
      fixture.detectChanges();

      expect($('error-msg')?.textContent).toContain('Sem conexão');
    }));

    it('FA-07: timeout mostra mensagem e remove spinner', fakeAsync(() => {
      search('London');
      expect($('loading')).not.toBeNull();

      http.expectOne(weatherReq);
      http.expectOne(forecastReq);
      tick(10_001);
      fixture.detectChanges();

      expect($('error-msg')?.textContent).toContain('Tempo de resposta excedido');
      expect($('loading')).toBeNull();
    }));

    it('FA-08: previsão falha mas clima atual é exibido (degradação graciosa)', fakeAsync(() => {
      search('São Paulo');
      http.expectOne(weatherReq).flush(VALID_WEATHER);

      const { body, ...opts } = API_ERRORS.internal;
      for (const wait of [0, 500, 1000]) {
        tick(wait);
        http.match(forecastReq).forEach((r) => r.flush(body, opts));
      }
      fixture.detectChanges();

      expect($('weather-card')).not.toBeNull();
      expect($('city-name')?.textContent).toContain('São Paulo');
      expect(el.textContent).toContain('Previsão indisponível');
      expect($$('forecast-item').length).toBe(0);
    }));

    it('FA-09: 502 sem corpo não exibe "undefined" nem "null"', fakeAsync(() => {
      search('London');
      const { body, ...opts } = API_ERRORS.badGateway;
      for (const wait of [0, 500, 1000]) {
        tick(wait);
        http.match(weatherReq).forEach((r) => r.flush(body, opts));
        http.match(forecastReq).forEach((r) => r.flush(body, opts));
      }
      fixture.detectChanges();

      expect(el.textContent).not.toMatch(/undefined|null|\[object Object\]/);
    }));

    it('FA-10: após erro, spinner some e botão Buscar volta a ficar habilitado', () => {
      search('London');
      expect(($('search-btn') as HTMLButtonElement).disabled).toBeTrue();

      flushError(http.expectOne(weatherReq), API_ERRORS.notFound);
      http.match(forecastReq).forEach((r) => r.flush(null, { status: 404, statusText: 'Not Found' }));
      fixture.detectChanges();

      expect($('loading')).toBeNull();
      expect(($('search-btn') as HTMLButtonElement).disabled).toBeFalse();
    });
  });

  // ======================= CASOS DE BORDA =======================

  describe('Casos de borda', () => {
    it('CB-02: nome com 256 caracteres é bloqueado localmente', () => {
      search(USER_INPUTS.tooLong);
      http.expectNone(weatherReq);
      expect($('error-msg')?.textContent).toContain('Nome de cidade muito longo');
    });

    it('CB-03/CB-04: temperaturas extremas são arredondadas corretamente', () => {
      search('Vostok');
      flushSuccess(EDGE_VALUES.coldest);
      expect($('temp')?.textContent).toContain('-89 °C');

      search('Death Valley');
      flushSuccess(EDGE_VALUES.hottest);
      expect($('temp')?.textContent).toContain('57 °C');
    });

    it('CB-05: temperatura 0 exibe "0 °C", não o fallback', () => {
      search('London');
      flushSuccess(EDGE_VALUES.zeroTemp);
      expect($('temp')?.textContent?.trim()).toBe('0 °C');
    });

    it('CB-06: previsão vazia mostra mensagem e nenhum item', () => {
      search('London');
      flushSuccess(VALID_WEATHER, EDGE_VALUES.emptyForecast);
      expect($$('forecast-item').length).toBe(0);
      expect(el.textContent).toContain('Sem dados de previsão');
    });

    it('CB-07: buscas em sequência cancelam a anterior (só a última é renderizada)', () => {
      search('Lon');
      const primeira = http.expectOne((r) => weatherReq(r) && r.params.get('q') === 'Lon');
      http.match(forecastReq); // descarta previsão da 1ª busca

      search('London');
      expect(primeira.cancelled).toBeTrue();

      flushSuccess({ ...VALID_WEATHER, name: 'London' });
      expect($('city-name')?.textContent).toContain('London');
    });

    it('CB-08: duplo clique gera no máximo uma requisição pendente', () => {
      const input = $('city-input') as HTMLInputElement;
      input.value = 'London';
      input.dispatchEvent(new Event('input'));
      $('search-btn')!.click();
      $('search-btn')!.click();
      fixture.detectChanges();

      const pendentes = http.match(weatherReq).filter((r) => !r.cancelled);
      expect(pendentes.length).toBe(1);
      pendentes[0].flush(VALID_WEATHER);
      http.match(forecastReq).forEach((r) => !r.cancelled && r.flush(VALID_FORECAST));
    });

    it('CB-09: erro após sucesso remove o card antigo', () => {
      search('São Paulo');
      flushSuccess();
      expect($('weather-card')).not.toBeNull();

      search('Cidadeinexistente');
      flushError(http.expectOne(weatherReq), API_ERRORS.notFound);
      http.match(forecastReq).forEach((r) => r.flush(null, { status: 404, statusText: 'Not Found' }));
      fixture.detectChanges();

      expect($('weather-card')).toBeNull();
      expect($('error-msg')).not.toBeNull();
    });

    it('CB-10: sucesso após erro limpa a mensagem de erro', () => {
      search('Cidadeinexistente');
      flushError(http.expectOne(weatherReq), API_ERRORS.notFound);
      http.match(forecastReq).forEach((r) => r.flush(null, { status: 404, statusText: 'Not Found' }));
      fixture.detectChanges();
      expect($('error-msg')).not.toBeNull();

      search('São Paulo');
      flushSuccess();
      expect($('error-msg')).toBeNull();
      expect($('weather-card')).not.toBeNull();
    });

    it('CB-11: horário local usa o timezone da cidade, não o da máquina', () => {
      search('Tokyo');
      flushSuccess(EDGE_VALUES.tokyo);
      expect(el.querySelector('[data-testid="local-time"]')?.textContent).toContain('21:00');

      search('Honolulu');
      flushSuccess(EDGE_VALUES.honolulu);
      expect(el.querySelector('[data-testid="local-time"]')?.textContent).toContain('02:00');
    });

    it('CB-12: umidade 100% e vento 0 são exibidos (não viram fallback)', () => {
      search('London');
      flushSuccess(EDGE_VALUES.limits);
      expect(el.textContent).toContain('100%');
      expect(el.textContent).toContain('0 m/s');
    });
  });
});
```

---

## 7. (Opcional) Mesma cobertura em nível de navegador com Cypress

Útil para validar o comportamento real de rede (timeout, CORS, renderização), interceptando o OpenWeatherMap.

`cypress/e2e/weather-errors.cy.ts`

```typescript
const API = 'https://api.openweathermap.org/data/2.5/**';

describe('Dashboard de clima - erros (E2E com API interceptada)', () => {
  beforeEach(() => cy.visit('/'));

  const buscar = (cidade: string) => {
    cy.get('[data-testid=city-input]').clear().type(cidade);
    cy.get('[data-testid=search-btn]').click();
  };

  it('FA-01: 401', () => {
    cy.intercept('GET', API, { statusCode: 401, fixture: 'owm-401.json' });
    buscar('London');
    cy.get('[data-testid=error-msg]').should('contain', 'Falha de autenticação');
  });

  it('FA-02: 404', () => {
    cy.intercept('GET', API, { statusCode: 404, body: { cod: '404', message: 'city not found' } });
    buscar('Xyzabc');
    cy.get('[data-testid=error-msg]').should('contain', 'Cidade não encontrada');
  });

  it('FA-06: rede caída', () => {
    cy.intercept('GET', API, { forceNetworkError: true });
    buscar('London');
    cy.get('[data-testid=error-msg]', { timeout: 15000 }).should('contain', 'Sem conexão');
  });

  it('FA-07: timeout', () => {
    cy.intercept('GET', API, (req) => req.reply({ delay: 11_000, body: {} }));
    buscar('London');
    cy.get('[data-testid=error-msg]', { timeout: 15000 }).should('contain', 'Tempo de resposta excedido');
  });

  it('DI-04: XSS não executa', () => {
    const onAlert = cy.stub();
    cy.on('window:alert', onAlert);
    cy.intercept('GET', API, { statusCode: 404, body: { cod: '404', message: 'city not found' } });
    buscar('<script>alert(1)</script>');
    cy.wrap(onAlert).should('not.have.been.called');
  });
});
```

`cypress/fixtures/owm-401.json`

```json
{ "cod": 401, "message": "Invalid API key. Please see https://openweathermap.org/faq#error401 for more info." }
```

---

## 8. Como executar

```bash
# Testes de integração (Karma/Jasmine)
ng test --include='**/*.integration.spec.ts' --watch=false --code-coverage

# E2E opcional
npx cypress run --spec cypress/e2e/weather-errors.cy.ts
```

---

## 9. Pontos de atenção

- **Retry só em 5xx/rede.** Fazer retry em 401/404/429 desperdiça cota e pode agravar o bloqueio por limite (FA-03).
- **`afterEach(() => http.verify())`** é o que torna os testes de retry confiáveis: se o interceptor fizer uma tentativa a mais ou a menos, o teste falha.
- **Checagens *falsy*** (`if (!temp)`) são a causa mais comum de bug em CB-05 e CB-12, porque `0` é um valor válido.
- **Nunca exibir a mensagem crua da API**: ela pode conter URLs internas e, em proxies mal configurados, a própria key (FA-01).
- **API key fora do bundle.** Em produção, considere passar as chamadas por um backend/proxy próprio. Nos testes, use uma key fictícia em `environment.test.ts`.
- **Seletores `data-testid`.** Se o template ainda não os tiver, adicioná-los é o primeiro passo; eles deixam os testes independentes de CSS e textos.

Se você me mandar o `WeatherService`, o componente e o template reais, ajusto os seletores, as mensagens e as assinaturas para os testes rodarem sem adaptação.
