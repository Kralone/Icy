import { TestBed } from '@angular/core/testing';
import { ShipDetailModalComponent } from './ship-detail-modal.component';

describe('ShipDetailModalComponent', () => {
  it('shows catalog stats in French units and hides the missing ones', () => {
    const fixture = TestBed.createComponent(ShipDetailModalComponent);
    fixture.componentInstance.ship = {
      name: 'Avenger Stalker', focus: 'Combat',
      stats: { career: 'Combat', role: 'Interceptor', sizeClass: 2, crewMin: 1, crewMax: 1, cargoScu: 0,
        scmSpeed: 262, maxSpeed: 1425, hull: 11900, quantumRange: 61224489796, mass: 55317 },
    };
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Combat · Interceptor');
    expect(text).toContain('Taille 2');
    expect(text).toContain('0 SCU');
    expect(text).toContain('Vitesse SCM');
    expect(text).toContain('61,2 Gm');
    expect(text).toContain('55,3 t');
    expect(text).not.toContain('Boucliers');
    expect(text).not.toContain('Assurance');
  });

  it('keeps the previous fields when no catalog stats are provided', () => {
    const fixture = TestBed.createComponent(ShipDetailModalComponent);
    fixture.componentInstance.ship = { name: 'Cutlass', crew: '2', cargo: '46 SCU' };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('46 SCU');
    expect(fixture.nativeElement.querySelector('.stats')).toBeNull();
  });
});
