import {Component, input} from '@angular/core';

@Component({
  selector: 'app-manufacturer-badge',
  standalone: true,
  template: `<div class="badge" [title]="brand() || 'Constructeur'">
    <img [src]="imageUrl()" [alt]="brand() || 'Logo constructeur'" />
  </div>`,
  styles: `
    :host { display: block; }
    .badge {
      display: grid; place-items: center; box-sizing: border-box;
      width: 64px; height: 64px; padding: 9px;
      border: 1px solid rgba(141, 228, 209, .9); border-radius: 999px;
      background: linear-gradient(145deg, rgba(235, 247, 250, .96), rgba(10, 31, 47, .96));
      box-shadow: 0 5px 18px rgba(0,0,0,.55), 0 0 0 3px rgba(7,35,43,.72);
      backdrop-filter: blur(5px);
    }
    img {
      width: 100%; height: 100%; object-fit: contain; border-radius: 999px;
      filter: drop-shadow(0 1px 0 rgba(255,255,255,.75)) drop-shadow(0 2px 3px rgba(0,0,0,.85));
    }
  `
})
export class ManufacturerBadgeComponent {
  readonly imageUrl = input.required<string>();
  readonly brand = input('');
}
