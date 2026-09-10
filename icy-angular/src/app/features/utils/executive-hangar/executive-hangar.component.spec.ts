import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ExecutiveHangarComponent } from './executive-hangar.component';

describe('Executive hangar navigation', () => {
  let component: ExecutiveHangarComponent;
  let router: Router;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
    component = TestBed.runInInjectionContext(() => new ExecutiveHangarComponent(
      {} as any,
      {getConfig: () => of({data: {initialOpenTime: '2026-02-01T22:09:54.775Z'}})} as any,
      {hasToken: () => false} as any,
      router
    ));
  });
  afterEach(() => component.ngOnDestroy());

  it('opens the ships tab directly from a shared URL', async () => {
    await router.navigate([], {queryParams: {view: 'ships'}});
    component.ngOnInit();
    expect(component.selectedTab).toBe('ships');
    expect(component.scheduleRows.length).toBe(10);
  });

  it('keeps other query parameters when returning to the status tab', async () => {
    await router.navigate([], {queryParams: {view: 'ships', source: 'shared'}});
    component.ngOnInit();
    component.setTab('status');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(component.selectedTab).toBe('status');
    expect(router.url).not.toContain('view=');
    expect(router.url).toContain('source=shared');
  });
});
