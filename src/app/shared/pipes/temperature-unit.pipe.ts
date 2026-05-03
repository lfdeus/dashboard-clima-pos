import { Pipe, PipeTransform } from '@angular/core';

export type TemperatureUnit = 'celsius' | 'fahrenheit';

@Pipe({ name: 'temperatureUnit', standalone: true })
export class TemperatureUnitPipe implements PipeTransform {
  transform(
    value: number | null | undefined,
    unit: TemperatureUnit = 'celsius',
    digits = 0
  ): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '--';
    }
    const converted = unit === 'fahrenheit' ? (value * 9) / 5 + 32 : value;
    const symbol = unit === 'fahrenheit' ? '°F' : '°C';
    return `${converted.toFixed(digits)}${symbol}`;
  }
}
