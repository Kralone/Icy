import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { DataMenuComponent } from './data-menu.component';

describe('DataMenuComponent catalogue shortcuts', () => {
  it('redirects an old ship-management bookmark to the filtered catalogue', async () => {
    const admin = routes.find(route => route.path === 'icy')?.children?.find(route => route.path === 'admin');
    const legacy = admin?.children?.find(route => route.path === 'ships');
    expect(legacy?.redirectTo).toBeTruthy();
    await TestBed.configureTestingModule({providers: [provideRouter([
      {path: 'icy/admin', children: [legacy!, {path: 'catalog', component: DataMenuComponent}]}
    ])]}).compileComponents();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/icy/admin/ships');
    expect(TestBed.inject(Router).url).toBe('/icy/admin/catalog?family=SHIP&catalogGroup=STANDARD');
  });

  it('links families directly to the internal catalogue and retains images and CIG Watch', async () => {
    await TestBed.configureTestingModule({imports: [DataMenuComponent], providers: [provideRouter([])]}).compileComponents();
    const fixture = TestBed.createComponent(DataMenuComponent);
    fixture.detectChanges();
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.some(link => link.getAttribute('href') === '/icy/admin/catalog?family=MOON&catalogGroup=STANDARD')).toBe(true);
    expect(links.some(link => link.getAttribute('href') === '/icy/admin/images')).toBe(true);
    expect(links.some(link => link.getAttribute('href') === '/icy/admin/cig-watch')).toBe(true);
    expect(links.some(link => link.getAttribute('href') === '/icy/admin/ships')).toBe(false);
    expect(links.some(link => link.textContent?.includes('Catalogue externe'))).toBe(false);
  });
});
