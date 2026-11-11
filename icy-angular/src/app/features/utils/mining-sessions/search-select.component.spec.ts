import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { SearchOption, SearchSelectComponent } from './search-select.component';

/** Même structure que le dialogue de saisie de la banque : fond qui ferme, formulaire qui arrête ses clics, liste dans un label. */
@Component({
  standalone: true,
  imports: [FormsModule, SearchSelectComponent],
  template: `
    @if (dialog()) {
      <div class="backdrop" (click)="dialog.set(false)">
        <form (click)="$event.stopPropagation()">
          <h2>Nouveau dépôt</h2>
          <label>Joueur qui donne
            <app-search-select name="userId" [(ngModel)]="value" [options]="options" ariaLabel="Joueur" />
          </label>
        </form>
      </div>
    }
  `,
})
class BankDialogHost {
  readonly dialog = signal(true);
  value: string | null = null;
  readonly options: SearchOption<string>[] = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Bravo' }];
}

describe('SearchSelectComponent', () => {
  let fixture: ComponentFixture<BankDialogHost>;
  let root: HTMLElement;
  let input: HTMLInputElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(BankDialogHost);
    document.body.appendChild(fixture.nativeElement);
    // Comme dans le navigateur : la vue est mise à jour après chaque gestionnaire, pendant que le clic remonte encore.
    fixture.autoDetectChanges(true);
    await fixture.whenStable();
    root = fixture.nativeElement as HTMLElement;
    input = root.querySelector('input')!;
    // jsdom ne fait pas de mise en page : le champ est placé en haut de l'écran.
    input.getBoundingClientRect = () => new DOMRect(10, 100, 200, 30);
  });

  afterEach(() => fixture.nativeElement.remove());

  async function openList(): Promise<void> {
    input.click();
    await fixture.whenStable();
    expect(root.querySelector('[role="listbox"]')).not.toBeNull();
  }

  it('closes after a pick, inside a label', async () => {
    await openList();

    (root.querySelectorAll('li[role="option"]')[1] as HTMLElement).click();
    await fixture.whenStable();

    expect(root.querySelector('[role="listbox"]')).toBeNull();
    expect(fixture.componentInstance.value).toBe('b');
    expect(input.value).toBe('Bravo');
  });

  it('closes on a click elsewhere in a dialog that stops its clicks', async () => {
    await openList();

    root.querySelector('h2')!.click();
    await fixture.whenStable();

    expect(root.querySelector('[role="listbox"]')).toBeNull();
    expect(fixture.componentInstance.dialog()).toBe(true);
  });

  it('closes with Escape without choosing', async () => {
    await openList();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(root.querySelector('[role="listbox"]')).toBeNull();
    expect(fixture.componentInstance.value).toBeNull();
  });
});
