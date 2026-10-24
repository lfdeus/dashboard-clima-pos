Li os arquivos indicados e montei os casos com base no que eles dizem. O oráculo de cada teste é uma das três coisas: a mensagem exata do `WeatherService`, uma invariante (INVxx) ou o contrato OpenAPI/schema. Quando o caso cai numa lacuna (Lxx), o teste só caracteriza o comportamento atual e tem `[Lxx]` no nome.

A fronteira é a tela inteira: `DashboardComponent` com `SearchBarComponent`, `ErrorMessageComponent`, `WeatherService` e `apiKeyInterceptor` reais. Só o servidor HTTP é simulado, com `HttpTestingController`. Os elementos são localizados por `role`, `aria-label` ou texto.

## 1. Dados de teste (`CASOS_HTTP`)

A constante `CASOS_HTTP` está no arquivo da seção 3 e alimenta o teste parametrizado. Os corpos são derivados do contrato: `atualOk()` e `previsaoOk()` trazem todos os campos `required` do OpenAPI, e `semCampo(corpo, 'caminho')` remove exatamente o campo violado. Resumo dos dados:

| ID | Endpoint que falha | Outra chamada | Status | Corpo | Código esperado | Mensagem esperada | Campo do contrato violado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CE-01 | `/weather` | pendente (cancelada) | 0 | — (erro de rede) | `NETWORK` | Sem conexão com a API. Verifique sua internet. | — |
| CE-02 | `/forecast` | pendente (cancelada) | 0 | — | `NETWORK` | Sem conexão com a API. Verifique sua internet. | — |
| CE-03 | `/weather` | pendente | 401 | `{cod:401, message:'Invalid API key'}` | `UNAUTHORIZED` | Chave de API inválida. Confira o environment.ts. | — |
| CE-04 | `/forecast` | sucesso (200) | 401 | idem | `UNAUTHORIZED` | Chave de API inválida. Confira o environment.ts. | — |
| CE-05 | `/forecast` | sucesso | 404 | `{cod:'404', message:'city not found'}` | `NOT_FOUND` | Cidade não encontrada. | — |
| CE-06 | `/weather` | pendente | 429 | `{cod:429, ...}` | `UNKNOWN` | Falha ao consultar o serviço de clima. | — |
| CE-07 | `/weather` | sucesso | 500 | `{cod:500, ...}` | `UNKNOWN` | Falha ao consultar o serviço de clima. | — |
| CE-08 | `/forecast` | pendente | 502 | página HTML | `UNKNOWN` | Falha ao consultar o serviço de clima. | — |
| CE-09 | `/weather` | pendente | 503 | `{cod:503, ...}` | `UNKNOWN` | Falha ao consultar o serviço de clima. | — |
| CE-10 | `/weather` | pendente | 200 | `atualOk()` sem `main` | `UNKNOWN` | Falha ao consultar o serviço de clima. | `CurrentWeatherResponse.main` |
| CE-11 | `/weather` | pendente | 200 | `atualOk()` sem `sys` | `UNKNOWN` | idem | `CurrentWeatherResponse.sys` |
| CE-12 | `/weather` | sucesso | 200 | `atualOk()` sem `name` | `UNKNOWN` | idem | `CurrentWeatherResponse.name` |
| CE-13 | `/weather` | pendente | 200 | página HTML | `UNKNOWN` | idem | `application/json` |
| CE-14 | `/forecast` | sucesso | 200 | `previsaoOk()` sem `list` | `UNKNOWN` | idem | `ForecastResponse.list` |
| CE-15 | `/forecast` | pendente | 200 | sem `list[1].dt_txt` | `UNKNOWN` | idem | `list[].dt_txt` |
| CE-16 | `/forecast` | sucesso | 200 | sem `list[0].main` | `UNKNOWN` | idem | `list[].main` |
| CE-17 | `/forecast` | pendente | 200 | sem `list[1].weather` (ponto das 12:00) | `UNKNOWN` | idem | `list[].weather` |
| CE-18 | `/forecast` | sucesso | 200 | página HTML | `UNKNOWN` | idem | `application/json` |

O campo `codigoEsperado` não é verificado na tela, porque pela INV02 a tela só conhece a `message`. Ele fica nos dados para rastrear a tradução feita pelo service.

## 2. Tabela de casos

| ID | Classe | Entrada | Resultado esperado | Regra | Tipo |
| --- | --- | --- | --- | --- | --- |
| CE-00 | Negócio | 404 em `/weather` | "Cidade não encontrada.", histórico `[]` | INV02, INV06 | Requisito |
| CE-01 | Rede | status 0 em `/weather` | Mensagem de `NETWORK`, `/forecast` cancelada, nada parcial | INV02, INV05 | Requisito |
| CE-02 | Rede | status 0 em `/forecast` | Mensagem de `NETWORK`, `/weather` cancelada | INV02, INV05 | Requisito |
| CE-03 | Autenticação | 401 em `/weather` | Mensagem de `UNAUTHORIZED` | INV02 | Requisito |
| CE-04 | Autenticação | `/weather` 200, depois 401 em `/forecast` | `UNAUTHORIZED`, clima atual descartado | INV02, INV05 | Requisito |
| CE-05 | Negócio / Atomicidade | `/weather` 200, depois 404 em `/forecast` | `NOT_FOUND`, nada parcial, sem histórico | INV02, INV05 | Requisito |
| CE-06 | Limite | 429 em `/weather` | Mensagem genérica de `UNKNOWN` | INV02, L03 | Caracterização |
| CE-07 | Servidor / Atomicidade | `/forecast` 200, depois 500 em `/weather` | `UNKNOWN`, nada parcial | INV02, INV05 | Requisito |
| CE-08 | Servidor | 502 com HTML em `/forecast` | `UNKNOWN` | INV02 | Requisito |
| CE-09 | Servidor | 503 em `/weather` | `UNKNOWN` | INV02 | Requisito |
| CE-10 | Contrato | 200 sem `main` | `UNKNOWN` | Contrato, INV02 | Requisito |
| CE-11 | Contrato | 200 sem `sys` | `UNKNOWN` | Contrato, INV02 | Requisito |
| CE-12 | Contrato | 200 sem `name` | `UNKNOWN`, histórico `[]` (**falha hoje**, A1) | Contrato, INV06 | Requisito |
| CE-13 | Contrato | 200 com corpo não JSON em `/weather` | `UNKNOWN` | Contrato, INV02 | Requisito |
| CE-14 | Contrato | 200 sem `list` | `UNKNOWN` | Contrato, INV02, INV05 | Requisito |
| CE-15 | Contrato | item sem `dt_txt` | `UNKNOWN` | Contrato, INV02 | Requisito |
| CE-16 | Contrato | item sem `main` | `UNKNOWN` | Contrato, INV02, INV05 | Requisito |
| CE-17 | Contrato | ponto das 12:00 sem `weather` | `UNKNOWN` | Contrato, INV02 | Requisito |
| CE-18 | Contrato | 200 com corpo não JSON em `/forecast` | `UNKNOWN` | Contrato, INV02, INV05 | Requisito |
| CE-19 | Contrato (borda aceita) | `weather: []` em `/weather` | Sucesso, histórico com o nome da API | Contrato ("a lista pode vir vazia") | Requisito |
| CE-20 | Contrato (borda) | `list: []` em `/forecast` | Hoje: só o clima atual, sem "Próximos dias" e sem aviso | L06 | Caracterização |
| CE-21 | Atomicidade | só `/weather` respondeu | Nada na tela nem no histórico até `/forecast` chegar | INV05 | Requisito |
| CE-22 | Entrada | termo vazio, digitado e confirmado | Nenhuma requisição | INV09 | Requisito |
| CE-23 | Entrada | 1 caractere | Nenhuma requisição | INV09 | Requisito |
| CE-24 | Entrada | só espaços; `" L "` | Nenhuma requisição | INV09 | Requisito |
| CE-25 | Entrada (limite) | 2 caracteres, 399 ms e 400 ms | Nada em 399 ms; uma busca em 400 ms com `q=Ri` | INV09 | Requisito |
| CE-26 | Entrada | `"   Porto   "` | `q=Porto` nas duas chamadas | Contrato (`q`), INV09 | Requisito |
| CE-27 | Entrada | `Paris&appid=ROUBADA#units=imperial` | `q` igual ao termo; um único `appid` (o da config); `units=metric`; `lang=pt_br`; só 4 parâmetros | INV03, INV04 | Requisito |
| CE-28 | Entrada | `São Paulo` | `q` codificado como `S%C3%A3o%20Paulo` | Contrato (`q`) | Requisito |
| CE-29 | Entrada | `sao paulo`, API devolve `São Paulo` | Histórico guarda `São Paulo` | INV06 | Requisito |
| CE-30 | Estado | sucesso, depois 404 | Alerta `NOT_FOUND`, histórico mantido | INV02, INV06 | Requisito |
| CE-31 | Estado | sucesso, depois 500 | Hoje: o último resultado some | L02 | Caracterização |
| CE-32 | Estado | 404, depois sucesso | Alerta some, histórico grava | INV02, INV06 | Requisito |
| CE-33 | Estado | 503, "Tentar novamente", 200 | Mesma busca (`q=Lisboa`), alerta some | INV02, INV06 | Requisito |
| CE-34 | Estado | status 0, "Tentar novamente", 401 | Mensagem troca para `UNAUTHORIZED` | INV02 | Requisito |
| CE-35 | Ordem | duas buscas, a antiga responde por último | Hoje: a antiga sobrescreve a atual | L05 | Caracterização |
| CE-36 | Ordem | duas buscas, a antiga falha por último | Hoje: o erro apaga o resultado válido | L05 | Caracterização |
| CE-37 | Ordem | Enter antes do fim do debounce | Hoje: duas buscas, 4 requisições | L03 | Caracterização |
| CE-38 | Estado | alternar °C/°F depois de um resultado | Nenhuma requisição; API sempre `metric` | INV04, INV07 | Requisito |
| CE-39 | Persistência | `clima:history` = `{quebrado` | Sem histórico, regrava `[]` | INV07, schema | Requisito |
| CE-40 | Persistência | `clima:history` = objeto | Sem histórico, regrava `[]` | INV07, schema | Requisito |
| CE-41 | Persistência | itens não string | Descartados | INV07, schema | Requisito |
| CE-42 | Persistência (limite) | 7 itens gravados | No máximo 5 exibidos e regravados (**falha hoje**, A2) | INV06, schema `maxItems` | Requisito |
| CE-43 | Persistência (limite) | 5 itens + nova cidade | Nova no topo, a mais antiga sai | INV06 | Requisito |
| CE-44 | Persistência | `lisboa` gravado, busca devolve `Lisboa` | Sobe para o topo sem duplicar | INV06 | Requisito |
| CE-45 | Persistência | `clima:unit` = `kelvin` | Lido como celsius, regrava `celsius` | INV07, schema | Requisito |
| CE-46 | Persistência | `clima:theme` = `roxo` | Preferência do sistema, coerente com a classe `dark` e o botão | INV07, schema | Requisito |
| CE-47 | Persistência | `getItem` lança `SecurityError` | Hoje: a criação da tela lança erro | L14 | Caracterização |

## 3. Arquivo de teste

```ts
/**
 * Testes de integração: casos de erro, borda e contrato (CE-xx).
 *
 * Fronteira: a tela inteira. DashboardComponent, SearchBarComponent, ErrorMessageComponent,
 * WeatherService e apiKeyInterceptor são reais; só o servidor HTTP é simulado, com
 * HttpTestingController. A interação acontece pelo DOM.
 *
 * - Teste de requisito: o oráculo é uma regra decidida (INVxx ou o contrato). Se falhar, é
 *   achado (defeito no código), não erro do teste.
 * - Teste com [Lxx] no nome: caracterização de uma lacuna ainda não decidida. Documenta o
 *   comportamento atual e deve quebrar quando a lacuna for decidida.
 */
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting
} from '@angular/common/http/testing';

import { DashboardComponent } from '../features/dashboard/dashboard.component';
import { apiKeyInterceptor } from '../core/interceptors/api-key.interceptor';
import { API_CONFIG } from '../core/tokens/api-config.token';

// ---------------------------------------------------------------------------
// Dados de teste derivados do contrato consumido
// (docs/arquitetura/contratos/openweathermap-consumido.openapi.yaml)
// ---------------------------------------------------------------------------

type Endpoint = '/weather' | '/forecast';
type CodigoErro = 'NETWORK' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'UNKNOWN';
type Corpo = object | string | null;
type Json = Record<string, unknown>;

const CONFIG_TESTE = {
  apiKey: 'CHAVE-DE-TESTE',
  baseUrl: 'https://api.openweathermap.test/data/2.5',
  iconUrl: 'https://openweathermap.test/img/wn',
  units: 'metric',
  lang: 'pt_br'
};

/** Mensagens exatas do WeatherService: o oráculo da INV02. */
const MENSAGEM: Record<CodigoErro, string> = {
  NETWORK: 'Sem conexão com a API. Verifique sua internet.',
  UNAUTHORIZED: 'Chave de API inválida. Confira o environment.ts.',
  NOT_FOUND: 'Cidade não encontrada.',
  UNKNOWN: 'Falha ao consultar o serviço de clima.'
};

const STATUS_TEXT: Record<number, string> = {
  0: 'Unknown Error',
  200: 'OK',
  401: 'Unauthorized',
  404: 'Not Found',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable'
};

/** Item de ForecastResponse.list com todos os campos `required` do contrato. */
function ponto(dt: number, dtTxt: string, temp: number, descricao: string, icone: string): Json {
  return {
    dt,
    dt_txt: dtTxt,
    main: { temp, temp_min: temp - 1, temp_max: temp + 1, humidity: 65 },
    weather: [{ description: descricao, icon: icone }],
    wind: { speed: 3 }
  };
}

/** CurrentWeatherResponse válido: todos os campos `required` preenchidos. */
function atualOk(nome = 'Lisboa'): Json {
  return {
    name: nome,
    dt: 1792843200,
    timezone: 0,
    visibility: 10000,
    sys: { country: 'PT', sunrise: 1792823400, sunset: 1792862400 },
    weather: [{ description: 'céu limpo', icon: '01d' }],
    main: { temp: 21.5, feels_like: 21.1, temp_min: 19.2, temp_max: 23.4, humidity: 60, pressure: 1015 },
    wind: { speed: 3.6, deg: 270 },
    clouds: { all: 0 }
  };
}

/** ForecastResponse válido: 24/10 às 09h e 12h UTC (o índice 1 é o ponto do dia) e 25/10 às 12h. */
function previsaoOk(): Json {
  return {
    city: { name: 'Lisboa', country: 'PT', timezone: 0 },
    list: [
      ponto(1792832400, '2026-10-24 09:00:00', 18, 'nublado', '04d'),
      ponto(1792843200, '2026-10-24 12:00:00', 21.5, 'céu limpo', '01d'),
      ponto(1792929600, '2026-10-25 12:00:00', 22, 'chuva leve', '10d')
    ]
  };
}

/** Cópia do corpo sem o campo indicado (caminho com pontos; índice de array vale, ex. `list.1.dt_txt`). */
function semCampo(corpo: Json, caminho: string): Json {
  const copia = JSON.parse(JSON.stringify(corpo)) as Json;
  const partes = caminho.split('.');
  let alvo = copia;
  for (const parte of partes.slice(0, -1)) {
    alvo = alvo[parte] as Json;
  }
  delete alvo[partes[partes.length - 1]];
  return copia;
}

function comCampo(corpo: Json, campo: string, valor: unknown): Json {
  return { ...corpo, [campo]: valor };
}

/** Corpo que não é JSON: página de erro de um gateway. */
const CORPO_NAO_JSON = '<html><body><h1>502 Bad Gateway</h1></body></html>';

interface CasoHttp {
  id: string;
  classe: 'Rede' | 'Autenticação' | 'Negócio' | 'Limite e servidor' | 'Contrato quebrado';
  descricao: string;
  endpointQueFalha: Endpoint;
  /** Estado da outra chamada do forkJoin quando a falha chega. */
  outraChamada: 'pendente' | 'sucesso';
  status: number;
  corpo: Corpo;
  /** Não aparece na tela (INV02); fica aqui para rastrear a tradução feita pelo service. */
  codigoEsperado: CodigoErro;
  mensagemEsperada: string;
  campoVioladoDoContrato?: string;
  regra: string;
  tipo: 'requisito' | 'caracterização';
}

const CASOS_HTTP: CasoHttp[] = [
  {
    id: 'CE-01',
    classe: 'Rede',
    descricao: 'status 0 em /weather mostra a mensagem de NETWORK e cancela /forecast',
    endpointQueFalha: '/weather',
    outraChamada: 'pendente',
    status: 0,
    corpo: null,
    codigoEsperado: 'NETWORK',
    mensagemEsperada: MENSAGEM.NETWORK,
    regra: 'INV02, INV05',
    tipo: 'requisito'
  },
  {
    id: 'CE-02',
    classe: 'Rede',
    descricao: 'status 0 em /forecast mostra a mensagem de NETWORK e cancela /weather',
    endpointQueFalha: '/forecast',
    outraChamada: 'pendente',
    status: 0,
    corpo: null,
    codigoEsperado: 'NETWORK',
    mensagemEsperada: MENSAGEM.NETWORK,
    regra: 'INV02, INV05',
    tipo: 'requisito'
  },
  {
    id: 'CE-03',
    classe: 'Autenticação',
    descricao: '401 em /weather mostra a mensagem de UNAUTHORIZED',
    endpointQueFalha: '/weather',
    outraChamada: 'pendente',
    status: 401,
    corpo: { cod: 401, message: 'Invalid API key' },
    codigoEsperado: 'UNAUTHORIZED',
    mensagemEsperada: MENSAGEM.UNAUTHORIZED,
    regra: 'INV02',
    tipo: 'requisito'
  },
  {
    id: 'CE-04',
    classe: 'Autenticação',
    descricao: '401 em /forecast depois de /weather 200 descarta o clima atual',
    endpointQueFalha: '/forecast',
    outraChamada: 'sucesso',
    status: 401,
    corpo: { cod: 401, message: 'Invalid API key' },
    codigoEsperado: 'UNAUTHORIZED',
    mensagemEsperada: MENSAGEM.UNAUTHORIZED,
    regra: 'INV02, INV05',
    tipo: 'requisito'
  },
  {
    id: 'CE-05',
    classe: 'Negócio',
    descricao: '404 em /forecast depois de /weather 200 mostra NOT_FOUND e nada parcial',
    endpointQueFalha: '/forecast',
    outraChamada: 'sucesso',
    status: 404,
    corpo: { cod: '404', message: 'city not found' },
    codigoEsperado: 'NOT_FOUND',
    mensagemEsperada: MENSAGEM.NOT_FOUND,
    regra: 'INV02, INV05',
    tipo: 'requisito'
  },
  {
    id: 'CE-06',
    classe: 'Limite e servidor',
    descricao: '[L03] 429 em /weather cai em UNKNOWN, sem mensagem própria',
    endpointQueFalha: '/weather',
    outraChamada: 'pendente',
    status: 429,
    corpo: { cod: 429, message: 'rate limit exceeded' },
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    regra: 'INV02, L03',
    tipo: 'caracterização'
  },
  {
    id: 'CE-07',
    classe: 'Limite e servidor',
    descricao: '500 em /weather depois de /forecast 200 mostra UNKNOWN e nada parcial',
    endpointQueFalha: '/weather',
    outraChamada: 'sucesso',
    status: 500,
    corpo: { cod: 500, message: 'Internal error' },
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    regra: 'INV02, INV05',
    tipo: 'requisito'
  },
  {
    id: 'CE-08',
    classe: 'Limite e servidor',
    descricao: '502 com página HTML em /forecast mostra UNKNOWN',
    endpointQueFalha: '/forecast',
    outraChamada: 'pendente',
    status: 502,
    corpo: CORPO_NAO_JSON,
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    regra: 'INV02',
    tipo: 'requisito'
  },
  {
    id: 'CE-09',
    classe: 'Limite e servidor',
    descricao: '503 em /weather mostra UNKNOWN',
    endpointQueFalha: '/weather',
    outraChamada: 'pendente',
    status: 503,
    corpo: { cod: 503, message: 'Service Unavailable' },
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    regra: 'INV02',
    tipo: 'requisito'
  },
  {
    id: 'CE-10',
    classe: 'Contrato quebrado',
    descricao: '200 em /weather sem `main` mostra UNKNOWN',
    endpointQueFalha: '/weather',
    outraChamada: 'pendente',
    status: 200,
    corpo: semCampo(atualOk(), 'main'),
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    campoVioladoDoContrato: 'CurrentWeatherResponse.main (required)',
    regra: 'contrato, INV02',
    tipo: 'requisito'
  },
  {
    id: 'CE-11',
    classe: 'Contrato quebrado',
    descricao: '200 em /weather sem `sys` mostra UNKNOWN',
    endpointQueFalha: '/weather',
    outraChamada: 'pendente',
    status: 200,
    corpo: semCampo(atualOk(), 'sys'),
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    campoVioladoDoContrato: 'CurrentWeatherResponse.sys (required)',
    regra: 'contrato, INV02',
    tipo: 'requisito'
  },
  {
    // Falha hoje: o código aceita a resposta sem `name` (achado A1).
    id: 'CE-12',
    classe: 'Contrato quebrado',
    descricao: '200 em /weather sem `name` mostra UNKNOWN e não grava histórico',
    endpointQueFalha: '/weather',
    outraChamada: 'sucesso',
    status: 200,
    corpo: semCampo(atualOk(), 'name'),
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    campoVioladoDoContrato: 'CurrentWeatherResponse.name (required)',
    regra: 'contrato, INV06',
    tipo: 'requisito'
  },
  {
    id: 'CE-13',
    classe: 'Contrato quebrado',
    descricao: '200 em /weather com corpo não JSON mostra UNKNOWN',
    endpointQueFalha: '/weather',
    outraChamada: 'pendente',
    status: 200,
    corpo: CORPO_NAO_JSON,
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    campoVioladoDoContrato: 'content application/json',
    regra: 'contrato, INV02',
    tipo: 'requisito'
  },
  {
    id: 'CE-14',
    classe: 'Contrato quebrado',
    descricao: '200 em /forecast sem `list` depois de /weather 200 mostra UNKNOWN',
    endpointQueFalha: '/forecast',
    outraChamada: 'sucesso',
    status: 200,
    corpo: semCampo(previsaoOk(), 'list'),
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    campoVioladoDoContrato: 'ForecastResponse.list (required)',
    regra: 'contrato, INV02, INV05',
    tipo: 'requisito'
  },
  {
    id: 'CE-15',
    classe: 'Contrato quebrado',
    descricao: '200 em /forecast com item sem `dt_txt` mostra UNKNOWN',
    endpointQueFalha: '/forecast',
    outraChamada: 'pendente',
    status: 200,
    corpo: semCampo(previsaoOk(), 'list.1.dt_txt'),
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    campoVioladoDoContrato: 'ForecastResponse.list[].dt_txt (required)',
    regra: 'contrato, INV02',
    tipo: 'requisito'
  },
  {
    id: 'CE-16',
    classe: 'Contrato quebrado',
    descricao: '200 em /forecast com item sem `main` mostra UNKNOWN',
    endpointQueFalha: '/forecast',
    outraChamada: 'sucesso',
    status: 200,
    corpo: semCampo(previsaoOk(), 'list.0.main'),
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    campoVioladoDoContrato: 'ForecastResponse.list[].main (required)',
    regra: 'contrato, INV02, INV05',
    tipo: 'requisito'
  },
  {
    id: 'CE-17',
    classe: 'Contrato quebrado',
    descricao: '200 em /forecast com o ponto das 12:00 sem `weather` mostra UNKNOWN',
    endpointQueFalha: '/forecast',
    outraChamada: 'pendente',
    status: 200,
    corpo: semCampo(previsaoOk(), 'list.1.weather'),
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    campoVioladoDoContrato: 'ForecastResponse.list[].weather (required)',
    regra: 'contrato, INV02',
    tipo: 'requisito'
  },
  {
    id: 'CE-18',
    classe: 'Contrato quebrado',
    descricao: '200 em /forecast com corpo não JSON depois de /weather 200 mostra UNKNOWN',
    endpointQueFalha: '/forecast',
    outraChamada: 'sucesso',
    status: 200,
    corpo: CORPO_NAO_JSON,
    codigoEsperado: 'UNKNOWN',
    mensagemEsperada: MENSAGEM.UNKNOWN,
    campoVioladoDoContrato: 'content application/json',
    regra: 'contrato, INV02, INV05',
    tipo: 'requisito'
  }
];

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('Integração: erros, bordas e contrato (Dashboard → WeatherService → apiKeyInterceptor → HttpClient)', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideHttpClient(withInterceptors([apiKeyInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: CONFIG_TESTE }
      ]
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  });

  // ---------------------------------------------------------------- helpers

  function criarTela(): ComponentFixture<DashboardComponent> {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return fixture;
  }

  function raiz(fixture: ComponentFixture<DashboardComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function campoCidade(fixture: ComponentFixture<DashboardComponent>): HTMLInputElement {
    const campo = raiz(fixture).querySelector<HTMLInputElement>('input[aria-label="Nome da cidade"]');
    if (!campo) throw new Error('Campo "Nome da cidade" não encontrado');
    return campo;
  }

  function botao(fixture: ComponentFixture<DashboardComponent>, nome: string): HTMLButtonElement | null {
    return (
      Array.from(raiz(fixture).querySelectorAll('button')).find(
        (b) => b.getAttribute('aria-label') === nome || (b.textContent ?? '').trim() === nome
      ) ?? null
    );
  }

  /** Digita no campo como o usuário (dispara `input`), sem esperar o debounce. */
  function digitar(fixture: ComponentFixture<DashboardComponent>, texto: string): void {
    const campo = campoCidade(fixture);
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Confirma a busca clicando em "Buscar" (respeita o botão desabilitado, como o Enter). */
  function confirmar(fixture: ComponentFixture<DashboardComponent>): void {
    fixture.detectChanges();
    const buscarBtn = botao(fixture, 'Buscar');
    if (!buscarBtn) throw new Error('Botão "Buscar" não encontrado');
    buscarBtn.click();
    fixture.detectChanges();
  }

  /** Digita e espera o debounce de 400 ms: dispara exatamente uma busca (um par de requisições). */
  function buscar(fixture: ComponentFixture<DashboardComponent>, termo: string): void {
    digitar(fixture, termo);
    tick(400);
    fixture.detectChanges();
  }

  function alerta(fixture: ComponentFixture<DashboardComponent>): HTMLElement | null {
    return raiz(fixture).querySelector<HTMLElement>('[role="alert"]');
  }

  function textoDoAlerta(fixture: ComponentFixture<DashboardComponent>): string {
    return alerta(fixture)?.textContent ?? '';
  }

  function titulo(fixture: ComponentFixture<DashboardComponent>, texto: string): HTMLElement | null {
    return (
      Array.from(raiz(fixture).querySelectorAll<HTMLElement>('h1, h2, h3, [role="heading"]')).find(
        (h) => (h.textContent ?? '').trim() === texto
      ) ?? null
    );
  }

  function temTexto(fixture: ComponentFixture<DashboardComponent>, texto: string): boolean {
    return (raiz(fixture).textContent ?? '').includes(texto);
  }

  /** Cidades exibidas no histórico, na ordem da tela. */
  function historico(fixture: ComponentFixture<DashboardComponent>): string[] {
    const rotulo = Array.from(raiz(fixture).querySelectorAll('span')).find(
      (s) => (s.textContent ?? '').trim() === 'Histórico:'
    );
    if (!rotulo || !rotulo.parentElement) return [];
    return Array.from(rotulo.parentElement.querySelectorAll('button'))
      .filter((b) => b.getAttribute('aria-label') !== 'Limpar histórico')
      .map((b) => (b.textContent ?? '').trim());
  }

  function historicoGravado(): unknown {
    return JSON.parse(localStorage.getItem('clima:history') ?? 'null');
  }

  /** Responde a requisição pendente do endpoint (opcionalmente filtrada pelo termo `q`). */
  function responder(caminho: Endpoint, corpo: Corpo, status = 200, q?: string): TestRequest {
    const req = httpMock.expectOne(
      (r) => r.url.endsWith(caminho) && (q === undefined || r.params.get('q') === q),
      `requisição pendente para ${caminho}${q ? ` com q=${q}` : ''}`
    );
    if (status === 0) {
      req.error(new ProgressEvent('error'), { status: 0, statusText: STATUS_TEXT[0] });
    } else {
      req.flush(corpo, { status, statusText: STATUS_TEXT[status] ?? 'Erro' });
    }
    return req;
  }

  /** Retira da fila as requisições que o forkJoin cancelou (para o verify) e as devolve. */
  function descartarPendentes(caminho: Endpoint): TestRequest[] {
    return httpMock.match((r) => r.url.endsWith(caminho));
  }

  function responderSucesso(fixture: ComponentFixture<DashboardComponent>, nome: string, q?: string): void {
    responder('/weather', atualOk(nome), 200, q);
    responder('/forecast', previsaoOk(), 200, q);
    tick();
    fixture.detectChanges();
  }

  // ------------------------------------------------------- exemplo (few-shot)

  it('CE-00: 404 em /weather mostra "Cidade não encontrada" e não grava histórico (INV02, INV06)', fakeAsync(() => {
    // Arrange
    const fixture = criarTela();
    // Act
    buscar(fixture, 'Atlantida');
    responder('/weather', { cod: '404', message: 'city not found' }, 404);
    descartarPendentes('/forecast'); // forkJoin cancela a outra chamada
    tick();
    fixture.detectChanges();
    // Assert
    expect(alerta(fixture)?.textContent).toContain('Cidade não encontrada.');
    expect(localStorage.getItem('clima:history')).toBe('[]');
  }));

  // ---------------------------- rede, autenticação, negócio, servidor, contrato

  describe('falhas HTTP e contrato quebrado (CASOS_HTTP)', () => {
    for (const caso of CASOS_HTTP) {
      it(`${caso.id}: ${caso.descricao} (${caso.regra})`, fakeAsync(() => {
        // Arrange
        const fixture = criarTela();
        const outro: Endpoint = caso.endpointQueFalha === '/weather' ? '/forecast' : '/weather';
        // Act
        buscar(fixture, 'Lisboa');
        if (caso.outraChamada === 'sucesso') {
          responder(outro, outro === '/weather' ? atualOk('Lisboa') : previsaoOk());
        }
        responder(caso.endpointQueFalha, caso.corpo, caso.status);
        const canceladas = caso.outraChamada === 'pendente' ? descartarPendentes(outro) : [];
        tick();
        fixture.detectChanges();
        // Assert: tela
        expect(textoDoAlerta(fixture)).toContain(caso.mensagemEsperada);
        expect(textoDoAlerta(fixture)).toContain('Não foi possível carregar');
        expect(botao(fixture, 'Tentar novamente')).not.toBeNull();
        expect(titulo(fixture, 'Próximos dias')).toBeNull(); // INV05: nada parcial
        // Assert: efeitos colaterais
        expect(historico(fixture)).toEqual([]);
        expect(localStorage.getItem('clima:history')).toBe('[]');
        expect(canceladas.length).toBe(caso.outraChamada === 'pendente' ? 1 : 0);
        expect(canceladas.every((r) => r.cancelled)).toBeTrue();
      }));
    }
  });

  describe('contrato: valores de borda aceitos', () => {
    it('CE-19: /weather com `weather: []` é aceito e grava o nome da API (contrato: "a lista pode vir vazia")', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      // Act
      buscar(fixture, 'Lisboa');
      responder('/weather', comCampo(atualOk('Lisboa'), 'weather', []));
      responder('/forecast', previsaoOk());
      tick();
      fixture.detectChanges();
      // Assert
      expect(alerta(fixture)).toBeNull();
      expect(titulo(fixture, 'Próximos dias')).not.toBeNull();
      expect(historico(fixture)).toEqual(['Lisboa']);
      expect(historicoGravado()).toEqual(['Lisboa']);
    }));

    it('CE-20: [L06] /forecast com `list: []` mostra só o clima atual, sem aviso de previsão (caracterização)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      // Act
      buscar(fixture, 'Lisboa');
      responder('/weather', atualOk('Lisboa'));
      responder('/forecast', comCampo(previsaoOk(), 'list', []));
      tick();
      fixture.detectChanges();
      // Assert: comportamento atual
      expect(alerta(fixture)).toBeNull();
      expect(titulo(fixture, 'Próximos dias')).toBeNull();
      expect(temTexto(fixture, 'Sem previsão disponível.')).toBeFalse();
      expect(historico(fixture)).toEqual(['Lisboa']);
    }));
  });

  // ------------------------------------------------------------ atomicidade

  describe('atomicidade', () => {
    it('CE-21: /weather respondido não aparece enquanto /forecast não responde (INV05)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      // Act: só metade chegou
      buscar(fixture, 'Lisboa');
      responder('/weather', atualOk('Lisboa'));
      tick();
      fixture.detectChanges();
      // Assert: nada parcial
      expect(titulo(fixture, 'Próximos dias')).toBeNull();
      expect(historico(fixture)).toEqual([]);
      expect(localStorage.getItem('clima:history')).toBe('[]');
      expect(botao(fixture, 'Buscar')?.disabled).toBeTrue();
      // Act: a outra metade chega
      responder('/forecast', previsaoOk());
      tick();
      fixture.detectChanges();
      // Assert
      expect(titulo(fixture, 'Próximos dias')).not.toBeNull();
      expect(historico(fixture)).toEqual(['Lisboa']);
    }));
  });

  // ---------------------------------------------------------------- entrada

  describe('entrada', () => {
    it('CE-22: termo vazio não dispara requisição, nem digitado nem confirmado (INV09)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      // Act
      digitar(fixture, '');
      tick(400);
      confirmar(fixture);
      // Assert
      httpMock.expectNone(() => true);
      expect(temTexto(fixture, 'Comece pesquisando uma cidade')).toBeTrue();
    }));

    it('CE-23: termo com 1 caractere não dispara requisição, nem digitado nem confirmado (INV09)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      // Act
      digitar(fixture, 'L');
      tick(400);
      confirmar(fixture);
      // Assert
      httpMock.expectNone(() => true);
      expect(alerta(fixture)).toBeNull();
    }));

    it('CE-24: termo só com espaços ou com 1 caractere entre espaços não dispara requisição (INV09)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      // Act
      digitar(fixture, '     ');
      tick(400);
      confirmar(fixture);
      digitar(fixture, ' L ');
      tick(400);
      confirmar(fixture);
      // Assert
      httpMock.expectNone(() => true);
      expect(temTexto(fixture, 'Comece pesquisando uma cidade')).toBeTrue();
    }));

    it('CE-25: termo com 2 caracteres só busca ao completar 400 ms de debounce (INV09, valor limite)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      // Act
      digitar(fixture, 'Ri');
      tick(399);
      // Assert: 399 ms ainda não busca
      httpMock.expectNone(() => true);
      // Act
      tick(1);
      fixture.detectChanges();
      const atual = responder('/weather', atualOk('Rio de Janeiro'));
      const previsao = responder('/forecast', previsaoOk());
      tick();
      fixture.detectChanges();
      // Assert
      expect(atual.request.params.get('q')).toBe('Ri');
      expect(previsao.request.params.get('q')).toBe('Ri');
      expect(historico(fixture)).toEqual(['Rio de Janeiro']);
    }));

    it('CE-26: espaços nas pontas são removidos antes de enviar `q` (contrato: parâmetro q, INV09)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      // Act
      buscar(fixture, '   Porto   ');
      const atual = responder('/weather', atualOk('Porto'));
      const previsao = responder('/forecast', previsaoOk());
      tick();
      fixture.detectChanges();
      // Assert
      expect(atual.request.params.get('q')).toBe('Porto');
      expect(previsao.request.params.get('q')).toBe('Porto');
    }));

    it('CE-27: `&`, `=` e `#` no termo não sobrescrevem appid, units nem lang (INV03, INV04)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      const termo = 'Paris&appid=ROUBADA#units=imperial';
      // Act
      buscar(fixture, termo);
      const atual = responder('/weather', atualOk('Paris'));
      const previsao = responder('/forecast', previsaoOk());
      tick();
      fixture.detectChanges();
      // Assert
      for (const req of [atual, previsao]) {
        const params = req.request.params;
        const url = req.request.urlWithParams;
        expect(params.get('q')).toBe(termo);
        expect(params.getAll('appid')).toEqual(['CHAVE-DE-TESTE']);
        expect(params.getAll('units')).toEqual(['metric']);
        expect(params.getAll('lang')).toEqual(['pt_br']);
        expect(params.keys().sort()).toEqual(['appid', 'lang', 'q', 'units']);
        expect((url.match(/[?&]appid=/g) ?? []).length).toBe(1);
        expect(url).not.toContain('&appid=ROUBADA');
        expect(url).not.toContain('#');
      }
      expect(historico(fixture)).toEqual(['Paris']);
    }));

    it('CE-28: termo acentuado vai codificado em UTF-8 em `q` (contrato: parâmetro q)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      // Act
      buscar(fixture, 'São Paulo');
      const atual = responder('/weather', atualOk('São Paulo'));
      responder('/forecast', previsaoOk());
      tick();
      fixture.detectChanges();
      // Assert
      expect(atual.request.params.get('q')).toBe('São Paulo');
      expect(atual.request.urlWithParams).toContain('q=S%C3%A3o%20Paulo');
    }));

    it('CE-29: o histórico guarda o nome devolvido pela API, não o termo digitado (INV06)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      // Act
      buscar(fixture, 'sao paulo');
      responderSucesso(fixture, 'São Paulo');
      // Assert
      expect(historico(fixture)).toEqual(['São Paulo']);
      expect(historicoGravado()).toEqual(['São Paulo']);
    }));
  });

  // -------------------------------------------------------- estado e ordem

  describe('estado e ordem', () => {
    it('CE-30: erro depois de sucesso mostra a nova mensagem e mantém o histórico (INV02, INV06)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      buscar(fixture, 'Lisboa');
      responderSucesso(fixture, 'Lisboa');
      // Act
      buscar(fixture, 'Atlantida');
      responder('/weather', { cod: '404', message: 'city not found' }, 404);
      descartarPendentes('/forecast');
      tick();
      fixture.detectChanges();
      // Assert
      expect(textoDoAlerta(fixture)).toContain(MENSAGEM.NOT_FOUND);
      expect(historico(fixture)).toEqual(['Lisboa']);
      expect(historicoGravado()).toEqual(['Lisboa']);
    }));

    it('CE-31: [L02] erro depois de sucesso descarta o último resultado exibido (caracterização)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      buscar(fixture, 'Lisboa');
      responderSucesso(fixture, 'Lisboa');
      expect(titulo(fixture, 'Próximos dias')).not.toBeNull();
      // Act
      buscar(fixture, 'Atlantida');
      responder('/weather', { cod: 500, message: 'Internal error' }, 500);
      descartarPendentes('/forecast');
      tick();
      fixture.detectChanges();
      // Assert: comportamento atual
      expect(titulo(fixture, 'Próximos dias')).toBeNull();
      expect(alerta(fixture)).not.toBeNull();
    }));

    it('CE-32: sucesso depois de erro remove o alerta e grava o histórico (INV02, INV06)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      buscar(fixture, 'Atlantida');
      responder('/weather', { cod: '404', message: 'city not found' }, 404);
      descartarPendentes('/forecast');
      tick();
      fixture.detectChanges();
      // Act
      buscar(fixture, 'Lisboa');
      responderSucesso(fixture, 'Lisboa');
      // Assert
      expect(alerta(fixture)).toBeNull();
      expect(titulo(fixture, 'Próximos dias')).not.toBeNull();
      expect(historico(fixture)).toEqual(['Lisboa']);
    }));

    it('CE-33: "Tentar novamente" repete a mesma busca e, com sucesso, remove o alerta (INV02, INV06)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      buscar(fixture, 'Lisboa');
      responder('/weather', { cod: 503, message: 'Service Unavailable' }, 503);
      descartarPendentes('/forecast');
      tick();
      fixture.detectChanges();
      // Act
      botao(fixture, 'Tentar novamente')?.click();
      fixture.detectChanges();
      const atual = responder('/weather', atualOk('Lisboa'));
      const previsao = responder('/forecast', previsaoOk());
      tick();
      fixture.detectChanges();
      // Assert
      expect(atual.request.params.get('q')).toBe('Lisboa');
      expect(previsao.request.params.get('q')).toBe('Lisboa');
      expect(alerta(fixture)).toBeNull();
      expect(historico(fixture)).toEqual(['Lisboa']);
    }));

    it('CE-34: "Tentar novamente" que falha com outro status troca a mensagem (INV02)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      buscar(fixture, 'Lisboa');
      responder('/weather', null, 0);
      descartarPendentes('/forecast');
      tick();
      fixture.detectChanges();
      // Act
      botao(fixture, 'Tentar novamente')?.click();
      fixture.detectChanges();
      responder('/weather', { cod: 401, message: 'Invalid API key' }, 401);
      descartarPendentes('/forecast');
      tick();
      fixture.detectChanges();
      // Assert
      expect(textoDoAlerta(fixture)).toContain(MENSAGEM.UNAUTHORIZED);
      expect(textoDoAlerta(fixture)).not.toContain(MENSAGEM.NETWORK);
      expect(localStorage.getItem('clima:history')).toBe('[]');
    }));

    it('CE-35: [L05] resposta atrasada de uma busca antiga sobrescreve a busca atual (caracterização)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      buscar(fixture, 'Lisboa'); // fica pendente
      buscar(fixture, 'Porto'); // o campo segue habilitado durante o carregamento
      // Act
      responderSucesso(fixture, 'Porto', 'Porto');
      responderSucesso(fixture, 'Lisboa', 'Lisboa'); // a antiga chega depois
      // Assert: comportamento atual, Lisboa (a busca antiga) fica por último
      expect(alerta(fixture)).toBeNull();
      expect(historico(fixture)).toEqual(['Lisboa', 'Porto']);
      expect(historicoGravado()).toEqual(['Lisboa', 'Porto']);
    }));

    it('CE-36: [L05] erro atrasado de uma busca antiga apaga um resultado válido (caracterização)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      buscar(fixture, 'Lisboa'); // fica pendente
      buscar(fixture, 'Porto');
      responderSucesso(fixture, 'Porto', 'Porto');
      expect(titulo(fixture, 'Próximos dias')).not.toBeNull();
      // Act
      responder('/weather', { cod: '404', message: 'city not found' }, 404, 'Lisboa');
      const canceladas = descartarPendentes('/forecast');
      tick();
      fixture.detectChanges();
      // Assert: comportamento atual
      expect(textoDoAlerta(fixture)).toContain(MENSAGEM.NOT_FOUND);
      expect(titulo(fixture, 'Próximos dias')).toBeNull();
      expect(historico(fixture)).toEqual(['Porto']);
      expect(canceladas.every((r) => r.cancelled)).toBeTrue();
    }));

    it('CE-37: [L03] Enter antes do fim do debounce dispara duas buscas, 4 requisições (caracterização)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      // Act
      digitar(fixture, 'Lisboa');
      confirmar(fixture); // busca imediata
      tick(400); // o debounce também dispara
      fixture.detectChanges();
      const atuais = httpMock.match((r) => r.url.endsWith('/weather'));
      const previsoes = httpMock.match((r) => r.url.endsWith('/forecast'));
      atuais.forEach((r) => r.flush(atualOk('Lisboa')));
      previsoes.forEach((r) => r.flush(previsaoOk()));
      tick();
      fixture.detectChanges();
      // Assert: comportamento atual
      expect(atuais.length).toBe(2);
      expect(previsoes.length).toBe(2);
      expect(historico(fixture)).toEqual(['Lisboa']);
    }));

    it('CE-38: alternar °C/°F não gera requisição e a API segue em `metric` (INV04, INV07)', fakeAsync(() => {
      // Arrange
      const fixture = criarTela();
      buscar(fixture, 'Lisboa');
      const atual = responder('/weather', atualOk('Lisboa'));
      responder('/forecast', previsaoOk());
      tick();
      fixture.detectChanges();
      const alternar = botao(fixture, 'Alternar entre Celsius e Fahrenheit');
      // Act
      alternar?.click();
      fixture.detectChanges();
      // Assert
      httpMock.expectNone(() => true);
      expect(atual.request.params.get('units')).toBe('metric');
      expect(alternar?.getAttribute('aria-pressed')).toBe('true');
      expect(localStorage.getItem('clima:unit')).toBe('fahrenheit');
    }));
  });

  // ------------------------------------------------------------ persistência

  describe('persistência', () => {
    it('CE-39: `clima:history` com JSON inválido abre a tela sem histórico e regrava `[]` (INV07, schema)', () => {
      // Arrange
      localStorage.setItem('clima:history', '{quebrado');
      // Act
      const fixture = criarTela();
      // Assert
      expect(historico(fixture)).toEqual([]);
      expect(temTexto(fixture, 'Histórico:')).toBeFalse();
      expect(localStorage.getItem('clima:history')).toBe('[]');
    });

    it('CE-40: `clima:history` que não é array vira lista vazia (INV07, schema)', () => {
      // Arrange
      localStorage.setItem('clima:history', '{"cidade":"Lisboa"}');
      // Act
      const fixture = criarTela();
      // Assert
      expect(historico(fixture)).toEqual([]);
      expect(localStorage.getItem('clima:history')).toBe('[]');
    });

    it('CE-41: itens de `clima:history` que não são string são descartados (INV07, schema)', () => {
      // Arrange
      localStorage.setItem('clima:history', '["Lisboa", 42, null, {"a": 1}, "Porto"]');
      // Act
      const fixture = criarTela();
      // Assert
      expect(historico(fixture)).toEqual(['Lisboa', 'Porto']);
      expect(historicoGravado()).toEqual(['Lisboa', 'Porto']);
    });

    it('CE-42: `clima:history` com 7 itens nunca exibe nem regrava mais de 5 (INV06, schema maxItems)', () => {
      // Arrange
      localStorage.setItem(
        'clima:history',
        JSON.stringify(['Lisboa', 'Porto', 'Braga', 'Faro', 'Évora', 'Coimbra', 'Aveiro'])
      );
      // Act
      const fixture = criarTela();
      // Assert
      expect(historico(fixture).length).toBeLessThanOrEqual(5);
      expect((historicoGravado() as unknown[]).length).toBeLessThanOrEqual(5);
    });

    it('CE-43: com 5 itens, uma nova cidade entra no topo e a mais antiga sai (INV06, valor limite)', fakeAsync(() => {
      // Arrange
      localStorage.setItem('clima:history', JSON.stringify(['Porto', 'Braga', 'Faro', 'Évora', 'Coimbra']));
      const fixture = criarTela();
      // Act
      buscar(fixture, 'Lisboa');
      responderSucesso(fixture, 'Lisboa');
      // Assert
      expect(historico(fixture)).toEqual(['Lisboa', 'Porto', 'Braga', 'Faro', 'Évora']);
      expect(historicoGravado()).toEqual(['Lisboa', 'Porto', 'Braga', 'Faro', 'Évora']);
    }));

    it('CE-44: cidade repetida com outra caixa sobe para o topo sem duplicar (INV06)', fakeAsync(() => {
      // Arrange
      localStorage.setItem('clima:history', JSON.stringify(['Porto', 'lisboa']));
      const fixture = criarTela();
      // Act
      buscar(fixture, 'LISBOA');
      responderSucesso(fixture, 'Lisboa');
      // Assert
      expect(historico(fixture)).toEqual(['Lisboa', 'Porto']);
      expect(historicoGravado()).toEqual(['Lisboa', 'Porto']);
    }));

    it('CE-45: `clima:unit` fora do schema é lido como celsius (INV07, schema)', () => {
      // Arrange
      localStorage.setItem('clima:unit', 'kelvin');
      // Act
      const fixture = criarTela();
      // Assert
      expect(botao(fixture, 'Alternar entre Celsius e Fahrenheit')?.getAttribute('aria-pressed')).toBe('false');
      expect(localStorage.getItem('clima:unit')).toBe('celsius');
    });

    it('CE-46: `clima:theme` fora do schema cai na preferência do sistema e fica coerente (INV07, schema)', () => {
      // Arrange
      localStorage.setItem('clima:theme', 'roxo');
      // Act
      const fixture = criarTela();
      // Assert
      const tema = localStorage.getItem('clima:theme');
      expect(['light', 'dark']).toContain(tema as string);
      expect(document.documentElement.classList.contains('dark')).toBe(tema === 'dark');
      const rotulo = tema === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro';
      expect(botao(fixture, rotulo)).not.toBeNull();
    });

    it('CE-47: [L14] com o localStorage bloqueado, a tela nem é criada (caracterização)', () => {
      // Arrange
      spyOn(Storage.prototype, 'getItem').and.throwError(new DOMException('bloqueado', 'SecurityError'));
      // Act / Assert: comportamento atual
      expect(() => TestBed.createComponent(DashboardComponent)).toThrow();
    });
  });
});
```

## 4. Achados

### Defeitos (testes de requisito que devem falhar hoje)

- **A1, CE-12: campo `required` ausente nem sempre vira `UNKNOWN`.** O contrato diz que um campo `required` ausente faz a normalização falhar e chegar ao usuário como `UNKNOWN`. Isso só é verdade quando falta um **objeto** (`main`, `sys`, `wind`, `clouds`, `list`), porque o código acessa uma propriedade dele. Quando falta um **escalar** (`name`, `dt`, `timezone`, `visibility`, `sys.country`, `main.temp`, `wind.speed`...), o `mapCurrent` só copia `undefined` e a busca é tratada como sucesso. No caso de `name`:
  - a tela mostra um resultado sem nome de cidade;
  - com o histórico vazio, `pushHistory(undefined)` grava `[null]` no `localStorage` (`JSON.stringify([undefined])`). Isso viola a INV06 e o schema, que exige itens string;
  - com o histórico já preenchido, `city.toLowerCase()` lança `TypeError` dentro do `next` do `subscribe`. O erro fica sem tratamento e o resultado sem nome continua na tela.

  É preciso decidir entre validar a resposta no service ou corrigir o texto do contrato.
- **A2, CE-42: o histórico não respeita o limite de 5 itens na leitura.** O `readHistory` não aplica `maxItems: 5` nem remove duplicatas. Com 7 itens gravados, a tela mostra 7 e regrava 7. A situação se corrige sozinha na próxima busca com sucesso (`slice(0, 5)`). Duplicatas exatas gravadas (`["Lisboa","Lisboa"]`) também chegam ao `@for (...; track h)` com chave repetida.

### Defeitos de projeto encontrados na leitura (sem teste que falhe)

- **A3: a mensagem "Ocorreu um erro inesperado. Tente novamente." nunca aparece.** O `catchError(this.mapError)` fica depois do `map`, então um `TypeError` da normalização também passa por `mapError`. Como ele não tem `status`, vira `WeatherApiError('UNKNOWN')`. O resultado é que um erro de programação aparece ao usuário como "Falha ao consultar o serviço de clima", sem nenhum log (L11). Os casos CE-10 a CE-18 passam justamente por causa disso.
- **A4: "Sem previsão disponível." é código morto.** O `@empty` está dentro de `@if (forecast().length > 0)`. Com `list: []` (CE-20), a seção inteira some e não aparece aviso nenhum.
- **A5: a quebra por item sem `weather` depende da posição.** Só o item que representa o dia (12:00 ou o primeiro do grupo) é lido. O mesmo campo ausente num ponto das 09:00 passa sem erro. O CE-17 cobre o caso que quebra.

### Perguntas para o time

- **P1 (L06, CE-20):** com `list: []`, a tela mostra o clima atual sem previsão e sem aviso. Na prática isso já é um "resultado parcial". Deve ser tratado como erro, mostrar aviso ou ficar como está?
- **P2 (L05, CE-35 e CE-36):** a última busca deve vencer? Hoje a resposta antiga sobrescreve a atual, e um erro atrasado apaga um resultado válido.
- **P3 (L03, CE-06 e CE-37):** o 429 deve ter mensagem própria e backoff? O Enter antes do fim do debounce deve ser deduplicado com a busca do debounce?
- **P4 (L02, CE-31):** quando uma nova busca falha, o último resultado deve continuar na tela?
- **P5:** a mensagem de 401 ("Confira o environment.ts") é instrução para o desenvolvedor, mas aparece para o usuário final. É intencional?
- **P6:** status 0 também cobre bloqueio de CORS, extensão de bloqueio e falha de DNS, mas a mensagem atribui o problema à internet do usuário. Isso é aceitável?
- **P7 (CE-46):** o schema diz que, sem `clima:theme`, vale a preferência do sistema. Só que o `effect` grava o tema já na primeira abertura, então a partir da segunda visita a preferência do sistema deixa de ser seguida. É isso que se quer?
- **P8 (L14, CE-47):** o teste simula o bloqueio fazendo `Storage.prototype.getItem` lançar `SecurityError`. Em alguns navegadores, com o armazenamento bloqueado, quem lança erro é o próprio acesso a `window.localStorage`. A reprodução real ainda precisa ser feita.

### Premissas a conferir ao executar

- Não li `api-config.token.ts`. O `CONFIG_TESTE` tem apenas os campos que o service e o interceptor usam (`apiKey`, `baseUrl`, `iconUrl`, `units`, `lang`). Se o token exigir outros, é preciso completar.
- Não li `WeatherCardComponent` nem `ForecastCardComponent`. Por isso, nenhuma asserção depende do conteúdo deles: o sucesso é verificado pelo título "Próximos dias", pelos botões do histórico e pela ausência de `role="alert"`.
- Corpo não JSON (CE-13 e CE-18): o `HttpClientTestingBackend` repassa a string sem tentar o parse, então o teste exercita o caminho "corpo não é objeto → `TypeError` → `UNKNOWN`". No navegador real, o `HttpClient` falharia antes, no parse, com `HttpErrorResponse` status 200. O resultado na tela é o mesmo (`UNKNOWN`), mas o caminho é outro.
- Parto do princípio de que `fixture.detectChanges()` executa os `effect`s, que gravam o `localStorage`. Se a versão do Angular exigir, é preciso acrescentar `TestBed.flushEffects()` em `criarTela`.
