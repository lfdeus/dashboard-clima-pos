import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { CurrentWeather } from '../../../core/models/weather.model';
import { WeatherService } from '../../../core/services/weather.service';
import { TemperatureUnit, TemperatureUnitPipe } from '../../pipes/temperature-unit.pipe';

@Component({
  selector: 'app-weather-card',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TemperatureUnitPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let w = weather();
    @if (w) {
      <article class="card overflow-hidden p-6 sm:p-8" aria-live="polite">
        <header class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 class="text-2xl font-bold tracking-tight">
              {{ w.city }}<span class="text-slate-500">, {{ w.country }}</span>
            </h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Atualizado em {{ w.observedAt * 1000 | date: 'dd/MM/yyyy HH:mm' }}
            </p>
          </div>
          <img
            [src]="iconUrl()"
            [alt]="w.description"
            width="96"
            height="96"
            class="-my-2 h-24 w-24"
            loading="lazy"
          />
        </header>

        <div class="mt-4 flex items-baseline gap-3">
          <span class="text-6xl font-bold tabular-nums">
            {{ w.temperature | temperatureUnit: unit() : 0 }}
          </span>
          <span class="text-base capitalize text-slate-500 dark:text-slate-300">
            {{ w.description }}
          </span>
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sensação térmica
          <strong>{{ w.feelsLike | temperatureUnit: unit() : 0 }}</strong>
          · Mín
          <strong>{{ w.tempMin | temperatureUnit: unit() : 0 }}</strong>
          · Máx
          <strong>{{ w.tempMax | temperatureUnit: unit() : 0 }}</strong>
        </p>

        <dl
          class="mt-6 grid grid-cols-2 gap-4 border-t border-slate-200 pt-6 dark:border-slate-700 sm:grid-cols-4"
        >
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500">Umidade</dt>
            <dd class="mt-0.5 text-lg font-semibold">{{ w.humidity }}%</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500">Vento</dt>
            <dd class="mt-0.5 text-lg font-semibold">{{ w.windSpeed | number: '1.0-1' }} m/s</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500">Pressão</dt>
            <dd class="mt-0.5 text-lg font-semibold">{{ w.pressure }} hPa</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500">Nuvens</dt>
            <dd class="mt-0.5 text-lg font-semibold">{{ w.cloudiness }}%</dd>
          </div>
        </dl>
      </article>
    }
  `
})
export class WeatherCardComponent {
  private readonly weatherService = inject(WeatherService);

  readonly weather = input.required<CurrentWeather | null>();
  readonly unit = input<TemperatureUnit>('celsius');

  protected readonly iconUrl = computed(() => {
    const w = this.weather();
    return w ? this.weatherService.iconUrl(w.iconCode, '4x') : '';
  });
}
