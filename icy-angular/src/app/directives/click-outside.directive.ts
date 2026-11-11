import { DestroyRef, Directive, ElementRef, Output, EventEmitter, inject } from '@angular/core';

@Directive({
  selector: '[appClickOutside]'
})
export class ClickOutsideDirective {
  @Output() appClickOutside  = new EventEmitter<void>();

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {
    // En capture : un élément qui arrête la propagation de ses clics ne doit pas empêcher la fermeture.
    const listener = (event: Event) => this.onClick(event.target);
    document.addEventListener('click', listener, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('click', listener, true));
  }

  public onClick(targetElement: EventTarget | null): void {
    const clickedInside = targetElement instanceof Node
      && this.elementRef.nativeElement.contains(targetElement);
    if (!clickedInside) {
      this.appClickOutside.emit();
    }
  }
}
