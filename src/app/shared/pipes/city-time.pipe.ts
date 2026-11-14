import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formata um instante como `HH:mm` no horário local da cidade consultada.
 *
 * A OpenWeatherMap devolve os instantes em epoch (segundos, UTC) e o fuso da cidade no campo
 * `timezone` (deslocamento em segundos em relação ao UTC). O resultado não depende do fuso de
 * quem está vendo a tela: o instante é deslocado e lido em UTC, sem passar pelo fuso do navegador.
 */
@Pipe({ name: 'cityTime', standalone: true })
export class CityTimePipe implements PipeTransform {
  transform(
    epochSeconds: number | null | undefined,
    utcOffsetSeconds: number | null | undefined
  ): string {
    if (!Number.isFinite(epochSeconds) || !Number.isFinite(utcOffsetSeconds)) {
      return '--:--';
    }
    const shifted = new Date(((epochSeconds as number) + (utcOffsetSeconds as number)) * 1000);
    const hours = String(shifted.getUTCHours()).padStart(2, '0');
    const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
