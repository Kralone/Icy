import { Component, ElementRef, EventEmitter, Output, Renderer2 } from '@angular/core';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css']
})
export class TopbarComponent {
  @Output() sidebarToggle = new EventEmitter<void>();

  name = 'Cmdr Unknown';
  isDarkMode = false;
  isHidden = false;
  isDesktop = false; // ✅ détecte les écrans larges
  lastScrollY = 0;
  private scrollListener: (() => void) | null = null;

  constructor(private renderer: Renderer2, private el: ElementRef, private authService: AuthService) {}

  ngOnInit(): void {
    this.checkViewport();
    window.addEventListener('resize', () => this.checkViewport());

    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'enabled') {
      this.isDarkMode = true;
      this.renderer.addClass(document.body, 'dark');
    }

    const rawUsername = this.authService.getCurrentUser();
    const cleanUsername = rawUsername.replace(/^"|"$/g, '');
    this.name = `CMDR ${cleanUsername}`;
  }

  ngAfterViewInit(): void {
    const scrollableElement = document.querySelector('.main-content');
    if (scrollableElement) {
      this.scrollListener = this.renderer.listen(scrollableElement, 'scroll', () => {
        const currentScrollY = scrollableElement.scrollTop;
        const diff = currentScrollY - this.lastScrollY;
        this.isHidden = diff > 5 ? true : diff < -5 ? false : this.isHidden;
        this.lastScrollY = currentScrollY;
      });
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

  /** ✅ Émet vers Layout pour ouvrir/fermer la sidebar */
  onToggleSidebar(): void {
    this.sidebarToggle.emit();
  }

  /** ✅ Vérifie la taille de l'écran */
  private checkViewport(): void {
    this.isDesktop = window.innerWidth >= 1280; // breakpoint XL
  }
}
