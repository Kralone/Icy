import {
  Directive,
  ElementRef,
  Input,
  Renderer2,
  AfterViewInit,
  OnDestroy
} from '@angular/core';

@Directive({
  selector: '[appParallax]',
  standalone: true
})
export class ParallaxDirective implements AfterViewInit, OnDestroy {
  @Input('appParallax') speed = 0.1;

  private animationFrameId: number = 0;
  private sectionEl: HTMLElement | null = null;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngAfterViewInit(): void {
    // On cherche la première section parente
    this.sectionEl = this.el.nativeElement.closest('section');

    this.animate();
  }

  animate = () => {
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
    cancelAnimationFrame(this.animationFrameId);
  }
}
