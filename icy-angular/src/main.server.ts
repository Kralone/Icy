import { provideZoneChangeDetection } from '@angular/core';
import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

registerLocaleData(localeFr);

const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(
    AppComponent,
    {
      ...config,
      providers: [provideZoneChangeDetection(), ...config.providers],
    },
    context,
  );

export default bootstrap;
