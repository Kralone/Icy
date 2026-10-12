import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OperationDraftsComponent } from './operation-drafts.component';
import { EventService } from '../../../core/services/event/event.service';

describe('OperationDraftsComponent', () => {
  let fixture: ComponentFixture<OperationDraftsComponent>;
  let getOperationDrafts: ReturnType<typeof vi.fn>;

  async function render(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [OperationDraftsComponent],
      providers: [provideRouter([]), { provide: EventService, useValue: { getOperationDrafts } }]
    }).compileComponents();
    fixture = TestBed.createComponent(OperationDraftsComponent);
    fixture.detectChanges();
  }

  it('lists each draft with its title, dates and a link back to the editor', async () => {
    getOperationDrafts = vi.fn(() => of([
      { id: 'op-1', title: 'Escorte du convoi', type: 'Combat', startDateTime: '2026-10-20T20:00:00', endDateTime: '2026-10-20T23:00:00', updatedAt: '2026-10-12T09:30:00Z' }
    ]));
    await render();

    const card: HTMLElement = fixture.nativeElement.querySelector('.draft-card');
    expect(card.querySelector('h2')?.textContent).toContain('Escorte du convoi');
    expect(card.textContent).toContain('Date prévue');
    expect(card.textContent).toContain('2026');
    expect(card.textContent).toContain('Dernière modification');
    const resume = card.querySelector('a.resume') as HTMLAnchorElement;
    expect(resume.textContent).toContain('Reprendre l’édition');
    expect(resume.getAttribute('href')).toBe('/icy/operations/op-1/edit');
  });

  it('says so when there is no draft', async () => {
    getOperationDrafts = vi.fn(() => of([]));
    await render();

    expect(fixture.nativeElement.querySelector('.empty').textContent).toContain('Aucun brouillon en cours');
  });

  it('offers a retry when the list cannot be loaded', async () => {
    getOperationDrafts = vi.fn().mockReturnValueOnce(throwError(() => ({ status: 0 }))).mockReturnValue(of([]));
    await render();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Impossible de charger les brouillons.');
    fixture.nativeElement.querySelector('[role="alert"] button').click();
    fixture.detectChanges();

    expect(getOperationDrafts).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
});
