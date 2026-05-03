import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { API_CONFIG } from '../tokens/api-config.token';
import { CurrentWeather, OpenWeatherCurrentResponse } from '../models/weather.model';
import { ForecastDay, OpenWeatherForecastResponse } from '../models/forecast.model';

export class WeatherApiError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'NETWORK' | 'UNAUTHORIZED' | 'UNKNOWN',
    message: string
  ) {
    super(message);
    this.name = 'WeatherApiError';
  }
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  getCurrentWeather(city: string): Observable<CurrentWeather> {
    const url = `${this.config.baseUrl}/weather`;
    return this.http.get<OpenWeatherCurrentResponse>(url, { params: { q: city } }).pipe(
      map((res) => this.mapCurrent(res)),
      catchError(this.mapError)
    );
  }

  getForecast(city: string): Observable<ForecastDay[]> {
    const url = `${this.config.baseUrl}/forecast`;
    return this.http.get<OpenWeatherForecastResponse>(url, { params: { q: city } }).pipe(
      map((res) => this.mapForecast(res)),
      catchError(this.mapError)
    );
  }

  iconUrl(code: string, size: '2x' | '4x' = '2x'): string {
    return `${this.config.iconUrl}/${code}@${size}.png`;
  }

  private mapCurrent(res: OpenWeatherCurrentResponse): CurrentWeather {
    const w = res.weather[0];
    return {
      city: res.name,
      country: res.sys.country,
      description: w?.description ?? '',
      iconCode: w?.icon ?? '01d',
      temperature: res.main.temp,
      feelsLike: res.main.feels_like,
      tempMin: res.main.temp_min,
      tempMax: res.main.temp_max,
      humidity: res.main.humidity,
      pressure: res.main.pressure,
      windSpeed: res.wind.speed,
      windDeg: res.wind.deg,
      cloudiness: res.clouds.all,
      visibility: res.visibility,
      sunrise: res.sys.sunrise,
      sunset: res.sys.sunset,
      timezone: res.timezone,
      observedAt: res.dt
    };
  }

  private mapForecast(res: OpenWeatherForecastResponse): ForecastDay[] {
    const groups = new Map<string, OpenWeatherForecastResponse['list']>();
    for (const item of res.list) {
      const day = item.dt_txt.slice(0, 10);
      const bucket = groups.get(day) ?? [];
      bucket.push(item);
      groups.set(day, bucket);
    }

    const days: ForecastDay[] = [];
    for (const [date, bucket] of groups) {
      const temps = bucket.map((b) => b.main.temp);
      const tempMin = Math.min(...bucket.map((b) => b.main.temp_min));
      const tempMax = Math.max(...bucket.map((b) => b.main.temp_max));
      const noon = bucket.find((b) => b.dt_txt.endsWith('12:00:00')) ?? bucket[0];
      const humidity = Math.round(bucket.reduce((s, b) => s + b.main.humidity, 0) / bucket.length);
      const wind = bucket.reduce((s, b) => s + b.wind.speed, 0) / bucket.length;
      days.push({
        date,
        timestamp: noon.dt,
        tempMin: Number.isFinite(tempMin) ? tempMin : Math.min(...temps),
        tempMax: Number.isFinite(tempMax) ? tempMax : Math.max(...temps),
        iconCode: noon.weather[0]?.icon ?? '01d',
        description: noon.weather[0]?.description ?? '',
        humidity,
        windSpeed: wind
      });
    }

    return days.slice(0, 5);
  }

  private mapError = (err: HttpErrorResponse): Observable<never> => {
    if (err.status === 0) {
      return throwError(
        () => new WeatherApiError('NETWORK', 'Sem conexão com a API. Verifique sua internet.')
      );
    }
    if (err.status === 401) {
      return throwError(
        () =>
          new WeatherApiError('UNAUTHORIZED', 'Chave de API inválida. Confira o environment.ts.')
      );
    }
    if (err.status === 404) {
      return throwError(() => new WeatherApiError('NOT_FOUND', 'Cidade não encontrada.'));
    }
    return throwError(
      () => new WeatherApiError('UNKNOWN', 'Falha ao consultar o serviço de clima.')
    );
  };
}
