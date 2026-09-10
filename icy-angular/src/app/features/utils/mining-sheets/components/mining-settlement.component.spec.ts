import { TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { MiningSettlementComponent } from './mining-settlement.component';
import { MiningSheetSummary } from '../../../../core/services/mining/mining-sheet.service';

registerLocaleData(localeFr);

describe('MiningSettlementComponent', () => {
  const summary: MiningSheetSummary = {
    ores: [], keptOres: [], userMaterials: [], longestRemainingSeconds: 0,
    totalEstimatedAuec: 1000, totalCostsAuec: 100, netEstimatedAuec: 900,
    totalDeclaredSalesAuec: 800,
    settlements: [{userId: 'a', username: 'Pilote', grossEstimateAuec: 1000, paidCostsAuec: 100, sharedCostAuec: 100, compensationAuec: 0, payoutAuec: 1000}],
    saleSettlements: [{userId: 'a', username: 'Pilote', grossEstimateAuec: 1000, paidCostsAuec: 100, sharedCostAuec: 100, compensationAuec: 0, payoutAuec: 800}],
    saleTransfers: [{fromUserId: 'b', fromUsername: 'Vendeur', toUserId: 'a', toUsername: 'Pilote', amountAuec: 800}]
  };

  async function setup(value: MiningSheetSummary) {
    await TestBed.configureTestingModule({imports: [MiningSettlementComponent]}).compileComponents();
    const fixture = TestBed.createComponent(MiningSettlementComponent);
    fixture.componentRef.setInput('summary', value);
    fixture.detectChanges();
    return fixture;
  }

  it('uses actual declared revenue and server transfers rather than estimates by default', async () => {
    const fixture = await setup(summary);
    expect(fixture.componentInstance.revenue).toBe(800);
    expect(fixture.componentInstance.rows[0].payoutAuec).toBe(800);
    expect(fixture.nativeElement.querySelector('.transfer').textContent).toContain('800');
    expect(fixture.nativeElement.querySelector('.totals').textContent).toContain('700');
  });

  it('does not present estimates as payment instructions before a sale exists', async () => {
    const fixture = await setup({...summary, totalDeclaredSalesAuec: 0});
    expect(fixture.nativeElement.textContent).toContain('Aucune vente déclarée');
    expect(fixture.nativeElement.querySelector('.transfer')).toBeNull();
    fixture.nativeElement.querySelectorAll('.mode button')[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.revenue).toBe(1000);
    expect(fixture.nativeElement.textContent).toContain('ne constitue pas un ordre de versement');
    expect(fixture.nativeElement.querySelector('.transfer')).toBeNull();
  });

  it('preserves a negative entitlement and explains compensation without changing the server calculation', async () => {
    const row = {...summary.saleSettlements[0], paidCostsAuec: 0, sharedCostAuec: 100, compensationAuec: -100, payoutAuec: -20};
    const fixture = await setup({...summary, saleSettlements: [row]});
    expect(fixture.nativeElement.querySelector('.amount.negative').textContent).toContain('-20');
    expect(fixture.nativeElement.querySelector('dl').textContent).toContain('80');
    expect(fixture.componentInstance.rows[0]).toEqual(row);
  });
});
