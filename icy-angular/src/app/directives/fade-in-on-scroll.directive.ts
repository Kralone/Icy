import { Directive, ElementRef, AfterViewInit, Renderer2, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appFadeInOnScroll]',
  standalone: true
})
export class FadeInOnScrollDirective implements AfterViewInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const element = this.el.nativeElement;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.renderer.addClass(element, 'visible');
        } else {
          this.renderer.removeClass(element, 'visible');
        }
      });
    }, {
      threshold: 0.3
    });

    observer.observe(element);
  }
}
