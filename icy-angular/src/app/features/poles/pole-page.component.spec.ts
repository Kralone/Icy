import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { coreTestProviders } from '@testing/test-providers';
import { PolePageComponent } from './pole-page.component';

describe('PolePageComponent', () => {
  let fixture: ComponentFixture<PolePageComponent>;
  let http: HttpTestingController;

  async function open(slug: string): Promise<void> {
    const params = convertToParamMap({ pole: slug });
    await TestBed.configureTestingModule({
      imports: [PolePageComponent],
      providers: [...coreTestProviders, { provide: ActivatedRoute, useValue: { paramMap: of(params), snapshot: { paramMap: params } } }]
    }).compileComponents();
    fixture = TestBed.createComponent(PolePageComponent);
    http = TestBed.inject(HttpTestingController);
  }

  const request = () => http.expectOne(req => req.url.endsWith('/api/poles'));
  const text = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`).textContent.replace(/\s+/g, ' ').trim();

  it('shows the Industrie pole with its referents and its tools', async () => {
    await open('industrie');
    fixture.detectChanges();
    request().flush([{ key: 'INDUSTRIE', specialists: [{ id: '1', username: 'Ada' }] }, { key: 'MILITAIRE', specialists: [{ id: '2', username: 'Cy' }] }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Industrie');
    expect(text('pole-referents')).toContain('Ada');
    expect(text('pole-referents')).not.toContain('Cy');
    const tools = Array.from(fixture.nativeElement.querySelectorAll('a.pole-tool')) as HTMLAnchorElement[];
    expect(tools.map(tool => tool.getAttribute('href'))).toContain('/icy/outils/fiches-minage');
    expect(tools.length).toBe(5);
  });

  it('says so when a pole has no referent and no tool yet', async () => {
    await open('militaire');
    fixture.detectChanges();
    request().flush([]);
    fixture.detectChanges();
    expect(text('pole-referents')).toContain("Aucun Spécialiste n'est nommé");
    expect(text('pole-tools')).toContain("Ce pôle n'a pas encore d'outil dédié.");
  });

  it('offers to retry when the referents cannot be loaded', async () => {
    await open('industrie');
    fixture.detectChanges();
    request().flush('x', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="pole-referents-error"] button').click();
    request().flush([{ key: 'INDUSTRIE', specialists: [{ id: '1', username: 'Ada' }] }]);
    fixture.detectChanges();
    expect(text('pole-referents')).toContain('Ada');
  });

  it('sends an unknown pole back to the poles menu', async () => {
    await open('inconnu');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/icy/poles'], { replaceUrl: true });
    http.expectNone(req => req.url.endsWith('/api/poles'));
  });
});
