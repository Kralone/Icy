import {SimpleChange} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MiningSheetsSalesComponent} from './mining-sheets-sales.component';
import {MiningSheet} from '../../../../core/services/mining/mining-sheet.service';
function sheet(id:string, estimate:number):MiningSheet {
  return {id,sheetName:id,operationDate:'2026-09-10',refineryLocation:'ARC-L1',status:'OPEN',sales:[],
    summary:{totalEstimatedAuec:estimate,totalDeclaredSalesAuec:0}} as unknown as MiningSheet;
}
function setup(){
  const c=new MiningSheetsSalesComponent(); c.saleSheets=[sheet('A',100),sheet('B',200)];
  c.sheet=c.saleSheets[0];c.selectedSheetId='A';c.currentUserId='seller';
  c.ngOnChanges({saleSheets:new SimpleChange(null,c.saleSheets,true)});return c;
}
describe('MiningSheetsSalesComponent',()=>{
  it('preserves the exact received total, weighted by estimates rather than previous sales',()=>{
    const c=setup();c.setSheetSelection('B',true);c.saleSheets[0].summary.totalDeclaredSalesAuec=500;
    c.onDeclarationAmountChange('1 001');expect(c.allocatedEntries).toEqual([{sheetId:'A',creditAuec:334},{sheetId:'B',creditAuec:667}]);
  });
  it('uses equal shares only if all estimates are zero, otherwise exposes zero allocation',()=>{
    const c=setup();c.setSheetSelection('B',true);c.saleSheets[0].summary.totalEstimatedAuec=0;c.onDeclarationAmountChange('101');
    expect(c.allocationRows[0].creditAuec).toBe(0);expect(c.hasZeroAllocation).toBe(true);
    c.saleSheets[1].summary.totalEstimatedAuec=0;expect(c.allocatedEntries.map(row=>row.creditAuec)).toEqual([51,50]);
  });
  it('rejects negative, decimal and unsafe values rather than rewriting them',()=>{
    const c=setup();for(const value of ['-100','12.50','12,50','1e5','9007199254740992']){
      c.onDeclarationAmountChange(value);expect(c.declarationAmountAuec).toBe(0);expect(c.isDeclarationInvalid()).toBe(true);
    }
  });
  it('preserves deliberate deselection on refresh and resets the draft on sheet navigation',()=>{
    const c=setup();c.clearSelectedSheets();c.onDeclarationAmountChange('100');
    c.ngOnChanges({saleSheets:new SimpleChange([],c.saleSheets,false)});
    expect(c.selectedSaleSheets.length).toBe(0);expect(c.declarationAmountInput).toBe('100');
    c.selectedSheetId='B';c.ngOnChanges({selectedSheetId:new SimpleChange('A','B',false)});
    expect([...c.selectedSheetIds]).toEqual(['B']);expect(c.declarationAmountInput).toBe('');
  });
  it('removes confirmed entries and money from a partially saved draft',()=>{
    const c=setup();c.setSheetSelection('B',true);c.onDeclarationAmountChange('300');
    c.completedSaleEntries=[{sheetId:'A',creditAuec:100}];
    c.ngOnChanges({completedSaleEntries:new SimpleChange([],c.completedSaleEntries,false)});
    expect(c.declarationAmountInput).toBe('200');expect(c.allocatedEntries).toEqual([{sheetId:'B',creditAuec:200}]);
  });
  it('blocks a second immediate submission of an additive sale',()=>{
    const c=setup();c.onDeclarationAmountChange('100');let count=0;c.declareSales.subscribe(()=>count++);
    c.submitSales();c.submitSales();expect(count).toBe(1);
  });
  it('shows selection directly without hidden detailed transfers',async()=>{
    await TestBed.configureTestingModule({imports:[MiningSheetsSalesComponent]}).compileComponents();
    const f=TestBed.createComponent(MiningSheetsSalesComponent);
    f.componentRef.setInput('sheet',sheet('A',100));f.componentRef.setInput('saleSheets',[sheet('A',100),sheet('B',200)]);
    f.componentRef.setInput('selectedSheetId','A');f.componentRef.setInput('currentUserId','seller');f.detectChanges();
    expect(f.nativeElement.querySelectorAll('input[type=checkbox]').length).toBe(2);
    expect(f.nativeElement.querySelector('details')).toBeNull();expect(f.nativeElement.querySelector('svg')).toBeNull();
    expect(f.nativeElement.textContent).toContain('nouvelle vente');
  });
});
