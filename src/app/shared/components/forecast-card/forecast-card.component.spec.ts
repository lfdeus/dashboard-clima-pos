import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ForecastCardComponent } from './forecast-card.component';
import { ForecastDay } from '../../../core/models/forecast.model';
import { API_CONFIG, ApiConfig } from '../../../core/tokens/api-config.token';

const CONFIG: ApiConfig = {
  apiKey: 'k',
  baseUrl: 'https://api.test/v1',
  iconUrl: 'https://icons.test',
  lang: 'pt_br',
  units: 'metric'
};

const day: ForecastDay = {
  date: '2030-01-01',
  timestamp: 1_900_000_000,
  tempMin: 12,
  tempMax: 18,
  iconCode: '10d',
  description: 'chuva fraca',
  humidity: 70,
  windSpeed: 4
};

describe('ForecastCardComponent', () => {
  it('renders min and max temperatures and description', async () => {
    await TestBed.configureTestingModule({
      imports: [ForecastCardComponent],
      providers: [provideHttpClient(), { provide: API_CONFIG, useValue: CONFIG }]
    }).compileComponents();

    const fixture = TestBed.createComponent(ForecastCardComponent);
    fixture.componentRef.setInput('day', day);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('18°C');
    expect(text).toContain('12°C');
    expect(text).toContain('chuva fraca');
  });
});
