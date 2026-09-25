
import { Component, ChangeDetectionStrategy } from '@angular/core';
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

  setZoom(value: number): void {
    this.zoom = Math.min(6, Math.max(1, Math.round(value * 100) / 100));
  }

  wheel(event: WheelEvent): void {
    event.preventDefault();
    this.setZoom(this.zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
  }

  pointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  }

  pointerMove(event: PointerEvent): void {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    const viewport = event.currentTarget as HTMLElement;
    const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (before > 0) this.setZoom(this.zoom * after / before);
    } else {
      viewport.scrollLeft -= event.clientX - previous.x;
      viewport.scrollTop -= event.clientY - previous.y;
    }
    this.pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  }

  pointerUp(event: PointerEvent): void { this.pointers.delete(event.pointerId); }

  keyboardPan(event: KeyboardEvent): void {
    const viewport = event.currentTarget as HTMLElement;
    const amount = 120;
    if (event.key === 'ArrowLeft') viewport.scrollBy({left: -amount, behavior: 'smooth'});
    else if (event.key === 'ArrowRight') viewport.scrollBy({left: amount, behavior: 'smooth'});
    else if (event.key === 'ArrowUp') viewport.scrollBy({top: -amount, behavior: 'smooth'});
    else if (event.key === 'ArrowDown') viewport.scrollBy({top: amount, behavior: 'smooth'});
    else return;
    event.preventDefault();
  }

  constructor(private router: Router) {}

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
