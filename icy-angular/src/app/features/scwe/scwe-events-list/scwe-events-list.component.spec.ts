import { TestBed } from '@angular/core/testing';
import { ScweEventsListComponent } from './scwe-events-list.component';
import { ScwePlayerService } from '../../../core/services/scworldevent/scwe-player.service';

describe('SCWE Orison Relief rendering', () => {
  for (const total of [3000, 72000, 75000]) {
    it(`renders the target and both progress bars at ${total} points`, async () => {
      await TestBed.configureTestingModule({imports: [ScweEventsListComponent],
        providers: [{provide: ScwePlayerService, useValue: {}}]}).compileComponents();
      const fixture = TestBed.createComponent(ScweEventsListComponent);
      const event = {id: 'relief', title: 'Orison Relief', startAt: '2026-09-16T19:00:00Z',
        scoreSchema: {fields: [{key: 'relief', label: 'Orison Relief', max: 72000}],
          total: {mode: 'sum', keys: ['relief']}}};
      fixture.componentRef.setInput('items', [{event, participation: {id: 'p', status: 1, total,
        points: {relief: total}, event}}]);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('/ 72000 pts');
      const bars = Array.from(fixture.nativeElement.querySelectorAll('[style]'))
        .filter((el: any) => el.style.background.includes('linear-gradient')) as HTMLElement[];
      expect(bars.length).toBe(2);
      for (const bar of bars) {
        expect(parseFloat(bar.style.width)).toBeCloseTo(Math.min(100, total / 72000 * 100));
        expect(bar.style.background).toContain(total >= 72000 ? 'rgb(52, 211, 153)' : 'rgb(34, 211, 238)');
      }
    });
  }
});
