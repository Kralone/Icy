import { Component } from '@angular/core';
import {FadeInOnScrollDirective} from "../../../../directives/fade-in-on-scroll.directive";
import {CommonModule, NgForOf} from "@angular/common";
import strings from '../../../../../assets/i18n/front.json';

@Component({
  selector: 'front-story',
  imports: [
    FadeInOnScrollDirective,
    CommonModule
  ],
  templateUrl: './story.component.html',
  styleUrl: './story.component.css'
})
export class StoryComponent {
  isDesktop = window.innerWidth >= 1024;
  staggeredImages: string[] = [];
  strings = strings.story;

  ngOnInit(): void {
    this.loadStagger();
    window.addEventListener('resize', () => {
      this.isDesktop = window.innerWidth >= 1024;
    });
  }

  private loadStagger() {
    const basePath = 'assets/images/home/stagger/';
    const count = 4; // nombre d’images dans le dossier
    this.staggeredImages = Array.from({ length: count }, (_, i) => `${basePath}img${i + 1}.jpg`);
  }

  getTopOffset(i: number): number {
    return window.innerWidth < 640 ? i * 100 : i * 160;
  }
}
