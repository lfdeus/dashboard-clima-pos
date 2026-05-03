import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_CONFIG } from '../tokens/api-config.token';

/**
 * Anexa `appid`, `units` e `lang` em todas as requisições para a API
 * do OpenWeatherMap. Mantém o service livre desses detalhes.
 */
export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(API_CONFIG);

  if (!req.url.startsWith(config.baseUrl)) {
    return next(req);
  }

  const cloned = req.clone({
    setParams: {
      appid: config.apiKey,
      units: config.units,
      lang: config.lang
    }
  });
  return next(cloned);
};
