import { TemperatureUnitPipe } from './temperature-unit.pipe';

describe('TemperatureUnitPipe', () => {
  const pipe = new TemperatureUnitPipe();

  it('formats Celsius without conversion', () => {
    expect(pipe.transform(20)).toBe('20°C');
  });

  it('converts Celsius to Fahrenheit correctly', () => {
    expect(pipe.transform(0, 'fahrenheit')).toBe('32°F');
    expect(pipe.transform(100, 'fahrenheit')).toBe('212°F');
  });

  it('respects digits parameter', () => {
    expect(pipe.transform(20.456, 'celsius', 1)).toBe('20.5°C');
  });

  it('returns placeholder for null/undefined/NaN', () => {
    expect(pipe.transform(null)).toBe('--');
    expect(pipe.transform(undefined)).toBe('--');
    expect(pipe.transform(Number.NaN)).toBe('--');
  });
});
