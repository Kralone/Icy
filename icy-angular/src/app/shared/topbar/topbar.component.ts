import { Component, ElementRef, EventEmitter, HostListener, Output, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { NotificationService, NotificationItem } from '../../core/services/notification/notification.service';
import { PushNotificationService } from '../../core/services/notification/push-notification.service';
import { WebSocketService } from '../../core/services/websocket/websocket.service';
import { HotToastService } from '@ngxpert/hot-toast';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css']
})
export class TopbarComponent {
  @Output() sidebarToggle = new EventEmitter<void>();

  name = 'Cmdr Unknown';
  isHidden = false;
  isDesktop = false; // ✅ détecte les écrans larges
  lastScrollY = 0;
  private scrollListener: (() => void) | null = null;
  showNotifications = false;
  notifications: NotificationItem[] = [];
  unreadCount = 0;
  pushSupported = false;
  pushEnabled = false;
  pushPermission: NotificationPermission = 'default';
  pushStateMessage = '';
  localFallbackEnabled = false;
  private readonly isOpera = typeof navigator !== 'undefined' && navigator.userAgent.includes('OPR/');

  constructor(
    private renderer: Renderer2,
    private el: ElementRef,
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService,
    private pushNotifications: PushNotificationService,
    private websocketService: WebSocketService,
    private toast: HotToastService
  ) {}

  ngOnInit(): void {
    this.checkViewport();
    window.addEventListener('resize', () => this.checkViewport());

    const rawUsername = this.authService.getCurrentUser();
    const cleanUsername = rawUsername.replace(/^"|"$/g, '');
    this.name = `CMDR ${cleanUsername}`;

    this.notificationService.refreshFromStorage();
    this.notificationService.notifications$.subscribe((items) => {
      this.notifications = items;
      this.unreadCount = items.filter((item) => !item.read).length;
    });

    try {
      const userId = this.authService.getUserIdFromToken();
      this.websocketService.connectNotifications(userId);
    } catch {
      this.websocketService.connectNotifications();
    }
    this.websocketService.listenForNotifications().subscribe((raw) => {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed) return;
        const rawPriority = parsed.priority ?? parsed?.data?.priority ?? 2;
        const priority = Number.isFinite(Number(rawPriority)) ? Number(rawPriority) : 2;
        if (priority >= 2) {
          this.pushNotifications.playInAppSound();
        }
        if (priority >= 3) {
          const title = parsed.title ?? 'Notification';
          const body = parsed.body ?? '';
          const message = body ? `${title} — ${body}` : title;
          this.toast.show(message, { duration: 5000 });
        }
        this.notificationService.add({
          id: crypto.randomUUID(),
          title: parsed.title ?? 'Notification',
          body: parsed.body ?? '',
          createdAt: new Date(),
          read: false,
          priority,
          link: parsed.url ?? undefined,
        });
      } catch {
        // ignore malformed notifications
      }
    });

    this.refreshPushState();
    this.autoEnablePush();
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

  /** ✅ Émet vers Layout pour ouvrir/fermer la sidebar */
  onToggleSidebar(): void {
    this.sidebarToggle.emit();
  }

  /** ✅ Vérifie la taille de l'écran */
  private checkViewport(): void {
    this.isDesktop = window.innerWidth >= 1280; // breakpoint XL
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    if (this.showNotifications) {
      this.showNotifications = false;
      this.markAllRead();
      return;
    }
    this.showNotifications = true;
    this.autoEnablePush();
  }

  markAllRead(): void {
    this.notificationService.markAllRead();
  }

  openNotification(notification: NotificationItem): void {
    this.notificationService.markRead(notification.id);
    if (notification.link) {
      const target = notification.link.startsWith('http')
        ? notification.link
        : notification.link.startsWith('/')
          ? notification.link
          : `/${notification.link}`;

      if (target.startsWith('http')) {
        window.location.href = target;
      } else {
        this.router.navigateByUrl(target);
      }
    }
    this.showNotifications = false;
  }

  deleteNotification(event: MouseEvent, notification: NotificationItem): void {
    event.stopPropagation();
    this.notificationService.remove(notification.id);
  }

  async enablePush(): Promise<void> {
    try {
      await this.pushNotifications.enable();
      this.refreshPushState();
    } catch (error: any) {
      this.refreshPushState();
      if (error?.message === 'PUSH_UNSUPPORTED') {
        this.pushStateMessage = 'Service worker inactif.';
      } else if (error?.message === 'SW_NOT_READY') {
        this.pushStateMessage = 'Service worker non enregistre.';
      } else if (error?.message === 'PERMISSION_TIMEOUT') {
        this.pushStateMessage = 'Permission non repondue.';
      } else if (error?.message === 'PERMISSION_DENIED') {
        this.pushStateMessage = 'Permission refusee par le navigateur.';
      } else if (error?.message === 'SUBSCRIBE_TIMEOUT') {
        if (this.isOpera) {
          this.pushNotifications.enableLocalFallback();
          this.localFallbackEnabled = true;
        }
      }
    }
  }

  async disablePush(): Promise<void> {
    try {
      await this.pushNotifications.disable();
      this.refreshPushState();
    } catch (error: any) {
      this.refreshPushState();
    }
  }

  private refreshPushState(): void {
    this.pushSupported = this.pushNotifications.isSupported();
    this.pushEnabled = this.pushNotifications.isEnabled();
    this.pushPermission = this.pushNotifications.permission;
    this.localFallbackEnabled = this.pushNotifications.isLocalFallbackEnabled();
  }

  private autoEnablePush(): void {
    if (!this.pushSupported) return;
    if (this.pushPermission === 'denied') return;
    if (this.pushEnabled || this.localFallbackEnabled) return;
    void this.enablePush();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      if (this.showNotifications) {
        this.showNotifications = false;
        this.markAllRead();
      }
    }
  }
}
