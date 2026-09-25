
import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { utilityRouteFor } from '../utility-route-context';
import { A11yModule } from '@angular/cdk/a11y';

type MapItem = {
  title: string;
  imageUrl: string;
};

@Component({
  standalone: true,
  selector: 'app-executive-hangar-maps',
  imports: [RouterLink, A11yModule],
  templateUrl: './executive-hangar-maps.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './executive-hangar-maps.component.css'
})
export class ExecutiveHangarMapsComponent {
  private readonly modalCloseMs = 190;

  readonly maps: MapItem[] = [
    { title: 'Checkmate', imageUrl: 'https://contestedzonetimers.com/maps/Checkmate%20Map.webp' },
    { title: 'Orbituary', imageUrl: 'https://contestedzonetimers.com/maps/Orbituary%20Map.webp' },
    { title: 'Ruin', imageUrl: 'https://contestedzonetimers.com/maps/Ruin%20Map.webp' },
    { title: 'Executive Hangar', imageUrl: 'https://contestedzonetimers.com/maps/Executive%20Hangar%20Map.webp' },
    { title: 'Supervisor', imageUrl: 'https://contestedzonetimers.com/maps/Supervisor%20Map.webp' }
  ];

  selectedMap: MapItem | null = null;
  isClosingModal = false;
  zoom = 1;
  private pointers = new Map<number, {x: number; y: number}>();

  setZoom(value: number, viewport: HTMLElement, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2, dx = 0, dy = 0): void {
    const previousZoom = this.zoom;
    const left = viewport.scrollLeft;
    const top = viewport.scrollTop;
    this.zoom = Math.min(6, Math.max(1, Math.round(value * 100) / 100));
    // Apply the canvas dimensions before scrolling so the browser uses the new bounds.
    this.changeDetector.detectChanges();
    const ratio = this.zoom / previousZoom;
    viewport.scrollLeft = (left + x) * ratio - x + dx;
    viewport.scrollTop = (top + y) * ratio - y + dy;
  }

  wheel(event: WheelEvent): void {
    event.preventDefault();
    if (!event.deltaY) return;
    const viewport = event.currentTarget as HTMLElement;
    const bounds = viewport.getBoundingClientRect();
    this.setZoom(this.zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15), viewport,
      event.clientX - bounds.left, event.clientY - bounds.top);
  }

  pointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    const viewport = event.currentTarget as HTMLElement;
    viewport.focus({preventScroll: true});
    viewport.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  }

  pointerMove(event: PointerEvent): void {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    event.preventDefault();
    const viewport = event.currentTarget as HTMLElement;
    const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      const bounds = viewport.getBoundingClientRect();
      if (before > 0) this.setZoom(this.zoom * after / before, viewport,
        (previous.x + other.x) / 2 - bounds.left, (previous.y + other.y) / 2 - bounds.top,
        (previous.x - event.clientX) / 2, (previous.y - event.clientY) / 2);
    } else {
      viewport.scrollLeft -= event.clientX - previous.x;
      viewport.scrollTop -= event.clientY - previous.y;
    }
    this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  }

  pointerUp(event: PointerEvent): void { this.pointers.delete(event.pointerId); }

  keyboardNavigate(event: KeyboardEvent): void {
    const viewport = event.currentTarget as HTMLElement;
    switch (event.key) {
      case 'ArrowLeft': viewport.scrollLeft -= 120; break;
      case 'ArrowRight': viewport.scrollLeft += 120; break;
      case 'ArrowUp': viewport.scrollTop -= 120; break;
      case 'ArrowDown': viewport.scrollTop += 120; break;
      case '+': case '=': this.setZoom(this.zoom * 1.15, viewport); break;
      case '-': this.setZoom(this.zoom / 1.15, viewport); break;
      default: return;
    }
    event.preventDefault();
  }

  constructor(private router: Router, private changeDetector: ChangeDetectorRef) {}

  get backToStatusLink(): string {
    return utilityRouteFor(this.router.url, 'executive-hangar');
  }

  openMap(map: MapItem): void {
    this.zoom = 1;
    this.pointers.clear();
    this.isClosingModal = false;
    this.selectedMap = map;
  }

  closeMap(): void {
    this.pointers.clear();
    if (!this.selectedMap || this.isClosingModal) {
      return;
    }
    this.isClosingModal = true;
    setTimeout(() => {
      this.selectedMap = null;
      this.isClosingModal = false;
    }, this.modalCloseMs);
  }
}
