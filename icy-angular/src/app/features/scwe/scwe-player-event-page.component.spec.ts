import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ScwePlayerPageComponent } from './scwe-player-event-page.component';
import { ScwePlayerService } from '../../core/services/scworldevent/scwe-player.service';
import { ScWorldEventService } from '../../core/services/scworldevent/sc-world-event.service';
import { WebSocketService } from '../../core/services/websocket/websocket.service';

describe('ScwePlayerPageComponent', () => {
  it('reloads the shown view once per burst of server signals, without polling', async () => {
    vi.useFakeTimers();
    const signals = new Subject<void>();
    const getPlayable = vi.fn(() => of({ content: [] }));
    await TestBed.configureTestingModule({
      imports: [ScwePlayerPageComponent],
      providers: [
        { provide: ScWorldEventService, useValue: { getPlayable, getHistory: vi.fn(() => of({ content: [] })), getCurrent: vi.fn(() => of(null)) } },
        { provide: ScwePlayerService, useValue: { getMyParticipations: vi.fn(() => of([])), getLeaderboard: vi.fn() } },
        { provide: WebSocketService, useValue: { watchScWorldEvents: () => signals.asObservable() } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(ScwePlayerPageComponent);
    fixture.detectChanges();
    expect(getPlayable).toHaveBeenCalledTimes(1);

    // Rien ne change : aucune requête, même après plusieurs minutes.
    vi.advanceTimersByTime(120_000);
    expect(getPlayable).toHaveBeenCalledTimes(1);

    signals.next();
    signals.next();
    signals.next();
    vi.advanceTimersByTime(500);
    expect(getPlayable).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Mise à jour en direct');
    fixture.destroy();
    vi.useRealTimers();
  });
});
