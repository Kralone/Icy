import { TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { EventDetailsModalComponent } from './event-details-modal.component';

registerLocaleData(localeFr);

describe('EventDetailsModalComponent', () => {
  it('provides a labelled dialog and closes with Escape', async () => {
    await TestBed.configureTestingModule({imports: [EventDetailsModalComponent]}).compileComponents();
    const fixture = TestBed.createComponent(EventDetailsModalComponent);
    fixture.componentRef.setInput('selectedEvent', {title: 'Sortie minage'});
    let closed = false;
    fixture.componentInstance.requestClose.subscribe(() => closed = true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]').getAttribute('aria-labelledby')).toBe('event-dialog-title');
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    expect(closed).toBe(true);
    fixture.destroy();
  });

  it('disables responses for a completed event and indicates the current response', async () => {
    await TestBed.configureTestingModule({imports: [EventDetailsModalComponent]}).compileComponents();
    const fixture = TestBed.createComponent(EventDetailsModalComponent);
    fixture.componentRef.setInput('selectedEvent', {title: 'Sortie terminée', finished: true});
    fixture.componentRef.setInput('selectedParticipationStatus', 1);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.participation-actions button');
    expect(Array.from(buttons).every(button => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    fixture.destroy();
  });
});
