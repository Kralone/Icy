import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { WikeloComponent } from './wikelo.component';
import { WikeloEquipment } from '../../../model/wikelo-equipment.model';
import { WikeloService } from '../../../core/services/wikelo/wikelo.service';
import { UserService } from '../../../core/services/user/user.service';
import { ShipService } from '../../../core/services/ship/ship.service';
import { GoalService } from '../../../core/services/goal/goal.service';
import { AuthService } from '../../../core/services/auth/auth.service';

const armor: WikeloEquipment = {
  id: 1, name: 'Ana Arms Endro', family: 'ARMOR', manufacturer: null,
  description: "Type d'article : Armure Lourde\nRéduction des dégâts : 40%\n\nCette armure comporte des crocs.",
  imageUrl: null, sourceUrl: null,
  recipes: [{id: 'ana-bundle', name: 'Ana armor set', reputation: 'None', sourceUrl: 'https://example.invalid/source', sourceVersion: null,
    ingredients: [{name: 'Carinite', quantity: '3 SCU'}],
    rewards: [{name: 'Ana Arms Endro', quantity: '1'}, {name: 'Ana Helmet Endro', quantity: '1'}]}]
};

describe('Wikelo equipment detail rendering', () => {
  it('shows the entire recipe reward set alongside its cost and visual specifications', async () => {
    await TestBed.configureTestingModule({
      imports: [WikeloComponent],
      providers: [provideRouter([]), provideNoopAnimations(),
        {provide: WikeloService, useValue: {getShips: () => of({data: []}), getEquipment: () => of({data: [armor]})}},
        {provide: ShipService, useValue: {getAllShips: () => of({data: []})}},
        {provide: UserService, useValue: {}}, {provide: GoalService, useValue: {}},
        {provide: AuthService, useValue: {hasToken: () => false}}
      ]
    }).compileComponents();
    await TestBed.inject(Router).navigate([], {queryParams: {view: 'armor'}});
    const fixture = TestBed.createComponent(WikeloComponent);
    fixture.detectChanges();
    fixture.componentInstance.expandedEquipmentId = armor.id;
    fixture.detectChanges();
    const detail = fixture.nativeElement.querySelector('.equipment-description') as HTMLElement;
    expect(detail.querySelectorAll('.recipe-rewards li').length).toBe(2);
    expect(detail.querySelector('.recipe-cost')?.textContent).toContain('3 SCU');
    expect(detail.querySelector('.recipe-rewards')?.textContent).toContain('Ana Helmet Endro');
    expect(detail.querySelector('.recipe-reputation')?.textContent).toContain('Aucune');
    expect(detail.querySelector('.equipment-spec-grid')?.textContent).toContain('40%');
    expect(detail.querySelector('.equipment-prose')?.textContent).toContain('Cette armure comporte des crocs.');
    expect(detail.querySelectorAll('a').length).toBe(0);
    expect(fixture.nativeElement.textContent).not.toContain('Conditions d’échange indisponibles');
    fixture.destroy();
  });
});
