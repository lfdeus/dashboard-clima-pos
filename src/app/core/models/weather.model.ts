/** Modelo normalizado da resposta atual do OpenWeatherMap. */
export interface CurrentWeather {
  city: string;
  country: string;
  description: string;
  iconCode: string;
  temperature: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDeg: number;
  cloudiness: number;
  visibility: number;
  sunrise: number;
  sunset: number;
  timezone: number;
  observedAt: number;
}

/** Resposta bruta da API `/weather`. */
export interface OpenWeatherCurrentResponse {
  name: string;
  dt: number;
  timezone: number;
  visibility: number;
  sys: { country: string; sunrise: number; sunset: number };
  weather: { id: number; main: string; description: string; icon: string }[];
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
    pressure: number;
  };
  wind: { speed: number; deg: number };
  clouds: { all: number };
}
