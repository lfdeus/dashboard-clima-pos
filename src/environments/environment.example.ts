/**
 * Template de configuração de ambiente.
 *
 * Copie este arquivo para `environment.ts` (mesmo diretório) e preencha
 * sua API key do OpenWeatherMap. O arquivo `environment.ts` está no
 * `.gitignore` e nunca deve ser commitado.
 *
 * Como obter a chave:
 *   1. Crie uma conta gratuita em https://home.openweathermap.org/users/sign_up
 *   2. Acesse https://home.openweathermap.org/api_keys
 *   3. Copie a chave default (a ativação pode levar alguns minutos)
 */
export const environment = {
  production: false,
  openWeather: {
    apiKey: 'YOUR_OPENWEATHERMAP_API_KEY_HERE',
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    iconUrl: 'https://openweathermap.org/img/wn',
    lang: 'pt_br',
    units: 'metric' as 'metric' | 'imperial' | 'standard'
  }
};
