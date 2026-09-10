import {TestBed} from '@angular/core/testing';
import {Subject} from 'rxjs';
import {vi} from 'vitest';
import {MiningSheetsComponent} from './mining-sheets.component';
import {MiningSheet,MiningSheetService} from '../../../core/services/mining/mining-sheet.service';
import {coreTestProviders} from '@testing/test-providers';

describe('MiningSheetsComponent sale confirmations',()=>{
  it('retains confirmed sales when another sheet fails and never reports the whole batch as successful',async()=>{
    await TestBed.configureTestingModule({imports:[MiningSheetsComponent],providers:coreTestProviders}).compileComponents();
    const c=TestBed.createComponent(MiningSheetsComponent).componentInstance;
    const a={id:'A',sheetName:'A',status:'OPEN',operationDate:'2026-09-10',sales:[]} as unknown as MiningSheet;
    const b={...a,id:'B',sheetName:'B'};
    c.sheets=[a,b];c.isAdmin=true;
    const first=new Subject<MiningSheet>();const second=new Subject<MiningSheet>();
    const request=vi.spyOn(TestBed.inject(MiningSheetService),'declareSale').mockImplementation(id=>id==='A'?first:second);
    c.declareSales([{sheetId:'A',creditAuec:100},{sheetId:'B',creditAuec:200}]);
    const updated={...a,sales:[{id:'sale-a',creditAuec:100}]} as MiningSheet;
    first.next(updated);first.complete();
    expect(c.sheets.find(row=>row.id==='A')).toBe(updated);
    expect(c.saving).toBe(true);
    second.error({status:0});
    expect(c.completedSaleEntries).toEqual([{sheetId:'A',creditAuec:100}]);
    expect(c.salesDeclarationVersion).toBe(0);expect(c.saving).toBe(false);
    expect(c.actionError).toContain('Échec pour : B');expect(c.actionError).toContain('vérifiez l’historique');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
