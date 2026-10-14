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

  it('keeps the confirmation disabled until the acknowledgement is checked', async () => {
    const service = TestBed.inject(OperationConfirmService);
    const answer = service.ask({ title: 'Supprimer « Équipage Polaris » ?', message: 'Le groupe sera supprimé avec 1 besoin de vaisseau.', acknowledge: 'Je comprends que cette suppression est définitive.', confirmLabel: 'Supprimer', danger: true });
    const dialog = document.querySelector('dialog.operation-confirm')!;
    const confirm = dialog.querySelector('button[data-confirm]') as HTMLButtonElement;
    const box = dialog.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(dialog.textContent).toContain('Je comprends que cette suppression est définitive.');
    expect(confirm.disabled).toBe(true);
    confirm.click();
    expect(document.querySelector('dialog.operation-confirm')).not.toBeNull();
    box.click();
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await expect(answer).resolves.toBe(true);
  });
});
