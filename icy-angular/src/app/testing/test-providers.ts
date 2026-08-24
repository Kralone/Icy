import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {SwPush} from '@angular/service-worker';
import {EMPTY, NEVER, of} from 'rxjs';

import {WebSocketService} from '../core/services/websocket/websocket.service';

const swPushStub = {
  isEnabled: false,
  messages: EMPTY,
  notificationClicks: EMPTY,
  subscription: of(null),
};

const webSocketStub = {
  connectShipUpdate: () => undefined,
  connectFleetUpdate: () => undefined,
  connectEvent: () => undefined,
  connectNotifications: () => undefined,
  connectGoalUpdates: () => undefined,
  connectMiningSheets: () => undefined,
  disconnectFleetUpdate: () => undefined,
  disconnectEvent: () => undefined,
  disconnectGoalUpdates: () => undefined,
  disconnectMiningSheets: () => undefined,
  disconnect: () => undefined,
  getShipUpdates: () => NEVER,
  getFleetUpdate: () => NEVER,
  getEvent: () => NEVER,
  getNotifications: () => NEVER,
  getGoalUpdates: () => NEVER,
  getMiningSheetUpdates: () => NEVER,
  listenForUserShips: () => NEVER,
  listenForFleetUpdate: () => NEVER,
  listenForEvent: () => NEVER,
  listenForNotifications: () => NEVER,
  listenForGoalUpdates: () => NEVER,
  listenForMiningSheets: () => NEVER,
};

export const coreTestProviders = [
  provideHttpClient(),
  provideHttpClientTesting(),
  provideRouter([]),
  {provide: SwPush, useValue: swPushStub},
  {provide: WebSocketService, useValue: webSocketStub},
];
