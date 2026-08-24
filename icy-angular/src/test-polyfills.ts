// sockjs-client still expects the Node-style `global` alias in browser tests.
(globalThis as any).global = globalThis;

if (typeof globalThis.Notification === 'undefined') {
  class NotificationMock {
    static readonly permission: NotificationPermission = 'default';

    static requestPermission(): Promise<NotificationPermission> {
      return Promise.resolve('default');
    }

    close(): void {}
  }

  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: NotificationMock
  });
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverMock implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly scrollMargin = '0px';
    readonly thresholds: readonly number[] = [];

    disconnect(): void {}
    observe(): void {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
    unobserve(): void {}
  }

  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    value: IntersectionObserverMock
  });
}
