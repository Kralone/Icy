import { ScrollAnimationDirective } from '../../../directives/scroll-animation.directive';
import {CommonModule} from '@angular/common';
import {Component} from '@angular/core';
import {FadeInOnScrollDirective} from '../../../directives/fade-in-on-scroll.directive';
import {ParallaxDirective} from '../../../directives/parallax.directive';
import {HeaderComponent} from './header/header.component';
import {StoryComponent} from './story/story.component';
import {ActivitiesComponent} from './activities/activities.component';
import {CarousselComponent} from './caroussel/caroussel.component';
import {OnlineMembersComponent} from './online-members/online-members.component';
import { PublicUtilsComponent } from './public-utils/public-utils.component';
import strings from '../../../../assets/i18n/front.json';


@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [CommonModule, HeaderComponent, OnlineMembersComponent, StoryComponent, ActivitiesComponent, CarousselComponent, PublicUtilsComponent]
})
export class HomeComponent {
  strings = strings.home;
}
