import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { HotToastService } from '@ngxpert/hot-toast';
import { of, throwError } from 'rxjs';
import { EventService } from '../../../../core/services/event/event.service';
import { EventType } from '../../../../model/event-type.model';
import { EventTypeManagerComponent } from './event-type-manager.component';

const combat: EventType = { name: 'Combat', textColor: '#ffffff', backgroundColor: '#b91c1c', imageUrl: '', archived: false, usageCount: 3 };
const minage: EventType = { name: 'Minage', textColor: 'black', backgroundColor: 'white', imageUrl: '', archived: false, usageCount: 0 };
const ancien: EventType = { name: 'Ancien', textColor: '#ffffff', backgroundColor: '#334155', imageUrl: '', archived: true, usageCount: 1 };

describe('EventTypeManagerComponent', () => {
  let fixture: ComponentFixture<EventTypeManagerComponent>;
  let component: EventTypeManagerComponent;
  let events: Record<string, ReturnType<typeof vi.fn>>;
  let toast: Record<string, ReturnType<typeof vi.fn>>;
  let changed: () => void;

  const el = () => fixture.nativeElement as HTMLElement;
  const buttons = (label: string) => Array.from(el().querySelectorAll('button')).filter(b => b.textContent!.trim() === label) as HTMLButtonElement[];

  beforeEach(async () => {
    events = {
      createType: vi.fn(() => of(combat)),
      updateEventType: vi.fn(() => of(combat)),
      deleteType: vi.fn(() => of(undefined)),
      setTypeArchived: vi.fn(() => of(combat)),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [EventTypeManagerComponent],
      providers: [{ provide: EventService, useValue: events }, { provide: HotToastService, useValue: toast }],
    }).compileComponents();
    fixture = TestBed.createComponent(EventTypeManagerComponent);
    component = fixture.componentInstance;
    changed = vi.fn() as unknown as () => void;
    component.changed.subscribe(() => changed());
    fixture.componentRef.setInput('types', [combat, minage, ancien]);
    fixture.detectChanges();
  });

  it('offers deletion only for unused types and archiving for used ones', () => {
    const cards = Array.from(el().querySelectorAll('[data-testid="event-type-list"] .etm-card'));
    expect(cards.map(card => card.querySelector('.etm-chip')!.textContent!.trim())).toEqual(['Combat', 'Minage']);
    expect(cards[0].textContent).toContain('3 activités');
    expect(cards[0].textContent).toContain('Archiver');
    expect(cards[0].textContent).not.toContain('Supprimer');
    expect(cards[1].textContent).toContain('Supprimer');
    expect(el().textContent).toContain('Archivés (1)');
  });

  it('filters types by name, ignoring accents and case, including archived ones', () => {
    const search = el().querySelector('[data-testid="event-type-search"]') as HTMLInputElement;
    search.value = 'ANCIÉN';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-testid="event-type-list"] .etm-card').length).toBe(0);
    expect(el().textContent).toContain('Aucun type actif ne correspond');
    expect(Array.from(el().querySelectorAll('[data-testid="event-type-archived"] .etm-chip')).map(c => c.textContent!.trim())).toEqual(['Ancien']);

    search.value = 'min';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(Array.from(el().querySelectorAll('[data-testid="event-type-list"] .etm-chip')).map(c => c.textContent!.trim())).toEqual(['Minage']);
  });

  it('asks for confirmation before deleting, then reloads', () => {
    buttons('Supprimer')[0].click();
    fixture.detectChanges();
    expect(events['deleteType']).not.toHaveBeenCalled();
    expect(el().textContent).toContain('Supprimer ?');
    buttons('Supprimer')[0].click();
    expect(events['deleteType']).toHaveBeenCalledWith('Minage');
    expect(changed).toHaveBeenCalled();
  });

  it('shows the server message when deletion is refused', () => {
    events['deleteType'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: '« Minage » est utilisé par 1 activité.' } })));
    component.delete(minage);
    expect(toast['error']).toHaveBeenCalledWith('« Minage » est utilisé par 1 activité.');
    expect(changed).toHaveBeenCalled();
  });

  it('archives a used type and restores an archived one', () => {
    buttons('Archiver')[0].click();
    expect(events['setTypeArchived']).toHaveBeenCalledWith('Combat', true);
    component.showArchived.set(true);
    fixture.detectChanges();
    buttons('Restaurer')[0].click();
    expect(events['setTypeArchived']).toHaveBeenCalledWith('Ancien', false);
  });

  it('creates a type with normalized colors', () => {
    component.update('name', '  Exploration ');
    component.update('backgroundColor', '#0E7490');
    component.update('imageUrl', '');
    component.submit();
    expect(events['createType']).toHaveBeenCalledWith({ name: 'Exploration', textColor: '#e3f4fb', backgroundColor: '#0e7490', imageUrl: null });
    expect(changed).toHaveBeenCalled();
  });

  it('refuses an empty or duplicate name', () => {
    component.submit();
    expect(events['createType']).not.toHaveBeenCalled();
    component.update('name', 'combat');
    component.submit();
    fixture.detectChanges();
    expect(events['createType']).not.toHaveBeenCalled();
    expect(el().textContent).toContain('Un type porte déjà ce nom.');
  });

  it('edits a legacy type with named colors and renames it under its original name', () => {
    component.startEdit(minage);
    expect(component.form().backgroundColor).toBe('#27647c');
    component.update('name', 'Minage de surface');
    component.submit();
    expect(events['updateEventType']).toHaveBeenCalledWith('Minage', expect.objectContaining({ name: 'Minage de surface' }));
  });

  it('warns when the label is hard to read and applies the suggestion', () => {
    component.update('backgroundColor', '#fde68a');
    component.update('textColor', '#ffffff');
    fixture.detectChanges();
    expect(el().textContent).toContain('peu lisible');
    buttons('Utiliser du noir')[0].click();
    expect(component.form().textColor).toBe('#0b1220');
  });
});
