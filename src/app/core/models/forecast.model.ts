/** Previsão diária consolidada (um item por dia). */
export interface ForecastDay {
  date: string;
  timestamp: number;
  tempMin: number;
  tempMax: number;
  iconCode: string;
  description: string;
  humidity: number;
  windSpeed: number;
}

/** Resposta bruta da API `/forecast` (intervalos de 3 horas). */
export interface OpenWeatherForecastResponse {
  city: { name: string; country: string; timezone: number };
  list: {
    dt: number;
    dt_txt: string;
    main: {
      temp: number;
      temp_min: number;
      temp_max: number;
      humidity: number;
    };
    weather: { id: number; main: string; description: string; icon: string }[];
    wind: { speed: number; deg: number };
  }[];
}
