import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { coreTestProviders } from '@testing/test-providers';
import { PolesMenuComponent } from './poles-menu.component';

describe('PolesMenuComponent', () => {
  let fixture: ComponentFixture<PolesMenuComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PolesMenuComponent], providers: coreTestProviders }).compileComponents();
    fixture = TestBed.createComponent(PolesMenuComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  const request = () => http.expectOne(req => req.url.endsWith('/api/poles'));
  const referents = (slug: string) =>
    fixture.nativeElement.querySelector(`[data-testid="pole-card-${slug}"] [data-testid="pole-card-referents"]`).textContent.replace(/\s+/g, ' ').trim();

  it('lists the three poles with a link to their page', () => {
    request().flush([]);
    fixture.detectChanges();
    const links = Array.from(fixture.nativeElement.querySelectorAll('a.pole-card')) as HTMLAnchorElement[];
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/icy/poles/logistique', '/icy/poles/militaire', '/icy/poles/industrie']);
    expect(links.map(link => link.querySelector('h2')?.textContent)).toEqual(['Logistique', 'Militaire', 'Industrie']);
  });

  it('shows the referents of each pole, or says there is none', () => {
    request().flush([
      { key: 'INDUSTRIE', specialists: [{ id: '1', username: 'Ada' }, { id: '2', username: 'Bob' }] },
      { key: 'MILITAIRE', specialists: [{ id: '3', username: 'Cy' }] },
      { key: 'LOGISTIQUE', specialists: [] }
    ]);
    fixture.detectChanges();
    expect(referents('industrie')).toBe('Référents : Ada, Bob');
    expect(referents('militaire')).toBe('Référent : Cy');
    expect(referents('logistique')).toBe("Aucun référent pour l'instant");
  });

  it('says the referents are unavailable when loading fails', () => {
    request().flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(referents('industrie')).toBe('Référents indisponibles');
  });
});
