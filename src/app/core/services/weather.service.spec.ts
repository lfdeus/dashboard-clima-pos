import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { WeatherService, WeatherApiError } from './weather.service';
import { API_CONFIG, ApiConfig } from '../tokens/api-config.token';
import { OpenWeatherCurrentResponse } from '../models/weather.model';
import { OpenWeatherForecastResponse } from '../models/forecast.model';

const TEST_CONFIG: ApiConfig = {
  apiKey: 'test-key',
  baseUrl: 'https://api.test/v1',
  iconUrl: 'https://icons.test',
  lang: 'pt_br',
  units: 'metric'
};

const buildCurrent = (): OpenWeatherCurrentResponse => ({
  name: 'Lisbon',
  dt: 1_700_000_000,
  timezone: 0,
  visibility: 10000,
  sys: { country: 'PT', sunrise: 1, sunset: 2 },
  weather: [{ id: 800, main: 'Clear', description: 'céu limpo', icon: '01d' }],
  main: {
    temp: 22,
    feels_like: 21,
    temp_min: 19,
    temp_max: 24,
    humidity: 60,
    pressure: 1013
  },
  wind: { speed: 3.4, deg: 90 },
  clouds: { all: 5 }
});

const buildForecast = (): OpenWeatherForecastResponse => ({
  city: { name: 'Lisbon', country: 'PT', timezone: 0 },
  list: [
    {
      dt: 1,
      dt_txt: '2030-01-01 12:00:00',
      main: { temp: 20, temp_min: 18, temp_max: 22, humidity: 60 },
      weather: [{ id: 800, main: 'Clear', description: 'céu limpo', icon: '01d' }],
      wind: { speed: 2, deg: 90 }
    },
    {
      dt: 2,
      dt_txt: '2030-01-01 15:00:00',
      main: { temp: 23, temp_min: 21, temp_max: 24, humidity: 55 },
      weather: [{ id: 800, main: 'Clear', description: 'céu limpo', icon: '01d' }],
      wind: { speed: 3, deg: 90 }
    },
    {
      dt: 3,
      dt_txt: '2030-01-02 12:00:00',
      main: { temp: 18, temp_min: 16, temp_max: 20, humidity: 70 },
      weather: [{ id: 500, main: 'Rain', description: 'chuva fraca', icon: '10d' }],
      wind: { speed: 4, deg: 180 }
    }
  ]
});

describe('WeatherService', () => {
  let service: WeatherService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: TEST_CONFIG }
      ]
    });
    service = TestBed.inject(WeatherService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('builds icon URLs from configured iconUrl', () => {
    expect(service.iconUrl('10d')).toBe('https://icons.test/10d@2x.png');
    expect(service.iconUrl('10d', '4x')).toBe('https://icons.test/10d@4x.png');
  });

  it('maps current weather response to a normalized model', (done) => {
    service.getCurrentWeather('Lisbon').subscribe((res) => {
      expect(res.city).toBe('Lisbon');
      expect(res.country).toBe('PT');
      expect(res.temperature).toBe(22);
      expect(res.iconCode).toBe('01d');
      expect(res.windSpeed).toBe(3.4);
      done();
    });
    const req = httpMock.expectOne(
      (r) => r.url === 'https://api.test/v1/weather' && r.params.get('q') === 'Lisbon'
    );
    expect(req.request.method).toBe('GET');
    req.flush(buildCurrent());
  });

  it('groups forecast items by day and limits to 5', (done) => {
    service.getForecast('Lisbon').subscribe((days) => {
      expect(days.length).toBe(2);
      expect(days[0].tempMax).toBeGreaterThanOrEqual(days[0].tempMin);
      done();
    });
    httpMock.expectOne((r) => r.url === 'https://api.test/v1/forecast').flush(buildForecast());
  });

  it('translates 404 to NOT_FOUND WeatherApiError', (done) => {
    service.getCurrentWeather('Atlantis').subscribe({
      error: (err: WeatherApiError) => {
        expect(err).toBeInstanceOf(WeatherApiError);
        expect(err.code).toBe('NOT_FOUND');
        done();
      }
    });
    httpMock
      .expectOne((r) => r.url === 'https://api.test/v1/weather')
      .flush({ message: 'city not found' }, { status: 404, statusText: 'Not Found' });
  });

  it('translates network errors (status 0) to NETWORK code', (done) => {
    service.getCurrentWeather('Lisbon').subscribe({
      error: (err: WeatherApiError) => {
        expect(err.code).toBe('NETWORK');
        done();
      }
    });
    httpMock
      .expectOne((r) => r.url === 'https://api.test/v1/weather')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown' });
  });

  it('translates 401 to UNAUTHORIZED code', (done) => {
    service.getCurrentWeather('Lisbon').subscribe({
      error: (err: WeatherApiError) => {
        expect(err.code).toBe('UNAUTHORIZED');
        done();
      }
    });
    httpMock
      .expectOne((r) => r.url === 'https://api.test/v1/weather')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
  });
});
