# Testes de integração: dashboard de clima (Angular + OpenWeatherMap)

Abaixo está uma proposta de testes de integração para um dashboard de clima em Angular que consome a API do OpenWeatherMap. Como não tenho o código do seu projeto, parti de uma estrutura típica. Ajuste nomes de classes, seletores e rotas ao que você tem.

## 1. Premissas sobre a aplicação

| Elemento | Responsabilidade |
|---|---|
| `WeatherService` | Chama `GET /data/2.5/weather` (clima atual) e `GET /data/2.5/forecast` (previsão de 5 dias, de 3 em 3 horas) |
| `environment.openWeather` | `apiUrl`, `apiKey`, `units: 'metric'`, `lang: 'pt_br'` |
| `DashboardComponent` | Campo de busca por cidade, card com o clima atual, lista com a previsão, mensagens de erro e indicador de carregamento |
| `TemperaturePipe` (opcional) | Formata a temperatura (`23 °C`) |
| `localStorage` | Guarda a última cidade pesquisada |

**O que "integração" quer dizer aqui:**

1. **Integração front-end (Angular TestBed):** componente + serviço + pipes + template de verdade, com o HTTP interceptado por `HttpTestingController`. Nada de mocks do serviço.
2. **Integração ponta a ponta com a API simulada (Cypress + `cy.intercept`):** a aplicação inteira roda no navegador e a rede é controlada por fixtures.
3. **Contrato com a API real (opcional, fora do CI comum):** um teste curto que chama o OpenWeatherMap de verdade para detectar mudanças no formato da resposta.

## 2. Casos de teste

### 2.1 Serviço ↔ API (HTTP)

| ID | Cenário | Pré-condição / entrada | Resultado esperado |
|---|---|---|---|
| CT-01 | Montagem da requisição de clima atual | `getCurrentWeather('São Paulo')` | `GET {apiUrl}/weather` com `q=São Paulo`, `appid`, `units=metric`, `lang=pt_br` |
| CT-02 | Mapeamento da resposta | Resposta 200 válida | Modelo de domínio com `city`, `temperature`, `feelsLike`, `humidity`, `windSpeedKmh`, `description`, `icon` |
| CT-03 | Conversão de vento | `wind.speed = 5` (m/s) | `windSpeedKmh = 18` |
| CT-04 | Previsão agrupada por dia | Resposta de `/forecast` com 40 itens | 5 dias, cada um com mínima, máxima e ícone predominante |
| CT-05 | Busca por coordenadas | `getByCoords(-23.55, -46.63)` | Parâmetros `lat` e `lon`, sem `q` |
| CT-06 | Cidade inexistente | 404 `{"cod":"404","message":"city not found"}` | Erro de domínio `CITY_NOT_FOUND` |
| CT-07 | Chave inválida | 401 | Erro de domínio `INVALID_API_KEY` |
| CT-08 | Limite de requisições | 429 | Erro de domínio `RATE_LIMIT` |
| CT-09 | Falha de rede | `ProgressEvent` de erro (status 0) | Erro de domínio `NETWORK` |
| CT-10 | Nova tentativa em erro 5xx | Primeira chamada 503, segunda 200 | Uma nova tentativa e sucesso no final |
| CT-11 | Sem nova tentativa em 4xx | 404 | Apenas uma requisição |
| CT-12 | Cache em memória | Duas buscas seguidas pela mesma cidade dentro do TTL | Apenas uma requisição HTTP |

### 2.2 Componente ↔ Serviço ↔ API (TestBed)

| ID | Cenário | Ação | Resultado esperado |
|---|---|---|---|
| CT-13 | Busca com sucesso | Digitar "Curitiba" e clicar em Buscar | Card mostra "Curitiba", "18 °C", "nublado", umidade e vento |
| CT-14 | Loading | Busca enviada e resposta ainda pendente | Spinner visível e botão desabilitado; somem depois da resposta |
| CT-15 | Previsão renderizada | Busca com sucesso | 5 itens na lista de previsão |
| CT-16 | Cidade não encontrada | API responde 404 | Mensagem "Cidade não encontrada" e card anterior removido |
| CT-17 | Erro genérico | API responde 500 duas vezes | Mensagem "Não foi possível carregar o clima. Tente novamente." |
| CT-18 | Validação de entrada | Campo vazio ou só espaços | Nenhuma requisição enviada e botão desabilitado |
| CT-19 | Debounce na digitação | Digitação rápida de "Rio" | Apenas uma requisição depois de 400 ms |
| CT-20 | Cancelamento de requisição antiga | Busca "Rio" e logo depois "Recife" | Primeira requisição cancelada; tela mostra Recife |
| CT-21 | Persistência | Busca com sucesso | `localStorage['ultimaCidade']` = cidade buscada |
| CT-22 | Carregamento inicial | `localStorage` com "Natal" | Ao abrir o dashboard, busca automática por Natal |
| CT-23 | Ícone | Resposta com `icon = "04d"` | `<img>` com `src` `https://openweathermap.org/img/wn/04d@2x.png` e `alt` com a descrição |
| CT-24 | Troca de unidade | Clicar em °F | Nova requisição com `units=imperial` e exibição em °F |

### 2.3 Ponta a ponta com API simulada (Cypress)

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-25 | Fluxo completo de busca | Usuário busca, vê o clima atual e a previsão |
| CT-26 | Erro 404 visível ao usuário | Mensagem amigável e campo mantém o texto |
| CT-27 | Timeout / lentidão | Spinner aparece; resposta lenta é tratada sem travar a tela |
| CT-28 | Geolocalização | Com permissão concedida, busca por `lat`/`lon` |
| CT-29 | Chave nunca exposta na interface | O `appid` não aparece no DOM |

### 2.4 Contrato com a API real (opcional)

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT-30 | Formato de `/weather` | Campos `name`, `main.temp`, `weather[0].description`, `weather[0].icon`, `wind.speed` existem com o tipo esperado |
| CT-31 | Formato de `/forecast` | `list` com 40 itens, cada um com `dt`, `main.temp_min`, `main.temp_max` |

## 3. Código de apoio (referência)

Os testes abaixo partem deste serviço e deste componente. Se o seu código for diferente, adapte só os seletores e nomes.

### `src/app/core/weather.models.ts`

```ts
export interface CurrentWeather {
  city: string;
  country: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeedKmh: number;
  description: string;
  icon: string;
}

export interface DailyForecast {
  date: string; // yyyy-MM-dd
  min: number;
  max: number;
  icon: string;
}

export type WeatherErrorCode =
  | 'CITY_NOT_FOUND'
  | 'INVALID_API_KEY'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'UNKNOWN';

export class WeatherError extends Error {
  constructor(public readonly code: WeatherErrorCode) {
    super(code);
  }
}

export type Units = 'metric' | 'imperial';
```

### `src/app/core/weather.service.ts`

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, retry, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { CurrentWeather, DailyForecast, Units, WeatherError } from './weather.models';

const CACHE_TTL_MS = 10 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);
  private cfg = environment.openWeather;
  private cache = new Map<string, { at: number; data: CurrentWeather }>();

  getCurrentWeather(city: string, units: Units = 'metric'): Observable<CurrentWeather> {
    const key = `${city.toLowerCase()}|${units}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return of(hit.data);
    }
    return this.http
      .get<any>(`${this.cfg.apiUrl}/weather`, { params: this.params({ q: city }, units) })
      .pipe(
        retry({ count: 1, delay: (err) => this.retryDelay(err) }),
        map((r) => this.toCurrent(r)),
        tap((data) => this.cache.set(key, { at: Date.now(), data })),
        catchError((e) => this.toDomainError(e)),
      );
  }

  getByCoords(lat: number, lon: number, units: Units = 'metric'): Observable<CurrentWeather> {
    return this.http
      .get<any>(`${this.cfg.apiUrl}/weather`, {
        params: this.params({ lat: String(lat), lon: String(lon) }, units),
      })
      .pipe(map((r) => this.toCurrent(r)), catchError((e) => this.toDomainError(e)));
  }

  getForecast(city: string, units: Units = 'metric'): Observable<DailyForecast[]> {
    return this.http
      .get<any>(`${this.cfg.apiUrl}/forecast`, { params: this.params({ q: city }, units) })
      .pipe(
        retry({ count: 1, delay: (err) => this.retryDelay(err) }),
        map((r) => this.toDaily(r.list)),
        catchError((e) => this.toDomainError(e)),
      );
  }

  private params(extra: Record<string, string>, units: Units): HttpParams {
    return new HttpParams({
      fromObject: { ...extra, appid: this.cfg.apiKey, units, lang: 'pt_br' },
    });
  }

  private retryDelay(err: unknown) {
    if (err instanceof HttpErrorResponse && err.status >= 500) {
      return timer(500);
    }
    return throwError(() => err);
  }

  private toCurrent(r: any): CurrentWeather {
    return {
      city: r.name,
      country: r.sys?.country,
      temperature: Math.round(r.main.temp),
      feelsLike: Math.round(r.main.feels_like),
      humidity: r.main.humidity,
      windSpeedKmh: Math.round(r.wind.speed * 3.6),
      description: r.weather[0].description,
      icon: r.weather[0].icon,
    };
  }

  private toDaily(list: any[]): DailyForecast[] {
    const byDay = new Map<string, any[]>();
    for (const item of list) {
      const day = item.dt_txt.substring(0, 10);
      byDay.set(day, [...(byDay.get(day) ?? []), item]);
    }
    return [...byDay.entries()].slice(0, 5).map(([date, items]) => ({
      date,
      min: Math.round(Math.min(...items.map((i) => i.main.temp_min))),
      max: Math.round(Math.max(...items.map((i) => i.main.temp_max))),
      icon: (items.find((i) => i.dt_txt.endsWith('12:00:00')) ?? items[0]).weather[0].icon,
    }));
  }

  private toDomainError(e: unknown): Observable<never> {
    if (!(e instanceof HttpErrorResponse)) {
      return throwError(() => new WeatherError('UNKNOWN'));
    }
    const code =
      e.status === 0 ? 'NETWORK'
      : e.status === 401 ? 'INVALID_API_KEY'
      : e.status === 404 ? 'CITY_NOT_FOUND'
      : e.status === 429 ? 'RATE_LIMIT'
      : 'UNKNOWN';
    return throwError(() => new WeatherError(code));
  }
}
```

### Seletores usados no template (`data-testid`)

```html
<input data-testid="campo-cidade" ... />
<button data-testid="btn-buscar" ...>Buscar</button>
<button data-testid="btn-unidade-f">°F</button>
<div data-testid="loading" *ngIf="loading">Carregando...</div>
<p data-testid="erro" *ngIf="erro">{{ erro }}</p>
<section data-testid="card-atual" *ngIf="atual">
  <h2 data-testid="nome-cidade">{{ atual.city }}</h2>
  <span data-testid="temperatura">{{ atual.temperature }} °{{ unidade === 'metric' ? 'C' : 'F' }}</span>
  <span data-testid="descricao">{{ atual.description }}</span>
  <span data-testid="umidade">{{ atual.humidity }}%</span>
  <span data-testid="vento">{{ atual.windSpeedKmh }} km/h</span>
  <img data-testid="icone" [src]="'https://openweathermap.org/img/wn/' + atual.icon + '@2x.png'" [alt]="atual.description" />
</section>
<li data-testid="item-previsao" *ngFor="let d of previsao">...</li>
```

## 4. Fixtures compartilhadas

### `src/testing/fixtures/weather.fixtures.ts`

```ts
export const CURRENT_CURITIBA = {
  coord: { lon: -49.27, lat: -25.43 },
  weather: [{ id: 804, main: 'Clouds', description: 'nublado', icon: '04d' }],
  main: { temp: 17.6, feels_like: 17.2, temp_min: 16, temp_max: 19, pressure: 1018, humidity: 82 },
  wind: { speed: 5, deg: 90 },
  sys: { country: 'BR' },
  name: 'Curitiba',
  cod: 200,
};

export const CURRENT_RECIFE = {
  ...CURRENT_CURITIBA,
  weather: [{ id: 800, main: 'Clear', description: 'céu limpo', icon: '01d' }],
  main: { ...CURRENT_CURITIBA.main, temp: 29.4, feels_like: 32.1, humidity: 70 },
  name: 'Recife',
};

/** Gera 40 itens (5 dias x 8 leituras) a partir de uma data base. */
export function buildForecast(baseDate = '2026-10-24'): any {
  const list = [];
  const start = new Date(`${baseDate}T00:00:00Z`).getTime();
  for (let i = 0; i < 40; i++) {
    const dt = new Date(start + i * 3 * 3600 * 1000);
    const dtTxt = dt.toISOString().replace('T', ' ').substring(0, 19);
    list.push({
      dt: dt.getTime() / 1000,
      dt_txt: dtTxt,
      main: { temp: 20, temp_min: 14 + (i % 8), temp_max: 18 + (i % 8) },
      weather: [{ description: 'nuvens dispersas', icon: dtTxt.endsWith('12:00:00') ? '03d' : '03n' }],
    });
  }
  return { cod: '200', cnt: 40, list, city: { name: 'Curitiba', country: 'BR' } };
}

export const NOT_FOUND = { cod: '404', message: 'city not found' };
export const UNAUTHORIZED = { cod: 401, message: 'Invalid API key.' };
```

### `src/environments/environment.test.ts` (ou configure no `TestBed`)

```ts
export const environment = {
  production: false,
  openWeather: {
    apiUrl: 'https://api.openweathermap.org/data/2.5',
    apiKey: 'chave-de-teste',
    units: 'metric',
    lang: 'pt_br',
  },
};
```

## 5. Testes de integração: serviço ↔ HTTP (Jasmine + TestBed)

### `src/app/core/weather.service.integration.spec.ts`

```ts
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WeatherService } from './weather.service';
import { WeatherError } from './weather.models';
import { environment } from '../../environments/environment';
import {
  CURRENT_CURITIBA, NOT_FOUND, UNAUTHORIZED, buildForecast,
} from '../../testing/fixtures/weather.fixtures';

describe('WeatherService (integração HTTP)', () => {
  let service: WeatherService;
  let http: HttpTestingController;
  const api = environment.openWeather.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WeatherService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify()); // garante que nenhuma requisição ficou sem resposta

  it('CT-01: monta a requisição de clima atual com os parâmetros corretos', () => {
    service.getCurrentWeather('São Paulo').subscribe();

    const req = http.expectOne((r) => r.url === `${api}/weather`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('São Paulo');
    expect(req.request.params.get('appid')).toBe(environment.openWeather.apiKey);
    expect(req.request.params.get('units')).toBe('metric');
    expect(req.request.params.get('lang')).toBe('pt_br');
    req.flush(CURRENT_CURITIBA);
  });

  it('CT-02 e CT-03: mapeia a resposta e converte o vento para km/h', () => {
    let result: any;
    service.getCurrentWeather('Curitiba').subscribe((r) => (result = r));

    http.expectOne((r) => r.url === `${api}/weather`).flush(CURRENT_CURITIBA);

    expect(result).toEqual({
      city: 'Curitiba',
      country: 'BR',
      temperature: 18,
      feelsLike: 17,
      humidity: 82,
      windSpeedKmh: 18,
      description: 'nublado',
      icon: '04d',
    });
  });

  it('CT-04: agrupa a previsão de 3 em 3 horas em 5 dias', () => {
    let dias: any[] = [];
    service.getForecast('Curitiba').subscribe((r) => (dias = r));

    http.expectOne((r) => r.url === `${api}/forecast`).flush(buildForecast('2026-10-24'));

    expect(dias.length).toBe(5);
    expect(dias[0]).toEqual({ date: '2026-10-24', min: 14, max: 25, icon: '03d' });
  });

  it('CT-05: busca por coordenadas envia lat/lon e não envia q', () => {
    service.getByCoords(-23.55, -46.63).subscribe();

    const req = http.expectOne((r) => r.url === `${api}/weather`);
    expect(req.request.params.get('lat')).toBe('-23.55');
    expect(req.request.params.get('lon')).toBe('-46.63');
    expect(req.request.params.has('q')).toBeFalse();
    req.flush(CURRENT_CURITIBA);
  });

  const casosDeErro: Array<[string, number, any, string]> = [
    ['CT-06', 404, NOT_FOUND, 'CITY_NOT_FOUND'],
    ['CT-07', 401, UNAUTHORIZED, 'INVALID_API_KEY'],
    ['CT-08', 429, { cod: 429, message: 'limit' }, 'RATE_LIMIT'],
  ];

  casosDeErro.forEach(([id, status, body, code]) => {
    it(`${id}: HTTP ${status} vira erro de domínio ${code} sem nova tentativa (CT-11)`, () => {
      let erro: WeatherError | undefined;
      service.getCurrentWeather('X').subscribe({ error: (e) => (erro = e) });

      http.expectOne((r) => r.url === `${api}/weather`)
        .flush(body, { status, statusText: 'Erro' });

      expect(erro).toEqual(jasmine.any(WeatherError));
      expect(erro!.code).toBe(code as any);
      // http.verify() no afterEach falha se houver uma segunda requisição
    });
  });

  it('CT-09: falha de rede vira erro NETWORK', () => {
    let erro: WeatherError | undefined;
    service.getCurrentWeather('Curitiba').subscribe({ error: (e) => (erro = e) });

    http.expectOne((r) => r.url === `${api}/weather`)
      .error(new ProgressEvent('error'), { status: 0 });

    expect(erro!.code).toBe('NETWORK');
  });

  it('CT-10: tenta de novo uma vez em 5xx e conclui com sucesso', fakeAsync(() => {
    let result: any;
    service.getCurrentWeather('Curitiba').subscribe((r) => (result = r));

    http.expectOne((r) => r.url === `${api}/weather`)
      .flush({}, { status: 503, statusText: 'Service Unavailable' });

    tick(500); // atraso do retry

    http.expectOne((r) => r.url === `${api}/weather`).flush(CURRENT_CURITIBA);
    expect(result.city).toBe('Curitiba');
  }));

  it('CT-12: usa cache para a mesma cidade dentro do TTL', () => {
    service.getCurrentWeather('Curitiba').subscribe();
    http.expectOne((r) => r.url === `${api}/weather`).flush(CURRENT_CURITIBA);

    let segunda: any;
    service.getCurrentWeather('curitiba').subscribe((r) => (segunda = r));

    http.expectNone((r) => r.url === `${api}/weather`);
    expect(segunda.city).toBe('Curitiba');
  });
});
```

## 6. Testes de integração: componente ↔ serviço ↔ HTTP

Aqui o `DashboardComponent` é renderizado de verdade, com o `WeatherService` real. Só a camada HTTP é simulada.

### `src/app/dashboard/dashboard.integration.spec.ts`

```ts
import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { DashboardComponent } from './dashboard.component';
import { environment } from '../../environments/environment';
import {
  CURRENT_CURITIBA, CURRENT_RECIFE, NOT_FOUND, buildForecast,
} from '../../testing/fixtures/weather.fixtures';

describe('DashboardComponent (integração)', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let http: HttpTestingController;
  const api = environment.openWeather.apiUrl;

  // Helpers de DOM
  const $ = (id: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
  const $$ = (id: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${id}"]`));

  function digitar(cidade: string) {
    const input = $('campo-cidade') as HTMLInputElement;
    input.value = cidade;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function buscar(cidade: string) {
    digitar(cidade);
    ($('btn-buscar') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  const reqWeather = () => http.expectOne((r) => r.url === `${api}/weather`);
  const reqForecast = () => http.expectOne((r) => r.url === `${api}/forecast`);

  function responderSucesso(atual = CURRENT_CURITIBA) {
    reqWeather().flush(atual);
    reqForecast().flush(buildForecast());
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent], // standalone
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('CT-13 e CT-15: mostra o clima atual e a previsão depois de uma busca com sucesso', fakeAsync(() => {
    buscar('Curitiba');
    tick(400);
    responderSucesso();

    expect($('nome-cidade')!.textContent).toContain('Curitiba');
    expect($('temperatura')!.textContent).toContain('18 °C');
    expect($('descricao')!.textContent).toContain('nublado');
    expect($('umidade')!.textContent).toContain('82%');
    expect($('vento')!.textContent).toContain('18 km/h');
    expect($$('item-previsao').length).toBe(5);
  }));

  it('CT-14: exibe o loading e desabilita o botão enquanto espera a API', fakeAsync(() => {
    buscar('Curitiba');
    tick(400);
    fixture.detectChanges();

    expect($('loading')).not.toBeNull();
    expect(($('btn-buscar') as HTMLButtonElement).disabled).toBeTrue();

    responderSucesso();

    expect($('loading')).toBeNull();
    expect(($('btn-buscar') as HTMLButtonElement).disabled).toBeFalse();
  }));

  it('CT-16: mostra "Cidade não encontrada" e remove o card anterior', fakeAsync(() => {
    buscar('Curitiba');
    tick(400);
    responderSucesso();
    expect($('card-atual')).not.toBeNull();

    buscar('Cidadequenaoexiste');
    tick(400);
    reqWeather().flush(NOT_FOUND, { status: 404, statusText: 'Not Found' });
    // a previsão pode ter sido disparada em paralelo; responde-se para não sobrar pendência
    http.match((r) => r.url === `${api}/forecast`)
      .forEach((r) => r.flush(NOT_FOUND, { status: 404, statusText: 'Not Found' }));
    fixture.detectChanges();

    expect($('erro')!.textContent).toContain('Cidade não encontrada');
    expect($('card-atual')).toBeNull();
  }));

  it('CT-17: mostra mensagem genérica quando a API falha mesmo após nova tentativa', fakeAsync(() => {
    buscar('Curitiba');
    tick(400);

    const erro500 = (r: TestRequest) => r.flush({}, { status: 500, statusText: 'Server Error' });
    http.match((r) => r.url.startsWith(api)).forEach(erro500);
    tick(500);
    http.match((r) => r.url.startsWith(api)).forEach(erro500);
    fixture.detectChanges();

    expect($('erro')!.textContent).toContain('Não foi possível carregar o clima');
    flush();
  }));

  it('CT-18: não envia requisição com o campo vazio ou só com espaços', fakeAsync(() => {
    digitar('   ');
    tick(400);

    expect(($('btn-buscar') as HTMLButtonElement).disabled).toBeTrue();
    http.expectNone((r) => r.url.startsWith(api));
  }));

  it('CT-19: aplica debounce e envia só uma requisição para digitação rápida', fakeAsync(() => {
    digitar('R');
    tick(100);
    digitar('Ri');
    tick(100);
    digitar('Rio');
    tick(400);

    const reqs = http.match((r) => r.url === `${api}/weather`);
    expect(reqs.length).toBe(1);
    expect(reqs[0].request.params.get('q')).toBe('Rio');
    reqs[0].flush({ ...CURRENT_CURITIBA, name: 'Rio de Janeiro' });
    reqForecast().flush(buildForecast());
  }));

  it('CT-20: cancela a busca antiga quando uma nova é feita (switchMap)', fakeAsync(() => {
    buscar('Rio');
    tick(400);
    const antiga = reqWeather();
    http.match((r) => r.url === `${api}/forecast`); // descarta a previsão pendente

    buscar('Recife');
    tick(400);

    expect(antiga.cancelled).toBeTrue();
    reqWeather().flush(CURRENT_RECIFE);
    reqForecast().flush(buildForecast());
    fixture.detectChanges();

    expect($('nome-cidade')!.textContent).toContain('Recife');
  }));

  it('CT-21: grava a última cidade no localStorage', fakeAsync(() => {
    buscar('Curitiba');
    tick(400);
    responderSucesso();

    expect(localStorage.getItem('ultimaCidade')).toBe('Curitiba');
  }));

  it('CT-23: monta a URL do ícone e o texto alternativo', fakeAsync(() => {
    buscar('Curitiba');
    tick(400);
    responderSucesso();

    const img = $('icone') as HTMLImageElement;
    expect(img.src).toBe('https://openweathermap.org/img/wn/04d@2x.png');
    expect(img.alt).toBe('nublado');
  }));

  it('CT-24: trocar para °F refaz a busca com units=imperial', fakeAsync(() => {
    buscar('Curitiba');
    tick(400);
    responderSucesso();

    ($('btn-unidade-f') as HTMLButtonElement).click();
    fixture.detectChanges();
    tick(400);

    const req = reqWeather();
    expect(req.request.params.get('units')).toBe('imperial');
    req.flush({ ...CURRENT_CURITIBA, main: { ...CURRENT_CURITIBA.main, temp: 63.7 } });
    reqForecast().flush(buildForecast());
    fixture.detectChanges();

    expect($('temperatura')!.textContent).toContain('64 °F');
  }));
});

describe('DashboardComponent (carregamento inicial)', () => {
  it('CT-22: busca automaticamente a última cidade salva', fakeAsync(() => {
    localStorage.setItem('ultimaCidade', 'Natal');

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    tick(400);

    const api = environment.openWeather.apiUrl;
    const req = http.expectOne((r) => r.url === `${api}/weather`);
    expect(req.request.params.get('q')).toBe('Natal');
    req.flush({ ...CURRENT_CURITIBA, name: 'Natal' });
    http.expectOne((r) => r.url === `${api}/forecast`).flush(buildForecast());
    http.verify();
    localStorage.clear();
  }));
});
```

> Se o seu componente não usa debounce, remova os `tick(400)`. Se a previsão só é buscada depois do clima atual (encadeada com `switchMap`), responda `reqWeather()` antes de chamar `reqForecast()`, como já está nos helpers.

## 7. Ponta a ponta com API simulada (Cypress)

### Fixtures: `cypress/fixtures/weather-curitiba.json` e `forecast-curitiba.json`

Use o mesmo conteúdo de `CURRENT_CURITIBA` e de `buildForecast()` serializado em JSON.

### `cypress/e2e/dashboard-clima.cy.ts`

```ts
describe('Dashboard de clima (E2E com API simulada)', () => {
  const WEATHER = '**/data/2.5/weather*';
  const FORECAST = '**/data/2.5/forecast*';

  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('CT-25: fluxo completo de busca', () => {
    cy.intercept('GET', WEATHER, { fixture: 'weather-curitiba.json' }).as('weather');
    cy.intercept('GET', FORECAST, { fixture: 'forecast-curitiba.json' }).as('forecast');

    cy.visit('/');
    cy.get('[data-testid="campo-cidade"]').type('Curitiba');
    cy.get('[data-testid="btn-buscar"]').click();

    cy.wait('@weather').its('request.url')
      .should('include', 'q=Curitiba')
      .and('include', 'units=metric');
    cy.wait('@forecast');

    cy.get('[data-testid="nome-cidade"]').should('contain', 'Curitiba');
    cy.get('[data-testid="temperatura"]').should('contain', '18 °C');
    cy.get('[data-testid="item-previsao"]').should('have.length', 5);
  });

  it('CT-26: cidade inexistente mostra mensagem amigável', () => {
    cy.intercept('GET', WEATHER, { statusCode: 404, body: { cod: '404', message: 'city not found' } }).as('weather');
    cy.intercept('GET', FORECAST, { statusCode: 404, body: { cod: '404', message: 'city not found' } });

    cy.visit('/');
    cy.get('[data-testid="campo-cidade"]').type('Xyzabc');
    cy.get('[data-testid="btn-buscar"]').click();
    cy.wait('@weather');

    cy.get('[data-testid="erro"]').should('contain', 'Cidade não encontrada');
    cy.get('[data-testid="campo-cidade"]').should('have.value', 'Xyzabc');
    cy.get('[data-testid="card-atual"]').should('not.exist');
  });

  it('CT-27: resposta lenta mostra loading até chegar', () => {
    cy.intercept('GET', WEATHER, { fixture: 'weather-curitiba.json', delay: 2000 }).as('weather');
    cy.intercept('GET', FORECAST, { fixture: 'forecast-curitiba.json' });

    cy.visit('/');
    cy.get('[data-testid="campo-cidade"]').type('Curitiba');
    cy.get('[data-testid="btn-buscar"]').click();

    cy.get('[data-testid="loading"]').should('be.visible');
    cy.wait('@weather');
    cy.get('[data-testid="loading"]').should('not.exist');
    cy.get('[data-testid="nome-cidade"]').should('contain', 'Curitiba');
  });

  it('CT-28: usa a geolocalização do navegador', () => {
    cy.intercept('GET', WEATHER, { fixture: 'weather-curitiba.json' }).as('weather');
    cy.intercept('GET', FORECAST, { fixture: 'forecast-curitiba.json' });

    cy.visit('/', {
      onBeforeLoad(win) {
        cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((ok) =>
          ok({ coords: { latitude: -25.43, longitude: -49.27 } } as GeolocationPosition),
        );
      },
    });

    cy.get('[data-testid="btn-localizacao"]').click();
    cy.wait('@weather').its('request.url')
      .should('include', 'lat=-25.43')
      .and('include', 'lon=-49.27');
  });

  it('CT-29: a chave da API não aparece na interface', () => {
    cy.intercept('GET', WEATHER, { fixture: 'weather-curitiba.json' }).as('weather');
    cy.intercept('GET', FORECAST, { fixture: 'forecast-curitiba.json' });

    cy.visit('/');
    cy.get('[data-testid="campo-cidade"]').type('Curitiba');
    cy.get('[data-testid="btn-buscar"]').click();
    cy.wait('@weather').then(({ request }) => {
      const appid = new URL(request.url).searchParams.get('appid')!;
      cy.get('body').invoke('html').should('not.contain', appid);
    });
  });
});
```

## 8. Contrato com a API real (opcional)

Rode só em um job separado (agendado, por exemplo), com a chave em variável de ambiente. Assim você não gasta cota da API nem deixa o CI instável.

### `contract/openweather.contract.spec.ts` (Jest + Node 18+)

```ts
const API = 'https://api.openweathermap.org/data/2.5';
const KEY = process.env.OPENWEATHER_API_KEY;

const describeIfKey = KEY ? describe : describe.skip;

describeIfKey('Contrato OpenWeatherMap', () => {
  jest.setTimeout(15000);

  it('CT-30: /weather mantém os campos que o dashboard usa', async () => {
    const res = await fetch(`${API}/weather?q=Curitiba&units=metric&lang=pt_br&appid=${KEY}`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(typeof body.name).toBe('string');
    expect(typeof body.main.temp).toBe('number');
    expect(typeof body.main.feels_like).toBe('number');
    expect(typeof body.main.humidity).toBe('number');
    expect(typeof body.wind.speed).toBe('number');
    expect(typeof body.weather[0].description).toBe('string');
    expect(body.weather[0].icon).toMatch(/^\d{2}[dn]$/);
  });

  it('CT-31: /forecast devolve 40 leituras com mínima e máxima', async () => {
    const res = await fetch(`${API}/forecast?q=Curitiba&units=metric&appid=${KEY}`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.list.length).toBe(40);
    for (const item of body.list) {
      expect(typeof item.dt).toBe('number');
      expect(typeof item.main.temp_min).toBe('number');
      expect(typeof item.main.temp_max).toBe('number');
      expect(item.dt_txt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    }
  });

  it('chave inválida responde 401', async () => {
    const res = await fetch(`${API}/weather?q=Curitiba&appid=chave-invalida`);
    expect(res.status).toBe(401);
  });
});
```

## 9. Como executar

```bash
# Integração com TestBed (Karma/Jasmine, padrão do Angular CLI)
ng test --watch=false --browsers=ChromeHeadless

# E2E com API simulada
npx cypress run --spec cypress/e2e/dashboard-clima.cy.ts

# Contrato com a API real (job separado)
OPENWEATHER_API_KEY=sua_chave npx jest contract/
```

## 10. Boas práticas aplicadas

- **Sem chamadas reais à API no CI comum.** O OpenWeatherMap tem limite de requisições e dados que mudam a cada minuto. Isso deixaria os testes lentos e instáveis.
- **`http.verify()` em todo `afterEach`.** Ele detecta requisições inesperadas, como uma nova tentativa a mais ou uma busca duplicada.
- **Fixtures realistas.** Elas seguem o formato real da resposta do OpenWeatherMap, incluindo a `temp` decimal, para testar o arredondamento.
- **Seletores `data-testid`.** Os testes não quebram quando o CSS ou o texto mudam.
- **Erros mapeados para o domínio.** O componente nunca depende do `status` HTTP diretamente, o que facilita trocar de provedor no futuro.
- **Contrato separado.** Se a API mudar o formato, só o teste de contrato falha, e fica claro que o problema é externo.
- **Cobertura de cenários de tempo.** Debounce, nova tentativa e cancelamento são testados com `fakeAsync`/`tick`, sem esperas reais.

Se você me mandar o código do seu `WeatherService` e do componente, eu ajusto os testes aos nomes, seletores e fluxos reais do seu projeto.
