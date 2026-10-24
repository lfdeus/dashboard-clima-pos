/**
 * Testes de integração da jornada "consultar o clima de uma cidade".
 *
 * Fronteira do teste:
 * - reais: DashboardComponent, SearchBarComponent, WeatherCardComponent, ForecastCardComponent,
 *   WeatherService, apiKeyInterceptor, pipe temperatureUnit e o localStorage do navegador;
 * - simulado: apenas o HTTP, com provideHttpClientTesting() e HttpTestingController.
 *
 * O teste dirige a tela pelo DOM (digitação, submit, cliques) e localiza elementos por papel
 * ARIA, aria-label ou texto visível. O oráculo vem de docs/arquitetura/invariantes.md (INVxx) e
 * dos contratos em docs/arquitetura/contratos. Testes com [Lxx] no nome caracterizam o
 * comportamento atual de uma lacuna ainda não decidida: não são a regra esperada.
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
import { API_CONFIG, ApiConfig } from '../core/tokens/api-config.token';
import { OpenWeatherCurrentResponse } from '../core/models/weather.model';
import { OpenWeatherForecastResponse } from '../core/models/forecast.model';

const CONFIG: ApiConfig = {
  apiKey: 'chave-de-teste',
  baseUrl: 'https://api.test/data/2.5',
  iconUrl: 'https://icons.test/img/wn',
  lang: 'pt_br',
  units: 'metric'
};

const WEATHER_URL = `${CONFIG.baseUrl}/weather`;
const FORECAST_URL = `${CONFIG.baseUrl}/forecast`;
const DEBOUNCE_MS = 400; // INV09

const HISTORY_KEY = 'clima:history'; // INV07
const UNIT_KEY = 'clima:unit'; // INV07
const THEME_KEY = 'clima:theme'; // INV07

const ROTULO_UNIDADE = 'Alternar entre Celsius e Fahrenheit';

type PontoPrevisao = OpenWeatherForecastResponse['list'][number];

interface ConsultaPendente {
  clima: TestRequest;
  previsao: TestRequest;
}

// ---------------------------------------------------------------------------------------------
// Respostas simuladas, no formato do contrato openweathermap-consumido.openapi.yaml
// ---------------------------------------------------------------------------------------------

function respostaClima(nome: string, pais: string, timezone = 0): OpenWeatherCurrentResponse {
  return {
    name: nome,
    dt: Date.parse('2030-01-01T12:00:00Z') / 1000,
    timezone,
    visibility: 10000,
    sys: {
      country: pais,
      sunrise: Date.parse('2030-01-01T07:55:00Z') / 1000,
      sunset: Date.parse('2030-01-01T17:25:00Z') / 1000
    },
    weather: [{ id: 800, main: 'Clear', description: 'céu limpo', icon: '01d' }],
    main: {
      temp: 22.4,
      feels_like: 21,
      temp_min: 19,
      temp_max: 24,
      humidity: 60,
      pressure: 1013
    },
    wind: { speed: 3, deg: 90 },
    clouds: { all: 5 }
  };
}

/** Um ponto de 3 horas da previsão; `dt` é coerente com `dt_txt` (UTC). */
function ponto(
  dataUtc: string,
  horaUtc: string,
  tempMin: number,
  tempMax: number,
  descricao = 'céu limpo',
  icone = '01d'
): PontoPrevisao {
  return {
    dt: Date.parse(`${dataUtc}T${horaUtc}Z`) / 1000,
    dt_txt: `${dataUtc} ${horaUtc}`,
    main: { temp: (tempMin + tempMax) / 2, temp_min: tempMin, temp_max: tempMax, humidity: 70 },
    weather: [{ id: 800, main: 'Clear', description: descricao, icon: icone }],
    wind: { speed: 2, deg: 180 }
  };
}

/**
 * Seis dias em UTC. Com o fuso da cidade igual a 0, a data UTC e a data local coincidem, então
 * o agrupamento esperado não depende da decisão da L07.
 * - 2030-01-01: mínima (15) no ponto das 09h e máxima (25) no das 15h; o ponto das 12h tem 17/22.
 * - 2030-01-02: não tem ponto das 12h; vale o primeiro ponto do grupo (00h, "nublado").
 * - 2030-01-06: sexto grupo, deve ficar de fora (o contrato mantém os 5 primeiros).
 */
const PONTOS_PADRAO: PontoPrevisao[] = [
  ponto('2030-01-01', '09:00:00', 15, 18, 'névoa', '50d'),
  ponto('2030-01-01', '12:00:00', 17, 22, 'céu limpo', '01d'),
  ponto('2030-01-01', '15:00:00', 16, 25, 'nuvens dispersas', '03d'),
  ponto('2030-01-02', '00:00:00', 10, 12, 'nublado', '04n'),
  ponto('2030-01-02', '03:00:00', 9, 11, 'chuva leve', '10n'),
  ponto('2030-01-03', '12:00:00', 14, 20),
  ponto('2030-01-04', '12:00:00', 13, 21),
  ponto('2030-01-05', '12:00:00', 12, 19),
  ponto('2030-01-06', '12:00:00', 11, 18)
];

function respostaPrevisao(
  nome = 'Lisbon',
  pais = 'PT',
  timezone = 0,
  lista: PontoPrevisao[] = PONTOS_PADRAO
): OpenWeatherForecastResponse {
  return { city: { name: nome, country: pais, timezone }, list: lista };
}

describe('Integração: consultar o clima de uma cidade', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideHttpClient(withInterceptors([apiKeyInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: CONFIG }
      ]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    // O tema é aplicado no documento global; limpa para não vazar entre testes.
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  });

  // -------------------------------------------------------------------------------------------
  // Auxiliares de tela (só DOM) e de HTTP (só HttpTestingController)
  // -------------------------------------------------------------------------------------------

  function abrirTela(): void {
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function textoDe(el: Element | null | undefined): string {
    return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function campoCidade(): HTMLInputElement {
    const campo = raiz().querySelector<HTMLInputElement>('input[aria-label="Nome da cidade"]');
    expect(campo).withContext('campo "Nome da cidade"').not.toBeNull();
    return campo!;
  }

  function digitar(texto: string): void {
    const campo = campoCidade();
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function pressionarEnter(): void {
    // Enter num campo de formulário provoca a submissão implícita (evento "submit").
    // Um keydown sintético não aciona essa submissão no navegador, por isso o evento é disparado.
    const formulario = raiz().querySelector<HTMLFormElement>('form[role="search"]');
    expect(formulario).withContext('formulário com role="search"').not.toBeNull();
    formulario!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function clicar(botao: HTMLElement): void {
    botao.click();
    fixture.detectChanges();
  }

  function botaoPorRotulo(rotulo: string): HTMLButtonElement {
    const botao = raiz().querySelector<HTMLButtonElement>(`button[aria-label="${rotulo}"]`);
    expect(botao).withContext(`botão "${rotulo}"`).not.toBeNull();
    return botao!;
  }

  function itensDoHistorico(): HTMLButtonElement[] {
    const rotulo = Array.from(raiz().querySelectorAll('span')).find(
      (s) => textoDe(s) === 'Histórico:'
    );
    if (!rotulo?.parentElement) return [];
    return Array.from(rotulo.parentElement.querySelectorAll('button')).filter(
      (b) => b.getAttribute('aria-label') !== 'Limpar histórico'
    );
  }

  function nomesNoHistorico(): string[] {
    return itensDoHistorico().map((b) => textoDe(b));
  }

  function itemDoHistorico(nome: string): HTMLButtonElement {
    const item = itensDoHistorico().find((b) => textoDe(b) === nome);
    expect(item).withContext(`item "${nome}" do histórico`).toBeDefined();
    return item!;
  }

  function historicoSalvo(): unknown {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  }

  function cartaoClimaAtual(titulo: string): HTMLElement | null {
    const cabecalho = Array.from(raiz().querySelectorAll('h2')).find((h) => textoDe(h) === titulo);
    return (cabecalho?.closest('article') as HTMLElement | null) ?? null;
  }

  function indicador(cartao: HTMLElement, rotulo: string): string {
    const termo = Array.from(cartao.querySelectorAll('dt')).find((d) => textoDe(d) === rotulo);
    return textoDe(termo?.nextElementSibling);
  }

  function cartoesDePrevisao(): HTMLElement[] {
    return Array.from(
      raiz().querySelectorAll<HTMLElement>('article[aria-label^="Previsão para "]')
    );
  }

  function datasDaPrevisao(): string[] {
    return cartoesDePrevisao().map((c) =>
      (c.getAttribute('aria-label') ?? '').replace('Previsão para ', '')
    );
  }

  function cartaoDePrevisao(data: string): HTMLElement {
    const cartao = raiz().querySelector<HTMLElement>(`article[aria-label="Previsão para ${data}"]`);
    expect(cartao).withContext(`cartão de previsão de ${data}`).not.toBeNull();
    return cartao!;
  }

  /** Exige exatamente uma chamada a /weather e uma a /forecast, ambas com o termo `q`. */
  function esperarConsulta(termo: string): ConsultaPendente {
    const clima = httpMock.expectOne((r) => r.url === WEATHER_URL);
    const previsao = httpMock.expectOne((r) => r.url === FORECAST_URL);
    expect(clima.request.params.get('q')).toBe(termo);
    expect(previsao.request.params.get('q')).toBe(termo);
    return { clima, previsao };
  }

  function responder(
    consulta: ConsultaPendente,
    clima: OpenWeatherCurrentResponse,
    previsao: OpenWeatherForecastResponse
  ): void {
    consulta.clima.flush(clima);
    consulta.previsao.flush(previsao);
    tick();
    fixture.detectChanges();
  }

  /**
   * A digitação que antecede o Enter ainda dispara a busca do debounce (comportamento atual,
   * registrado na L03). Os testes do caminho feliz não decidem essa regra: este auxiliar só
   * esgota o temporizador e responde às requisições extras que existirem, sem contá-las.
   * A contagem é caracterizada no CI-13.
   */
  function concluirBuscaDoDebounce(nome: string, pais: string): void {
    tick(DEBOUNCE_MS);
    httpMock.match((r) => r.url === WEATHER_URL).forEach((r) => r.flush(respostaClima(nome, pais)));
    httpMock
      .match((r) => r.url === FORECAST_URL)
      .forEach((r) => r.flush(respostaPrevisao(nome, pais)));
    tick();
    fixture.detectChanges();
  }

  // -------------------------------------------------------------------------------------------
  // Cenários
  // -------------------------------------------------------------------------------------------

  it('CI-01 busca confirmada com Enter consulta clima e previsão e exibe o resultado', fakeAsync(() => {
    // Arrange
    abrirTela();
    expect(textoDe(raiz())).toContain('Comece pesquisando uma cidade');

    // Act
    digitar('Lisbon');
    pressionarEnter();
    const consulta = esperarConsulta('Lisbon');

    // Assert: antes da resposta, nada foi gravado no histórico (INV06)
    expect(historicoSalvo()).toEqual([]);

    // Act: a API responde às duas chamadas
    responder(consulta, respostaClima('Lisbon', 'PT'), respostaPrevisao());

    // Assert: clima atual e previsão aparecem juntos (INV05) e o histórico é gravado (INV06)
    expect(cartaoClimaAtual('Lisbon, PT')).not.toBeNull();
    expect(cartoesDePrevisao().length).toBe(5);
    expect(textoDe(raiz())).not.toContain('Comece pesquisando uma cidade');
    expect(historicoSalvo()).toEqual(['Lisbon']);

    concluirBuscaDoDebounce('Lisbon', 'PT');
  }));

  it('CI-02 busca pela digitação consulta só o termo final, 400 ms após a última tecla (INV09)', fakeAsync(() => {
    // Arrange
    abrirTela();

    // Act: o usuário digita com pausas menores que o debounce
    digitar('Li');
    tick(200);
    digitar('Lisb');
    tick(200);
    digitar('Lisbon');
    tick(DEBOUNCE_MS - 1);

    // Assert: nenhuma requisição antes de completar 400 ms sem digitar
    httpMock.expectNone(() => true);

    // Act: completa o intervalo de debounce e a API responde
    tick(1);
    const consulta = esperarConsulta('Lisbon');
    responder(consulta, respostaClima('Lisbon', 'PT'), respostaPrevisao());

    // Assert
    expect(cartaoClimaAtual('Lisbon, PT')).not.toBeNull();
    expect(historicoSalvo()).toEqual(['Lisbon']);
  }));

  it('CI-03 termo com menos de 2 caracteres não consulta a API, nem por digitação nem por Enter (INV09)', fakeAsync(() => {
    // Arrange
    abrirTela();

    // Act
    digitar(' L ');
    tick(DEBOUNCE_MS);
    pressionarEnter();
    tick(DEBOUNCE_MS);

    // Assert
    httpMock.expectNone(() => true);
    expect(textoDe(raiz())).toContain('Comece pesquisando uma cidade');
  }));

  it('CI-04 requisições levam q do service e appid, units=metric e lang=pt_br do interceptor (contrato, INV03, INV04)', fakeAsync(() => {
    // Arrange
    abrirTela();

    // Act: termo com espaços nas pontas, confirmado com Enter
    digitar('  Lisbon  ');
    pressionarEnter();

    // Assert: uma chamada a cada operação do contrato, com os parâmetros exigidos
    const consulta = esperarConsulta('Lisbon');
    expect(consulta.clima.request.url).toBe(WEATHER_URL);
    expect(consulta.previsao.request.url).toBe(FORECAST_URL);
    for (const req of [consulta.clima.request, consulta.previsao.request]) {
      expect(req.method).toBe('GET');
      expect(req.params.keys().sort()).toEqual(['appid', 'lang', 'q', 'units']);
      expect(req.params.get('q')).toBe('Lisbon');
      expect(req.params.get('appid')).toBe(CONFIG.apiKey);
      expect(req.params.get('units')).toBe('metric');
      expect(req.params.get('lang')).toBe('pt_br');
    }
    httpMock.expectNone((r) => !r.url.startsWith(CONFIG.baseUrl));

    responder(consulta, respostaClima('Lisbon', 'PT'), respostaPrevisao());
    concluirBuscaDoDebounce('Lisbon', 'PT');
  }));

  it('CI-05 renderiza o clima atual normalizado, com ícone sem a chave da API (contrato, INV03)', fakeAsync(() => {
    // Arrange
    abrirTela();

    // Act
    digitar('Lisbon');
    tick(DEBOUNCE_MS);
    responder(esperarConsulta('Lisbon'), respostaClima('Lisbon', 'PT'), respostaPrevisao());

    // Assert
    const cartao = cartaoClimaAtual('Lisbon, PT');
    expect(cartao).not.toBeNull();
    const texto = textoDe(cartao);
    expect(texto).toContain('22°C');
    expect(texto).toContain('céu limpo');
    expect(texto).toContain('Sensação térmica 21°C · Mín 19°C · Máx 24°C');
    expect(indicador(cartao!, 'Umidade')).toBe('60%');
    expect(indicador(cartao!, 'Vento')).toBe('3 m/s');
    expect(indicador(cartao!, 'Pressão')).toBe('1013 hPa');
    expect(indicador(cartao!, 'Nuvens')).toBe('5%');

    const icone = cartao!.querySelector('img');
    expect(icone?.getAttribute('alt')).toBe('céu limpo');
    expect(icone?.getAttribute('src')).toBe(`${CONFIG.iconUrl}/01d@4x.png`);
    expect(icone?.getAttribute('src')).not.toContain('appid');
    expect(icone?.getAttribute('src')).not.toContain(CONFIG.apiKey);
  }));

  it('CI-06 agrupa a previsão por dia, com mínima e máxima do dia e no máximo 5 cartões (contrato)', fakeAsync(() => {
    // Arrange
    abrirTela();

    // Act
    digitar('Lisbon');
    tick(DEBOUNCE_MS);
    responder(esperarConsulta('Lisbon'), respostaClima('Lisbon', 'PT'), respostaPrevisao());

    // Assert: um cartão por data, os 5 primeiros grupos
    const titulos = Array.from(raiz().querySelectorAll('h2')).map((h) => textoDe(h));
    expect(titulos).toContain('Próximos dias');
    expect(datasDaPrevisao()).toEqual([
      '2030-01-01',
      '2030-01-02',
      '2030-01-03',
      '2030-01-04',
      '2030-01-05'
    ]);

    // Assert: mínima = menor temp_min do grupo; máxima = maior temp_max; ponto das 12h representa o dia
    const dia1 = cartaoDePrevisao('2030-01-01');
    expect(textoDe(dia1)).toMatch(/25°C 15°C/);
    expect(textoDe(dia1)).toContain('céu limpo');
    expect(dia1.querySelector('img')?.getAttribute('src')).toBe(`${CONFIG.iconUrl}/01d@2x.png`);

    // Assert: sem ponto das 12h, vale o primeiro ponto do grupo
    const dia2 = cartaoDePrevisao('2030-01-02');
    expect(textoDe(dia2)).toMatch(/12°C 9°C/);
    expect(textoDe(dia2)).toContain('nublado');
    expect(dia2.querySelector('img')?.getAttribute('src')).toBe(`${CONFIG.iconUrl}/04n@2x.png`);

    expect(textoDe(cartaoDePrevisao('2030-01-03'))).toMatch(/20°C 14°C/);
  }));

  it('CI-07 grava no histórico só após o sucesso e com o nome devolvido pela API (INV06)', fakeAsync(() => {
    // Arrange
    abrirTela();

    // Act: o termo digitado difere do nome normalizado pela API
    digitar('lisboa');
    tick(DEBOUNCE_MS);
    const consulta = esperarConsulta('lisboa');

    // Assert: nada gravado enquanto a resposta não chega
    expect(historicoSalvo()).toEqual([]);
    expect(nomesNoHistorico()).toEqual([]);

    // Act
    responder(consulta, respostaClima('Lisbon', 'PT'), respostaPrevisao());

    // Assert
    expect(historicoSalvo()).toEqual(['Lisbon']);
    expect(nomesNoHistorico()).toEqual(['Lisbon']);
  }));

  it('CI-08 histórico põe a mais recente no topo, sem repetir (sem diferenciar caixa) e com no máximo 5 (INV06)', fakeAsync(() => {
    // Arrange
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(['Lisbon', 'tokyo', 'Paris', 'Berlin', 'Madrid'])
    );
    abrirTela();

    // Act: cidade já presente com outra caixa
    digitar('Tokyo');
    tick(DEBOUNCE_MS);
    responder(
      esperarConsulta('Tokyo'),
      respostaClima('Tokyo', 'JP', 32400),
      respostaPrevisao('Tokyo', 'JP', 32400)
    );

    // Assert
    expect(historicoSalvo()).toEqual(['Tokyo', 'Lisbon', 'Paris', 'Berlin', 'Madrid']);
    expect(nomesNoHistorico()).toEqual(['Tokyo', 'Lisbon', 'Paris', 'Berlin', 'Madrid']);

    // Act: cidade nova com o histórico cheio
    digitar('Rome');
    tick(DEBOUNCE_MS);
    responder(
      esperarConsulta('Rome'),
      respostaClima('Rome', 'IT', 3600),
      respostaPrevisao('Rome', 'IT', 3600)
    );

    // Assert: a mais antiga sai
    expect(historicoSalvo()).toEqual(['Rome', 'Tokyo', 'Lisbon', 'Paris', 'Berlin']);
    expect(nomesNoHistorico()).toEqual(['Rome', 'Tokyo', 'Lisbon', 'Paris', 'Berlin']);
  }));

  it('CI-09 clicar num item do histórico consulta aquela cidade e a move para o topo (INV06)', fakeAsync(() => {
    // Arrange
    localStorage.setItem(HISTORY_KEY, JSON.stringify(['Lisbon', 'Tokyo']));
    abrirTela();

    // Act
    clicar(itemDoHistorico('Tokyo'));
    const consulta = esperarConsulta('Tokyo');

    // Assert: a busca pelo histórico passa pelo mesmo interceptor
    expect(consulta.clima.request.params.get('appid')).toBe(CONFIG.apiKey);
    expect(consulta.clima.request.params.get('units')).toBe('metric');

    // Act
    responder(
      consulta,
      respostaClima('Tokyo', 'JP', 32400),
      respostaPrevisao('Tokyo', 'JP', 32400)
    );

    // Assert
    expect(cartaoClimaAtual('Tokyo, JP')).not.toBeNull();
    expect(historicoSalvo()).toEqual(['Tokyo', 'Lisbon']);
    expect(nomesNoHistorico()).toEqual(['Tokyo', 'Lisbon']);
  }));

  it('CI-10 alterna °C/°F no cliente, sem nova requisição, e persiste a unidade (INV04, INV07)', fakeAsync(() => {
    // Arrange
    abrirTela();
    digitar('Lisbon');
    tick(DEBOUNCE_MS);
    responder(esperarConsulta('Lisbon'), respostaClima('Lisbon', 'PT'), respostaPrevisao());
    const botaoUnidade = botaoPorRotulo(ROTULO_UNIDADE);
    expect(botaoUnidade.getAttribute('aria-pressed')).toBe('false');
    expect(textoDe(cartaoClimaAtual('Lisbon, PT'))).toContain('22°C');

    // Act
    clicar(botaoUnidade);
    tick();

    // Assert: nenhuma requisição; conversão feita na apresentação
    httpMock.expectNone(() => true);
    const cartao = cartaoClimaAtual('Lisbon, PT');
    const texto = textoDe(cartao);
    expect(texto).toContain('72°F');
    expect(texto).toContain('Sensação térmica 70°F · Mín 66°F · Máx 75°F');
    expect(texto).not.toContain('°C');
    expect(indicador(cartao!, 'Vento')).toBe('3 m/s');
    expect(textoDe(cartaoDePrevisao('2030-01-01'))).toMatch(/77°F 59°F/);
    expect(textoDe(cartaoDePrevisao('2030-01-02'))).toMatch(/54°F 48°F/);
    expect(botaoPorRotulo(ROTULO_UNIDADE).getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem(UNIT_KEY)).toBe('fahrenheit');

    // Act: volta para Celsius
    clicar(botaoPorRotulo(ROTULO_UNIDADE));
    tick();

    // Assert
    httpMock.expectNone(() => true);
    expect(textoDe(cartaoClimaAtual('Lisbon, PT'))).toContain('22°C');
    expect(textoDe(cartaoDePrevisao('2030-01-01'))).toMatch(/25°C 15°C/);
    expect(localStorage.getItem(UNIT_KEY)).toBe('celsius');
  }));

  it('CI-11 restaura unidade, tema e histórico do localStorage ao abrir a tela (INV07, INV04)', fakeAsync(() => {
    // Arrange
    localStorage.setItem(UNIT_KEY, 'fahrenheit');
    localStorage.setItem(THEME_KEY, 'dark');
    localStorage.setItem(HISTORY_KEY, JSON.stringify(['Lisbon', 'Tokyo']));

    // Act
    abrirTela();

    // Assert: preferências aplicadas sem nenhuma requisição
    httpMock.expectNone(() => true);
    expect(botaoPorRotulo(ROTULO_UNIDADE).getAttribute('aria-pressed')).toBe('true');
    expect(botaoPorRotulo('Ativar tema claro')).toBeTruthy();
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
    expect(nomesNoHistorico()).toEqual(['Lisbon', 'Tokyo']);

    // Act: consulta a partir do histórico restaurado
    clicar(itemDoHistorico('Lisbon'));
    const consulta = esperarConsulta('Lisbon');

    // Assert: mesmo com °F salvo, a API é consultada em métrico e a tela mostra °F
    expect(consulta.clima.request.params.get('units')).toBe('metric');
    expect(consulta.previsao.request.params.get('units')).toBe('metric');
    responder(consulta, respostaClima('Lisbon', 'PT'), respostaPrevisao());
    expect(textoDe(cartaoClimaAtual('Lisbon, PT'))).toContain('72°F');
  }));

  it('CI-12 valores inválidos no localStorage voltam ao padrão do contrato (localstorage.schema.json)', fakeAsync(() => {
    // Arrange
    localStorage.setItem(UNIT_KEY, 'kelvin');
    localStorage.setItem(HISTORY_KEY, JSON.stringify(['Lisbon', 42, null]));

    // Act
    abrirTela();

    // Assert: unidade inválida vira celsius; itens que não são string são descartados
    expect(botaoPorRotulo(ROTULO_UNIDADE).getAttribute('aria-pressed')).toBe('false');
    expect(nomesNoHistorico()).toEqual(['Lisbon']);

    // Act
    clicar(itemDoHistorico('Lisbon'));
    responder(esperarConsulta('Lisbon'), respostaClima('Lisbon', 'PT'), respostaPrevisao());

    // Assert
    expect(textoDe(cartaoClimaAtual('Lisbon, PT'))).toContain('22°C');
  }));

  it('CI-13 [L03] caracteriza: Enter antes do fim do debounce dispara duas buscas (4 requisições)', fakeAsync(() => {
    // Arrange
    abrirTela();

    // Act
    digitar('Lisbon');
    pressionarEnter();
    tick(DEBOUNCE_MS);

    // Assert: comportamento atual, não regra decidida (L03 pergunta se os gatilhos devem ser deduplicados)
    const climas = httpMock.match((r) => r.url === WEATHER_URL);
    const previsoes = httpMock.match((r) => r.url === FORECAST_URL);
    expect(climas.length).toBe(2);
    expect(previsoes.length).toBe(2);

    climas.forEach((r) => r.flush(respostaClima('Lisbon', 'PT')));
    previsoes.forEach((r) => r.flush(respostaPrevisao()));
    tick();
    fixture.detectChanges();
    expect(historicoSalvo()).toEqual(['Lisbon']);
  }));

  it('CI-14 [L07] caracteriza: a previsão é agrupada pela data UTC de dt_txt, sem usar o fuso da cidade', fakeAsync(() => {
    // Arrange: São Paulo (UTC-3); 2030-01-02 00:00 UTC ainda é 2030-01-01 21:00 no horário local
    const pontos = [
      ponto('2030-01-01', '21:00:00', 20, 24),
      ponto('2030-01-02', '00:00:00', 18, 21),
      ponto('2030-01-02', '12:00:00', 22, 30)
    ];
    abrirTela();

    // Act
    digitar('Sao Paulo');
    tick(DEBOUNCE_MS);
    responder(
      esperarConsulta('Sao Paulo'),
      respostaClima('São Paulo', 'BR', -10800),
      respostaPrevisao('São Paulo', 'BR', -10800, pontos)
    );

    // Assert: comportamento atual; L07 ainda não decidiu se os dias seguem o fuso da cidade
    expect(datasDaPrevisao()).toEqual(['2030-01-01', '2030-01-02']);
    expect(textoDe(cartaoDePrevisao('2030-01-01'))).toMatch(/24°C 20°C/);
    expect(textoDe(cartaoDePrevisao('2030-01-02'))).toMatch(/30°C 18°C/);
  }));

  it('CI-15 exibe o dia da semana da previsão em português do Brasil (INV10)', fakeAsync(() => {
    // Arrange
    abrirTela();

    // Act: 2030-01-01 é terça-feira; o ponto das 12h UTC cai no mesmo dia em fusos de UTC-11 a UTC+11
    digitar('Lisbon');
    tick(DEBOUNCE_MS);
    responder(esperarConsulta('Lisbon'), respostaClima('Lisbon', 'PT'), respostaPrevisao());

    // Assert: INV10 está marcada como violada (D01); este teste deve falhar até a correção
    const texto = textoDe(cartaoDePrevisao('2030-01-01'));
    expect(texto).not.toContain('Tue');
    expect(texto).toMatch(/\bter\b/i);
  }));
});
