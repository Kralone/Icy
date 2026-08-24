import { Component, ChangeDetectionStrategy } from '@angular/core';

import strings from '../../../../../assets/i18n/front.json';

@Component({
  selector: 'front-carousel',
    imports: [],
  templateUrl: './caroussel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './caroussel.component.css'
})
export class CarousselComponent {
  strings = strings.carousel;
  carouselImages: string[] = [];

  ngOnInit(): void {
    this.loadCarouselImages();
  }

  private loadCarouselImages(): void {
    const basePath = 'assets/images/home/carousel/';
    const count = 8; // nombre d’images dans le dossier
    this.carouselImages = Array.from({ length: count }, (_, i) => `${basePath}img${i + 1}.jpg`);
  }

}
