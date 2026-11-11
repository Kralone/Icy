import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { SearchOption, SearchSelectComponent } from './search-select.component';

/** Comme dans les fenêtres de la banque : le champ est dans un label, et la fenêtre arrête la propagation de ses clics. */
@Component({
  standalone: true,
  imports: [FormsModule, SearchSelectComponent],
  template: `
    <form class="dialog" (click)="$event.stopPropagation()">
      <h2>Saisir un dépôt</h2>
      <label>Joueur qui donne
        <app-search-select name="player" [(ngModel)]="value" [options]="options" ariaLabel="Joueur" />
      </label>
      <label>Montant <input class="amount"></label>
    </form>
  `,
})
class DialogHost {
  value: string | null = null;
  readonly options: SearchOption<string>[] = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Bravo' }];
}

/** Ce que fait le navigateur pour un clic de souris : appui, puis clic. */
function press(element: Element): void {
  element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('SearchSelectComponent', () => {
  let fixture: ComponentFixture<DialogHost>;
  let root: HTMLElement;
  let input: HTMLInputElement;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }
  const list = () => root.querySelector('ul[role=listbox]');

  beforeEach(async () => {
    fixture = TestBed.createComponent(DialogHost);
    document.body.appendChild(fixture.nativeElement);
    await settle();
    root = fixture.nativeElement as HTMLElement;
    input = root.querySelector('app-search-select input')!;
    // jsdom ne fait pas de mise en page : le champ est placé en haut de l'écran.
    input.getBoundingClientRect = () => ({ top: 100, bottom: 130, left: 10, right: 210, width: 200, height: 30, x: 10, y: 100, toJSON: () => ({}) });
  });

  afterEach(() => fixture.nativeElement.remove());

  it('opens when the field is pressed and closes after a pick, although the label clicks the field again', async () => {
    press(input);
    await settle();
    expect(list()).not.toBeNull();

    press(root.querySelectorAll('li')[1]);
    await settle();

    expect(list()).toBeNull();
    expect(fixture.componentInstance.value).toBe('b');
    expect(input.value).toBe('Bravo');
  });

  it('closes on a press elsewhere, even inside a dialog that stops click propagation', async () => {
    for (const elsewhere of [root.querySelector('h2')!, root.querySelector('.amount')!]) {
      press(input);
      await settle();
      expect(list()).not.toBeNull();

      press(elsewhere);
      await settle();
      expect(list()).toBeNull();
    }
  });

  it('stays closed when the label text is pressed', async () => {
    press(input);
    await settle();
    press(root.querySelector('label')!);
    await settle();
    expect(list()).toBeNull();
  });
});
