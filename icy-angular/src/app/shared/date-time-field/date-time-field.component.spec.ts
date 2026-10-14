import { TestBed } from '@angular/core/testing';
import { DateTimeFieldComponent } from './date-time-field.component';

describe('DateTimeFieldComponent', () => {
  function create() {
    const fixture = TestBed.createComponent(DateTimeFieldComponent);
    const changes: string[] = [];
    fixture.componentInstance.registerOnChange(value => changes.push(value));
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, changes };
  }

  it('reads and writes the datetime-local format, and says the date in words', () => {
    const { fixture, component, changes } = create();
    component.writeValue('2026-10-20T21:00:00');
    fixture.detectChanges();
    const [date, time] = Array.from(fixture.nativeElement.querySelectorAll('input')) as HTMLInputElement[];
    expect(date.value).toBe('2026-10-20');
    expect(time.value).toBe('21:00');
    expect(fixture.nativeElement.querySelector('.summary').textContent).toContain('mardi 20 octobre à 21:00');

    component.setTime('22:30');
    expect(changes.at(-1)).toBe('2026-10-20T22:30');
  });

  it('fills the date and the hour from the shortcuts, never sending a half-filled value', () => {
    const { component, changes } = create();
    component.setDate('2026-10-20');
    expect(changes.at(-1)).toBe('');
    component.pickHour(20);
    expect(changes.at(-1)).toBe('2026-10-20T20:00');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    component.pickDay(tomorrow);
    expect(changes.at(-1)!.endsWith('T20:00')).toBe(true);
    expect(component.isDay(tomorrow)).toBe(true);
  });

  it('hides the shortcuts when disabled', () => {
    const { fixture, component } = create();
    component.setDisabledState(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.shortcuts')).toBeNull();
    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).disabled).toBe(true);
  });
});
