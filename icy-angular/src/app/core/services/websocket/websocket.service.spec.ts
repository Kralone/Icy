import { NgZone } from '@angular/core';
import { StompSubscription } from '@stomp/stompjs';

import { AuthService } from '../auth/auth.service';
import { WebSocketService } from './websocket.service';

describe('WebSocketService subscription lifecycle', () => {
  let service: WebSocketService;
  let fakeClient: {
    active: boolean;
    connected: boolean;
    activate: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };
  let subscriptions: StompSubscription[];

  beforeEach(() => {
    subscriptions = [];
    fakeClient = {
      active: true,
      connected: true,
      activate: vi.fn(),
      deactivate: vi.fn(),
      subscribe: vi.fn(() => {
        const subscription = {
          id: `subscription-${subscriptions.length}`,
          unsubscribe: vi.fn()
        } as unknown as StompSubscription;
        subscriptions.push(subscription);
        return subscription;
      })
    };

    service = new WebSocketService(
      new NgZone({ enableLongStackTrace: false }),
      { getToken: () => 'test-token' } as AuthService
    );
    (service as any).stompClient = fakeClient;
  });

  it('sends the current access token in the STOMP CONNECT frame', async () => {
    const getToken = vi.fn(() => 'current-access-token');
    const configuredService = new WebSocketService(
      new NgZone({ enableLongStackTrace: false }),
      { getToken } as unknown as AuthService
    );
    const configuredClient = (configuredService as any).stompClient;

    await configuredClient.beforeConnect();

    expect(getToken).toHaveBeenCalledTimes(1);
    expect(configuredClient.connectHeaders).toEqual({
      Authorization: 'Bearer current-access-token'
    });
  });

  it('shares a fleet topic subscription until its last listener disconnects', () => {
    service.connectFleetUpdate();
    service.connectFleetUpdate();

    expect(fakeClient.subscribe).toHaveBeenCalledTimes(1);
    expect(fakeClient.subscribe).toHaveBeenCalledWith('/topic/fleet/update', expect.any(Function));

    service.disconnectFleetUpdate();
    expect(subscriptions[0].unsubscribe).not.toHaveBeenCalled();

    service.disconnectFleetUpdate();
    expect(subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not create a queued subscription after its listener has left', () => {
    fakeClient.active = false;
    fakeClient.connected = false;

    service.connectEvent();
    service.disconnectEvent();
    fakeClient.connected = true;
    (service as any).syncSubscriptions();

    expect(fakeClient.activate).toHaveBeenCalledTimes(1);
    expect(fakeClient.subscribe).not.toHaveBeenCalled();
  });

  it('recreates desired subscriptions once after a STOMP reconnect', () => {
    service.connectGoalUpdates();
    expect(fakeClient.subscribe).toHaveBeenCalledTimes(1);

    (service as any).clearSubscriptionHandles();
    (service as any).syncSubscriptions();
    (service as any).syncSubscriptions();

    expect(fakeClient.subscribe).toHaveBeenCalledTimes(2);
    expect(fakeClient.subscribe).toHaveBeenLastCalledWith('/topic/goals', expect.any(Function));
  });

  it('keeps user ship topics independent and unsubscribes the requested user', () => {
    service.connectShipUpdate('alice');
    service.connectShipUpdate('bob');

    expect(fakeClient.subscribe).toHaveBeenCalledTimes(2);
    service.disconnectShipUpdate('alice');

    expect(subscriptions[0].unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscriptions[1].unsubscribe).not.toHaveBeenCalled();
  });

  it('delivers ship messages only to listeners for the matching user', () => {
    const aliceMessages: string[] = [];
    const bobMessages: string[] = [];
    service.listenForUserShips('alice').subscribe(message => aliceMessages.push(message));
    service.listenForUserShips('bob').subscribe(message => bobMessages.push(message));

    service.connectShipUpdate('alice');
    service.connectShipUpdate('bob');
    const aliceCallback = fakeClient.subscribe.mock.calls[0][1] as (message: { body: string }) => void;
    const bobCallback = fakeClient.subscribe.mock.calls[1][1] as (message: { body: string }) => void;

    aliceCallback({ body: 'alice-ship' });
    bobCallback({ body: 'bob-ship' });

    expect(aliceMessages).toEqual(['alice-ship']);
    expect(bobMessages).toEqual(['bob-ship']);
  });
});
