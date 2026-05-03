import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { forkJoin } from 'rxjs';

import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { WeatherCardComponent } from '../../shared/components/weather-card/weather-card.component';
import { ForecastCardComponent } from '../../shared/components/forecast-card/forecast-card.component';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { ErrorMessageComponent } from '../../shared/components/error-message/error-message.component';

import { WeatherService, WeatherApiError } from '../../core/services/weather.service';
import { CurrentWeather } from '../../core/models/weather.model';
import { ForecastDay } from '../../core/models/forecast.model';
import { TemperatureUnit } from '../../shared/pipes/temperature-unit.pipe';

const HISTORY_KEY = 'clima:history';
const UNIT_KEY = 'clima:unit';
const THEME_KEY = 'clima:theme';
const HISTORY_LIMIT = 5;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    SearchBarComponent,
    WeatherCardComponent,
    ForecastCardComponent,
    SpinnerComponent,
    ErrorMessageComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  private readonly weatherService = inject(WeatherService);

  protected readonly city = signal<string>('');
  protected readonly weather = signal<CurrentWeather | null>(null);
  protected readonly forecast = signal<ForecastDay[]>([]);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly unit = signal<TemperatureUnit>(this.readUnit());
  protected readonly theme = signal<'light' | 'dark'>(this.readTheme());
  protected readonly history = signal<string[]>(this.readHistory());

  protected readonly hasResult = computed(() => this.weather() !== null);
  protected readonly forecastSkeleton = Array.from({ length: 5 });

  constructor() {
    this.applyTheme(this.theme());

    effect(() => {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history()));
    });
    effect(() => {
      localStorage.setItem(UNIT_KEY, this.unit());
    });
    effect(() => {
      const t = this.theme();
      localStorage.setItem(THEME_KEY, t);
      this.applyTheme(t);
    });
  }

  protected onSearch(city: string): void {
    if (!city || city.length < 2) return;
    this.city.set(city);
    this.fetch(city);
  }

  protected onSelectHistory(city: string): void {
    this.onSearch(city);
  }

  protected onClearHistory(): void {
    this.history.set([]);
  }

  protected toggleUnit(): void {
    this.unit.update((u) => (u === 'celsius' ? 'fahrenheit' : 'celsius'));
  }

  protected toggleTheme(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  protected retry(): void {
    if (this.city()) this.fetch(this.city());
  }

  private fetch(city: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      current: this.weatherService.getCurrentWeather(city),
      forecast: this.weatherService.getForecast(city)
    }).subscribe({
      next: ({ current, forecast }) => {
        this.weather.set(current);
        this.forecast.set(forecast);
        this.isLoading.set(false);
        this.pushHistory(current.city);
      },
      error: (err: WeatherApiError | Error) => {
        const message =
          err instanceof WeatherApiError
            ? err.message
            : 'Ocorreu um erro inesperado. Tente novamente.';
        this.error.set(message);
        this.weather.set(null);
        this.forecast.set([]);
        this.isLoading.set(false);
      }
    });
  }

  private pushHistory(city: string): void {
    this.history.update((current) => {
      const next = [city, ...current.filter((c) => c.toLowerCase() !== city.toLowerCase())];
      return next.slice(0, HISTORY_LIMIT);
    });
  }

  private readHistory(): string[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }

  private readUnit(): TemperatureUnit {
    const v = localStorage.getItem(UNIT_KEY);
    return v === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  }

  private readTheme(): 'light' | 'dark' {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
  }
}
