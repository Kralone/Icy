import { Component } from '@angular/core';
import {ScrollAnimationDirective} from '../../../../directives/scroll-animation.directive';
import strings from '../../../../../assets/i18n/front.json';

@Component({
  selector: 'front-activities',
  imports: [
    ScrollAnimationDirective
  ],
  templateUrl: './activities.component.html',
  styleUrl: './activities.component.css'
})
export class ActivitiesComponent {
  strings = strings.activities;
}
