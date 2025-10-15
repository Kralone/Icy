import {Component, ElementRef, HostListener, Renderer2} from '@angular/core';
import {AuthService} from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css']
})
export class TopbarComponent {
  name = 'Cmdr Unknown'
  isDarkMode = false;
  private scrollListener: (() => void) | null = null;
  lastScrollY: number = 0;
  isHidden: boolean = false; // ✅ État de la topbar

  constructor(private renderer: Renderer2, private el: ElementRef, private authService: AuthService) {}

  ngAfterViewInit(): void {
    const scrollableElement = document.querySelector('.main-content');

    if (scrollableElement) {
      this.scrollListener = this.renderer.listen(scrollableElement, 'scroll', () => {
        const currentScrollY = scrollableElement.scrollTop;
        const scrollDifference = currentScrollY - this.lastScrollY;

        if (scrollDifference > 5) {
          this.isHidden = true; // ✅ Cache la topbar
        } else if (scrollDifference < -5) {
          this.isHidden = false; // ✅ Ré-affiche la topbar
        }

        this.lastScrollY = currentScrollY;
      });
    } else {
      console.warn("⚠️ Aucun élément .main-content trouvé !");
    }
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      this.scrollListener();
      this.scrollListener = null;
    }
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;

    if (this.isDarkMode) {
      this.renderer.addClass(document.body, 'dark');
      localStorage.setItem('darkMode', 'enabled');
    } else {
      this.renderer.removeClass(document.body, 'dark');
      localStorage.setItem('darkMode', 'disabled');
    }
  }

  ngOnInit(): void {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'enabled') {
      this.isDarkMode = true;
      this.renderer.addClass(document.body, 'dark');
    }

    const rawUsername = this.authService.getCurrentUser();

    const cleanUsername = rawUsername.replace(/^"|"$/g, '');

    this.name = `CMDR ${cleanUsername}`;

    console.log(this.name);
  }
}
