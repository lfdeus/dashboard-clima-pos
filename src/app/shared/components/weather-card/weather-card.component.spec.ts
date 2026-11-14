import { TestBed } from '@angular/core/testing';
import { WeatherCardComponent } from './weather-card.component';
import { CurrentWeather } from '../../../core/models/weather.model';
import { API_CONFIG, ApiConfig } from '../../../core/tokens/api-config.token';
import { provideHttpClient } from '@angular/common/http';

const CONFIG: ApiConfig = {
  apiKey: 'k',
  baseUrl: 'https://api.test/v1',
  iconUrl: 'https://icons.test',
  lang: 'pt_br',
  units: 'metric'
};

const w: CurrentWeather = {
  city: 'Lisbon',
  country: 'PT',
  description: 'céu limpo',
  iconCode: '01d',
  temperature: 22,
  feelsLike: 21,
  tempMin: 19,
  tempMax: 24,
  humidity: 60,
  pressure: 1013,
  windSpeed: 3,
  windDeg: 90,
  cloudiness: 5,
  visibility: 10000,
  sunrise: 0,
  sunset: 0,
  timezone: 0,
  observedAt: 1_700_000_000
};

/** Valor exibido no cartão para um rótulo da lista de detalhes (ex.: "Umidade"). */
function detail(root: HTMLElement, label: string): string {
  const term = Array.from(root.querySelectorAll('dt')).find(
    (dt) => dt.textContent?.trim() === label
  );
  return term?.nextElementSibling?.textContent?.trim() ?? '';
}

describe('WeatherCardComponent', () => {
  it('renders city, country, description and temperature', async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherCardComponent],
      providers: [provideHttpClient(), { provide: API_CONFIG, useValue: CONFIG }]
    }).compileComponents();

    const fixture = TestBed.createComponent(WeatherCardComponent);
    fixture.componentRef.setInput('weather', w);
    fixture.componentRef.setInput('unit', 'celsius');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Lisbon');
    expect(text).toContain('PT');
    expect(text).toContain('céu limpo');
    expect(text).toContain('22°C');
  });

  it('renders nothing when weather input is null', async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherCardComponent],
      providers: [provideHttpClient(), { provide: API_CONFIG, useValue: CONFIG }]
    }).compileComponents();

    const fixture = TestBed.createComponent(WeatherCardComponent);
    fixture.componentRef.setInput('weather', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('article')).toBeNull();
  });

  it('shows sunrise and sunset in the local time of the city (RF04)', async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherCardComponent],
      providers: [provideHttpClient(), { provide: API_CONFIG, useValue: CONFIG }]
    }).compileComponents();

    // São Paulo (UTC-3): em 01/01 o sol nasce às 05:24 e se põe às 18:57, no horário da cidade
    const saoPaulo: CurrentWeather = {
      ...w,
      city: 'São Paulo',
      country: 'BR',
      timezone: -10800,
      sunrise: Date.parse('2030-01-01T08:24:00Z') / 1000,
      sunset: Date.parse('2030-01-01T21:57:00Z') / 1000
    };

    const fixture = TestBed.createComponent(WeatherCardComponent);
    fixture.componentRef.setInput('weather', saoPaulo);
    fixture.detectChanges();
    const card = fixture.nativeElement as HTMLElement;
    expect(detail(card, 'Nascer do sol')).toBe('05:24');
    expect(detail(card, 'Pôr do sol')).toBe('18:57');
  });
});
