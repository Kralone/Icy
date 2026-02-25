import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-collection-hero',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './collection-hero.component.html',
})
export class CollectionHeroComponent {
  @Input() showAdmin = false;
}
