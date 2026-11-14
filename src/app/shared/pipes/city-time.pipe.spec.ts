import { CityTimePipe } from './city-time.pipe';

const epoch = (isoUtc: string): number => Date.parse(isoUtc) / 1000;

describe('CityTimePipe', () => {
  const pipe = new CityTimePipe();

  it('shifts the instant by the city offset, west of UTC', () => {
    // São Paulo, UTC-3
    expect(pipe.transform(epoch('2030-01-01T08:24:00Z'), -10800)).toBe('05:24');
  });

  it('shifts the instant by the city offset, east of UTC, across midnight', () => {
    // Tóquio, UTC+9: 21:51 UTC do dia 1 já é 06:51 do dia 2
    expect(pipe.transform(epoch('2030-01-01T21:51:00Z'), 32400)).toBe('06:51');
  });

  it('supports offsets that are not whole hours', () => {
    // Katmandu, UTC+5:45
    expect(pipe.transform(epoch('2030-01-01T01:10:00Z'), 20700)).toBe('06:55');
  });

  it('keeps the UTC time when the city offset is zero', () => {
    expect(pipe.transform(epoch('2030-01-01T07:55:00Z'), 0)).toBe('07:55');
  });

  it('returns a placeholder when the instant or the offset is missing', () => {
    expect(pipe.transform(null, 0)).toBe('--:--');
    expect(pipe.transform(undefined, 0)).toBe('--:--');
    expect(pipe.transform(Number.NaN, 0)).toBe('--:--');
    expect(pipe.transform(epoch('2030-01-01T07:55:00Z'), undefined)).toBe('--:--');
  });
});
