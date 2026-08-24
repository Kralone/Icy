
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type MapItem = {
  title: string;
  imageUrl: string;
};

@Component({
  standalone: true,
  selector: 'app-executive-hangar-maps',
  imports: [RouterLink],
  templateUrl: './executive-hangar-maps.component.html',
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

  get backToStatusLink(): string {
    return '/utilitaires/executive-hangar';
  }

  openMap(map: MapItem): void {
    this.isClosingModal = false;
    this.selectedMap = map;
  }

  closeMap(): void {
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
