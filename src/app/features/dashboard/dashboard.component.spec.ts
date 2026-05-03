import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { DashboardComponent } from './dashboard.component';
import { API_CONFIG, ApiConfig } from '../../core/tokens/api-config.token';

const CONFIG: ApiConfig = {
  apiKey: 'k',
  baseUrl: 'https://api.test/v1',
  iconUrl: 'https://icons.test',
  lang: 'pt_br',
  units: 'metric'
};

describe('DashboardComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: CONFIG }
      ]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('initial state has no result and no error', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Comece pesquisando uma cidade');
  });

  it('loads weather and forecast on search and updates history', fakeAsync(() => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { onSearch: (c: string) => void }).onSearch('Lisbon');

    httpMock
      .expectOne((r) => r.url === 'https://api.test/v1/weather')
      .flush({
        name: 'Lisbon',
        dt: 1,
        timezone: 0,
        visibility: 10000,
        sys: { country: 'PT', sunrise: 0, sunset: 0 },
        weather: [{ id: 800, main: 'Clear', description: 'céu limpo', icon: '01d' }],
        main: {
          temp: 22,
          feels_like: 21,
          temp_min: 19,
          temp_max: 24,
          humidity: 60,
          pressure: 1013
        },
        wind: { speed: 3, deg: 90 },
        clouds: { all: 5 }
      });
    httpMock
      .expectOne((r) => r.url === 'https://api.test/v1/forecast')
      .flush({
        city: { name: 'Lisbon', country: 'PT', timezone: 0 },
        list: [
          {
            dt: 1,
            dt_txt: '2030-01-01 12:00:00',
            main: { temp: 20, temp_min: 18, temp_max: 22, humidity: 60 },
            weather: [{ id: 800, main: 'Clear', description: 'céu limpo', icon: '01d' }],
            wind: { speed: 2, deg: 90 }
          }
        ]
      });

    tick();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Lisbon');
    expect(localStorage.getItem('clima:history')).toContain('Lisbon');
  }));

  it('shows error message when API returns 404', fakeAsync(() => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { onSearch: (c: string) => void }).onSearch(
      'Atlantis'
    );

    httpMock
      .expectOne((r) => r.url === 'https://api.test/v1/weather')
      .flush({}, { status: 404, statusText: 'Not Found' });
    // forkJoin cancels the parallel /forecast call when /weather fails;
    // match it (if still open) without flushing to satisfy verify().
    const open = httpMock.match((r) => r.url === 'https://api.test/v1/forecast');
    expect(open.length).toBeLessThanOrEqual(1);

    tick();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Cidade não encontrada');
  }));
});
