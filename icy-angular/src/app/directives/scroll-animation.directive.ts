import { Directive, ElementRef, Input, AfterViewInit, HostListener } from '@angular/core';

@Directive({
  selector: '[appScrollAnimation]',
  standalone: true,
})
export class ScrollAnimationDirective implements AfterViewInit {
  @Input() startScroll: number = 100;
  @Input() endScroll: number = 800;
  @Input() offsetX: number = 0;
  @Input() reverse: boolean = false;

  private isMobile: boolean = false;

  constructor(private el: ElementRef) {}

  ngAfterViewInit(): void {
    this.isMobile = window.innerWidth < 768; // mobile < 768px
    this.onScroll(); // appliquer dès le chargement
  }

  @HostListener('window:scroll', [])
  onScroll(): void {
    const scrollY = window.scrollY;
    const element = this.el.nativeElement;
    const elementTop = element.getBoundingClientRect().top + window.scrollY;
    const distance = scrollY - elementTop + window.innerHeight * 0.8;

    let progress = (distance - this.startScroll) / (this.endScroll - this.startScroll);
    progress = Math.min(1, Math.max(0, progress)); // Clamp entre 0 et 1

    const opacity = progress.toFixed(2);

    if (this.isMobile) {
      // Effet mobile : fade + slideY doux
      const translateY = (1 - progress) * 40; // slide up léger
      element.style.transform = `translateY(${translateY}px)`;
      element.style.opacity = opacity;
    } else {
      // Effet desktop : fade + slideX
      const direction = this.reverse ? 100 : -100;
      const translateX = (1 - progress) * (direction + this.offsetX);
      element.style.transform = `translateX(${translateX}%)`;
      element.style.opacity = opacity;
    }
  }
}
