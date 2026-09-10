import {TestBed} from '@angular/core/testing';
import {MiningSheetsAdminModalComponent} from './mining-sheets-admin-modal.component';
import {MiningSheet} from '../../../../core/services/mining/mining-sheet.service';

describe('Mining sheet lifecycle actions', () => {
  async function setup() {
    await TestBed.configureTestingModule({imports: [MiningSheetsAdminModalComponent]}).compileComponents();
    const fixture = TestBed.createComponent(MiningSheetsAdminModalComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('form', {sheetName: 'Test', operationDate: '2026-09-10', refineryLocation: 'ARC-L1', saleLocation: '', memberIds: [], memberSearch: ''});
    fixture.componentRef.setInput('toDisplayDate', (date: string) => date);
    const setStatus = (status: MiningSheet['status']) => {
      fixture.componentRef.setInput('sheet', {status, operationDate: '2026-09-10', refineryLocation: 'ARC-L1'} as MiningSheet);
      fixture.detectChanges();
    };
    const buttons = () => [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    return {fixture, setStatus, buttons};
  }

  it('offers locking first, finalization only after locking, and no actions after finalization', async () => {
    const {fixture, setStatus, buttons} = await setup();
    let locks = 0, finalizations = 0;
    fixture.componentInstance.lock.subscribe(() => locks++);
    fixture.componentInstance.finalize.subscribe(() => finalizations++);
    setStatus('OPEN');
    expect(buttons().some(button => button.textContent?.includes('Finaliser'))).toBe(false);
    buttons().find(button => button.textContent?.includes('Verrouiller'))!.click();
    expect(locks).toBe(1);
    setStatus('LOCKED');
    expect(buttons().some(button => button.textContent?.includes('Verrouiller'))).toBe(false);
    expect(buttons().some(button => button.textContent?.includes('Déverrouiller'))).toBe(true);
    buttons().find(button => button.textContent?.includes('Finaliser'))!.click();
    expect(finalizations).toBe(1);
    setStatus('FINALIZED');
    expect(buttons().map(button => button.textContent?.trim())).toEqual(['Fermer']);
    expect(fixture.nativeElement.textContent).toContain('Fiche finalisée');
  });

  it('prevents repeated submissions and keeps failures visible in the dialog', async () => {
    const {fixture, setStatus, buttons} = await setup();
    setStatus('LOCKED');
    let finalizations = 0;
    fixture.componentInstance.finalize.subscribe(() => finalizations++);
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    const finalize = buttons().find(button => button.textContent?.includes('Finaliser'))!;
    expect(finalize.disabled).toBe(true);
    finalize.click();
    expect(finalizations).toBe(0);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('actionError', 'Finalisation impossible.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Finalisation impossible.');
    expect(finalize.disabled).toBe(false);
  });
});
