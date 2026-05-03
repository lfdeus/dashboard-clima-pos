import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  iconUrl: string;
  lang: string;
  units: 'metric' | 'imperial' | 'standard';
}

/**
 * Token de configuração da API. Injetado via `app.config.ts` a partir
 * do `environment`, isolando o service de qualquer detalhe de build
 * e facilitando override em testes.
 */
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');
