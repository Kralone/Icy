import { Component } from '@angular/core';
import strings from '../../../../../assets/i18n/front.json';
import {Router, RouterLink} from '@angular/router';

@Component({
  selector: 'front-header',
  imports: [
    RouterLink
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  strings = strings.header;

  constructor(private router: Router) {
  }

  goToRecruitment() {
    this.router.navigate(['/recrutement']);
  }
}
