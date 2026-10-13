import { TestBed } from '@angular/core/testing';
import { OperationConfirmService } from './operation-confirm.service';

describe('OperationConfirmService', () => {
  let service: OperationConfirmService;
  const dialog = (): HTMLDialogElement | null => document.querySelector('dialog.operation-confirm');
  const buttons = (): HTMLButtonElement[] => Array.from(dialog()!.querySelectorAll('button'));

  beforeEach(() => { service = TestBed.inject(OperationConfirmService); });
  afterEach(() => dialog()?.remove());

  it('shows the question in an application dialog and resolves true on confirmation', async () => {
    const answer = service.ask({ title: 'Supprimer « Alpha » ?', message: 'Cette action est définitive.', confirmLabel: 'Supprimer le groupe', danger: true });

    expect(dialog()!.textContent).toContain('Supprimer « Alpha » ?');
    expect(dialog()!.textContent).toContain('Cette action est définitive.');
    expect(buttons().map(button => button.textContent)).toEqual(['Annuler', 'Supprimer le groupe']);
    buttons()[1].click();

    expect(await answer).toBe(true);
    expect(dialog()).toBeNull();
  });

  it('resolves false on cancel and on Escape, and never leaves the dialog behind', async () => {
    const cancelled = service.ask({ title: 'Quitter ?', confirmLabel: 'Quitter' });
    buttons()[0].click();
    expect(await cancelled).toBe(false);

    const escaped = service.ask({ title: 'Quitter ?', confirmLabel: 'Quitter' });
    dialog()!.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(await escaped).toBe(false);
    expect(dialog()).toBeNull();
  });
});
