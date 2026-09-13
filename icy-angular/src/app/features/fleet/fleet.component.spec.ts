import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FleetComponent } from './fleet.component';
import {coreTestProviders} from '@testing/test-providers';
import {Subject} from 'rxjs';
import {ShipService} from '../../core/services/ship/ship.service';

describe('FleetComponent', () => {
  let component: FleetComponent;
  let fixture: ComponentFixture<FleetComponent>;
  let fleetUpdates: Subject<string>;

  beforeEach(async () => {
    fleetUpdates = new Subject<string>();
    await TestBed.configureTestingModule({
      imports: [FleetComponent],
      providers: [...coreTestProviders, {provide: ShipService, useValue: {getFleetSummary: () => fleetUpdates}}]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FleetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps names intact, counts all ships, and badges only repeated models', () => {
    const ship = (name: string) => ({name, focus: 'Minage', imageUrl: '', brandImageUrl: ''});
    fleetUpdates.next(JSON.stringify({fleet: [ship('Prospector'), ship('Prospector'), ship('MOLE')]}));
    fixture.detectChanges();
    expect(component.fleetSummary['Minage'].map(ship => [ship.name, ship.count])).toEqual([['Prospector', 2], ['MOLE', 1]]);
    expect(component.shipCount('Minage')).toBe(3);
    const badges = fixture.nativeElement.querySelectorAll('.fleet-quantity');
    expect(badges.length).toBe(1);
    expect(badges[0].getAttribute('aria-label')).toBe('2 exemplaires de Prospector');
    expect(fixture.nativeElement.textContent).not.toContain('Prospector (2)');
    fleetUpdates.next(JSON.stringify({fleet: [ship('Prospector'), ship('MOLE')]}));
    fixture.detectChanges();
    expect(component.shipCount('Minage')).toBe(2);
    expect(fixture.nativeElement.querySelector('.fleet-quantity')).toBeNull();
  });
});
