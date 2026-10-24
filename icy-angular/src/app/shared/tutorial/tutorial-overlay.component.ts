import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, NgZone, PLATFORM_ID, effect, inject, signal, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TutorialService, findVisibleTarget } from './tutorial.service';
import { Box, BubbleLayout, computeBubbleLayout, spotlightBox } from './tutorial-layout';

interface OverlayFrame { spot: Box | null; bubble: BubbleLayout; }

const sameFrame = (a: OverlayFrame | null, b: OverlayFrame) => !!a
  && a.bubble.top === b.bubble.top && a.bubble.left === b.bubble.left
  && a.bubble.arrow?.side === b.bubble.arrow?.side && a.bubble.arrow?.offset === b.bubble.arrow?.offset
  && a.spot?.top === b.spot?.top && a.spot?.left === b.spot?.left && a.spot?.width === b.spot?.width && a.spot?.height === b.spot?.height;

@Component({
  selector: 'app-tutorial-overlay',
  templateUrl: './tutorial-overlay.component.html',
  styleUrl: './tutorial-overlay.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TutorialOverlayComponent {
  readonly tutorials = inject(TutorialService);
  readonly frame = signal<OverlayFrame | null>(null);

  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly bubbleRef = viewChild<ElementRef<HTMLElement>>('bubble');
  private target: HTMLElement | null = null;
  private rafId: number | null = null;
  private returnFocus: HTMLElement | null = null;
  private shownStep: unknown = null;
  private focusPending = false;

  constructor() {
    effect(() => {
      const step = this.tutorials.step();
      if (!this.isBrowser) return;
      if (!step) {
        this.stop();
        return;
      }
      if (!this.shownStep) this.returnFocus = document.activeElement as HTMLElement | null;
      this.shownStep = step;
      this.target = step.target ? findVisibleTarget(step.target) : null;
      this.target?.scrollIntoView({ block: this.target.getBoundingClientRect().height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
      this.frame.set(null);
      this.focusPending = true;
      this.loop();
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.tutorials.active()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.tutorials.skip();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.tutorials.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.tutorials.previous();
    } else if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  private trapFocus(event: KeyboardEvent): void {
    const buttons = Array.from(this.bubbleRef()?.nativeElement.querySelectorAll<HTMLElement>('button') ?? []);
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index === buttons.length - 1 ? 0 : index + 1);
    event.preventDefault();
    buttons[nextIndex].focus();
  }

  // Suit la cible à chaque image : défilement, redimensionnement et contenu chargé en différé.
  private loop(): void {
    if (this.rafId !== null) return;
    this.zone.runOutsideAngular(() => {
      const tick = () => {
        this.measure();
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    });
  }

  private measure(): void {
    const step = this.tutorials.step();
    if (!step) return;
    if (this.target && !this.target.isConnected && step.target) this.target = findVisibleTarget(step.target);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const rect = this.target?.getBoundingClientRect();
    const spot = rect && rect.width > 0 && rect.height > 0 ? spotlightBox(rect, viewport) : null;
    const bubbleElement = this.bubbleRef()?.nativeElement;
    const bubble = { width: bubbleElement?.offsetWidth || Math.min(360, viewport.width - 32), height: bubbleElement?.offsetHeight || 180 };
    const layout = computeBubbleLayout(spot, bubble, viewport, step.placement);
    const next: OverlayFrame = {
      spot: spot && { top: Math.round(spot.top), left: Math.round(spot.left), width: Math.round(spot.width), height: Math.round(spot.height) },
      bubble: { top: Math.round(layout.top), left: Math.round(layout.left), arrow: layout.arrow && { side: layout.arrow.side, offset: Math.round(layout.arrow.offset) } }
    };
    if (!sameFrame(this.frame(), next)) this.zone.run(() => this.frame.set(next));
    if (this.focusPending) {
      this.focusPending = false;
      // La bulle reste masquée tant qu’elle n’est pas placée : le focus attend son affichage.
      setTimeout(() => this.bubbleRef()?.nativeElement.querySelector<HTMLElement>('[data-primary]')?.focus({ preventScroll: true }));
    }
  }

  private stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.target = null;
    this.frame.set(null);
    if (this.shownStep) {
      this.shownStep = null;
      this.returnFocus?.focus?.({ preventScroll: true });
      this.returnFocus = null;
    }
  }
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
