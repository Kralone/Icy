import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {ScweWidgetComponent} from './scwe-widget.component';
import {ScWorldEventService} from '../../../core/services/scworldevent/sc-world-event.service';
import {ScwePlayerService} from '../../../core/services/scworldevent/scwe-player.service';
import {WebSocketService} from '../../../core/services/websocket/websocket.service';

describe('SC World Event dashboard visibility', () => {
  it('renders no widget when no event is active', async () => {
    await TestBed.configureTestingModule({
      imports: [ScweWidgetComponent],
      providers: [provideRouter([]),
        {provide: ScWorldEventService, useValue: {getCurrent: () => of(null)}},
        {provide: ScwePlayerService, useValue: {}},
        {provide: WebSocketService, useValue: {watchScWorldEvents: () => of()}}
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(ScweWidgetComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dashboard-widget')).toBeNull();
    expect(fixture.nativeElement.style.display).toBe('none');
  });
});
