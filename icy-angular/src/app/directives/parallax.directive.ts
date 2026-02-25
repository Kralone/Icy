import {
  Directive,
  ElementRef,
  Input,
  Renderer2,
  AfterViewInit,
  OnDestroy,
  inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appParallax]',
  standalone: true
})
export class ParallaxDirective implements AfterViewInit, OnDestroy {
  @Input('appParallax') speed = 0.1;

  private animationFrameId: number = 0;
  private sectionEl: HTMLElement | null = null;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    // On cherche la première section parente
    this.sectionEl = this.el.nativeElement.closest('section');

    this.animate();
  }

  animate = () => {
    if (!this.isBrowser) return;
    if (!this.sectionEl) return;

    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const sectionRect = this.sectionEl.getBoundingClientRect();

    const sectionOffset = sectionRect.top;
    let offset = (viewportHeight - sectionOffset) * this.speed;

    const maxOffset =
      this.sectionEl.offsetHeight - this.el.nativeElement.offsetHeight;
    offset = Math.max(0, Math.min(offset, maxOffset));

    this.renderer.setStyle(
      this.el.nativeElement,
      'transform',
      `translateY(${offset}px)`
    );

    this.animationFrameId = requestAnimationFrame(this.animate);
  };




  ngOnDestroy(): void {
    if (this.isBrowser) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
