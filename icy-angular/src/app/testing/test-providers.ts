import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {SwPush} from '@angular/service-worker';
import {EMPTY, of} from 'rxjs';

const swPushStub = {
  isEnabled: false,
  messages: EMPTY,
  notificationClicks: EMPTY,
  subscription: of(null),
};

export const coreTestProviders = [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter([]),
  {provide: SwPush, useValue: swPushStub},
];
