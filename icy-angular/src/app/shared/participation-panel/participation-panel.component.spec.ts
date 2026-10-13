import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ParticipationPanelComponent } from './participation-panel.component';

describe('ParticipationPanelComponent', () => {
  let fixture: ComponentFixture<ParticipationPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ParticipationPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(ParticipationPanelComponent);
    fixture.componentRef.setInput('participationsByStatus', {
      confirmed: [{ status: 1, user: { id: 'a', username: 'Alice' } }, { status: 1, user: { id: 'b', username: 'Bob' } }],
      maybe: [{ status: 0, user: { id: 'c', username: 'Chloé' } }],
      refused: []
    });
    fixture.componentRef.setInput('selectedStatus', 0);
    fixture.detectChanges();
  });

  it('renders the three historical columns with server counts and names', () => {
    const groups = fixture.nativeElement.querySelectorAll('.crew-group');
    expect(groups.length).toBe(3);
    expect(groups[0].textContent).toContain('Confirmés 2');
    expect(groups[0].textContent).toContain('Alice');
    expect(groups[1].textContent).toContain('Chloé');
    expect(groups[2].textContent).toContain('Aucun pour le moment');
    const pressed = fixture.nativeElement.querySelector('[aria-pressed="true"]');
    expect(pressed.textContent).toContain('Peut-être');
  });

  it('emits the chosen status and disables buttons while saving', () => {
    const emitted: number[] = [];
    fixture.componentInstance.statusChange.subscribe(value => emitted.push(value));
    fixture.nativeElement.querySelector('button.status-refused').click();
    expect(emitted).toEqual([-1]);

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.participation-actions button'));
    expect(buttons.every(button => button.disabled)).toBe(true);
  });

  it('shows the error with a retry action', () => {
    let retried = false;
    fixture.componentInstance.retry.subscribe(() => retried = true);
    fixture.componentRef.setInput('error', 'Impossible de charger les participations.');
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('Impossible de charger les participations.');
    alert.querySelector('button').click();
    expect(retried).toBe(true);
  });
});
