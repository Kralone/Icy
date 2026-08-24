import { Component } from '@angular/core';
import {FadeInOnScrollDirective} from "../../../../directives/fade-in-on-scroll.directive";

import strings from '../../../../../assets/i18n/front.json';

@Component({
  selector: 'front-story',
  imports: [
    FadeInOnScrollDirective
],
  templateUrl: './story.component.html',
  styleUrl: './story.component.css'
})
export class StoryComponent {
  staggeredImages: string[] = [];
  strings = strings.story;

  ngOnInit(): void {
    this.loadStagger();
  }

  private loadStagger() {
    const basePath = 'assets/images/home/stagger/';
    const count = 4; // nombre d’images dans le dossier
    this.staggeredImages = Array.from({ length: count }, (_, i) => `${basePath}img${i + 1}.webp`);
  }
}
