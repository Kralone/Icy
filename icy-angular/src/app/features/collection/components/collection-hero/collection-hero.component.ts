import { Component, Input } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-collection-hero',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './collection-hero.component.html',
})
export class CollectionHeroComponent {
  @Input() showAdmin = false;
}
