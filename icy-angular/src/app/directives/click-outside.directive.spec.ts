import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ClickOutsideDirective } from './click-outside.directive';

@Component({
  standalone: true,
  imports: [ClickOutsideDirective],
  template: `
    <div id="menu" (appClickOutside)="closed = closed + 1"><button id="inside" type="button">Marques</button></div>
    <button id="stopped" type="button" (click)="$event.stopPropagation()">Supprimer</button>
  `,
})
class Host {
  closed = 0;
}

describe('ClickOutsideDirective', () => {
  it('reports clicks outside, even when they stop propagating, and ignores clicks inside', () => {
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('#inside') as HTMLElement).click();
    expect(fixture.componentInstance.closed).toBe(0);

    (root.querySelector('#stopped') as HTMLElement).click();
    expect(fixture.componentInstance.closed).toBe(1);

    fixture.destroy();
    fixture.nativeElement.remove();
  });
});
