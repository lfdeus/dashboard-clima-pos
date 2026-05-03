import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ForecastDay } from '../../../core/models/forecast.model';
import { WeatherService } from '../../../core/services/weather.service';
import { TemperatureUnit, TemperatureUnitPipe } from '../../pipes/temperature-unit.pipe';

@Component({
  selector: 'app-forecast-card',
  standalone: true,
  imports: [DatePipe, TemperatureUnitPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let d = day();
    <article
      class="card flex min-w-[140px] flex-col items-center gap-1 p-4 text-center"
      [attr.aria-label]="'Previsão para ' + d.date"
    >
      <p class="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {{ d.timestamp * 1000 | date: 'EEE' }}
      </p>
      <p class="text-xs text-slate-400">{{ d.timestamp * 1000 | date: 'dd/MM' }}</p>
      <img
        [src]="iconUrl()"
        [alt]="d.description"
        width="64"
        height="64"
        class="my-1 h-16 w-16"
        loading="lazy"
      />
      <p class="text-base font-semibold tabular-nums">
        {{ d.tempMax | temperatureUnit: unit() : 0 }}
      </p>
      <p class="text-sm tabular-nums text-slate-500 dark:text-slate-400">
        {{ d.tempMin | temperatureUnit: unit() : 0 }}
      </p>
      <p class="mt-1 line-clamp-2 text-xs capitalize text-slate-500 dark:text-slate-400">
        {{ d.description }}
      </p>
    </article>
  `
})
export class ForecastCardComponent {
  private readonly weatherService = inject(WeatherService);

  readonly day = input.required<ForecastDay>();
  readonly unit = input<TemperatureUnit>('celsius');

  protected readonly iconUrl = computed(() => this.weatherService.iconUrl(this.day().iconCode));
}
