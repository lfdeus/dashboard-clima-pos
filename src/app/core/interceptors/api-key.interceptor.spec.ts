import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { apiKeyInterceptor } from './api-key.interceptor';
import { API_CONFIG, ApiConfig } from '../tokens/api-config.token';

const CONFIG: ApiConfig = {
  apiKey: 'KEY-123',
  baseUrl: 'https://api.test/v1',
  iconUrl: 'https://icons.test',
  lang: 'pt_br',
  units: 'metric'
};

describe('apiKeyInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiKeyInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: CONFIG }
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('appends appid, units and lang to OpenWeather requests', () => {
    http.get(`${CONFIG.baseUrl}/weather`).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${CONFIG.baseUrl}/weather`);
    expect(req.request.params.get('appid')).toBe('KEY-123');
    expect(req.request.params.get('units')).toBe('metric');
    expect(req.request.params.get('lang')).toBe('pt_br');
    req.flush({});
  });

  it('does not modify requests to other domains', () => {
    http.get('https://other.example.com/data').subscribe();
    const req = httpMock.expectOne('https://other.example.com/data');
    expect(req.request.params.get('appid')).toBeNull();
    req.flush({});
  });
});
