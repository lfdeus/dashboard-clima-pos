import {
  ApplicationConfig,
  provideZoneChangeDetection,
  provideExperimentalZonelessChangeDetection
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { API_CONFIG } from './core/tokens/api-config.token';
import { apiKeyInterceptor } from './core/interceptors/api-key.interceptor';

void provideExperimentalZonelessChangeDetection;

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([apiKeyInterceptor])),
    { provide: API_CONFIG, useValue: environment.openWeather }
  ]
};
