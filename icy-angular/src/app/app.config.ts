import { ApplicationConfig, isDevMode, LOCALE_ID } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';

import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpAuthInterceptor } from './core/interceptors/http.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

const enableServiceWorker = () => {
  if (!isDevMode()) return true;
  return typeof window !== 'undefined' && window.location.hostname === 'localhost';
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withViewTransitions(),
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'top'
      })
    ),
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpAuthInterceptor,
      multi: true
    },
    {
      provide: LOCALE_ID,
      useValue: 'fr-FR'
    },
    provideAnimations(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: enableServiceWorker(),
      registrationStrategy: 'registerWhenStable:30000'
    }), provideClientHydration(withEventReplay())
  ]
};
