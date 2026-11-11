import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { SearchOption, SearchSelectComponent } from './search-select.component';

@Component({
  standalone: true,
  imports: [FormsModule, SearchSelectComponent],
  template: `
    <label>Joueur qui donne
      <app-search-select [(ngModel)]="value" [options]="options" ariaLabel="Joueur" />
    </label>
  `,
})
class InLabelHost {
  value: string | null = null;
  readonly options: SearchOption<string>[] = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Bravo' }];
}

describe('SearchSelectComponent', () => {
  it('closes after a pick even when it sits inside a label', async () => {
    const fixture = TestBed.createComponent(InLabelHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('input')!;
    // jsdom ne fait pas de mise en page : le champ est placé en haut de l'écran.
    input.getBoundingClientRect = () => ({ top: 100, bottom: 130, left: 10, right: 210, width: 200, height: 30, x: 10, y: 100, toJSON: () => ({}) });

    input.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const option = root.querySelectorAll('li')[1] as HTMLElement;
    expect(option).toBeTruthy();

    option.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(root.querySelector('ul')).toBeNull();
    expect(fixture.componentInstance.value).toBe('b');
    expect(input.value).toBe('Bravo');
    fixture.nativeElement.remove();
  });
});
