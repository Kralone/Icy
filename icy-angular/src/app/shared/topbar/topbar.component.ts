import { Component, ElementRef, EventEmitter, HostListener, NgZone, Output, Renderer2, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { NotificationService, NotificationItem } from '../../core/services/notification/notification.service';
import { PushNotificationService } from '../../core/services/notification/push-notification.service';
import { WebSocketService } from '../../core/services/websocket/websocket.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { UserService } from '../../core/services/user/user.service';
import { RankOrbitComponent } from '../rank-orbit/rank-orbit.component';

type StatusKey = 'connecte' | 'enjeu' | 'absent' | 'indisponible' | 'horsligne';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RankOrbitComponent],
  templateUrl: './topbar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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

  statusOptions: { key: Exclude<StatusKey, 'horsligne'>; label: string; badgeClass: string }[] = [
    { key: 'connecte', label: 'Connecté', badgeClass: 'border-emerald-400/60 bg-emerald-400/40 text-emerald-200' },
    { key: 'enjeu', label: 'En jeu', badgeClass: 'border-violet-400/70 bg-violet-400/45 text-violet-200' },
    { key: 'absent', label: 'Absent', badgeClass: 'border-amber-400/60 bg-amber-400/40 text-amber-200' },
    { key: 'indisponible', label: 'Indisponible', badgeClass: 'border-rose-400/60 bg-rose-400/40 text-rose-200' }
  ];
  statusBadgeClasses: Record<StatusKey, string> = {
    connecte: 'border-emerald-400/60 bg-emerald-400/40 text-emerald-200',
    enjeu: 'border-violet-400/70 bg-violet-400/45 text-violet-200',
    absent: 'border-amber-400/60 bg-amber-400/40 text-amber-200',
    indisponible: 'border-rose-400/60 bg-rose-400/40 text-rose-200',
    horsligne: 'border-slate-400/60 bg-slate-400/40 text-slate-200'
  };
  currentStatus: StatusKey = 'connecte';
  avatarUrl: string | null = null;
  activeRankKey = 'JUNIOR';
  private readonly rankAliases: Record<string, string> = {
    USER: 'JUNIOR',
    MEMBRE: 'JUNIOR',
    RECRUE: 'JUNIOR'
  };
  private readonly availableRanks = ['ADMIN', 'OFFICIER', 'SPECIALISTE', 'INGENIEUR', 'ASSOCIE', 'JUNIOR'];

  constructor(
    private renderer: Renderer2,
    private el: ElementRef,
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    private notificationService: NotificationService,
    private pushNotifications: PushNotificationService,
    private websocketService: WebSocketService,
    private toast: HotToastService,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.checkViewport();
    window.addEventListener('resize', () => this.checkViewport());

    const rawUsername = this.authService.getCurrentUser() ?? 'Unknown';
    const cleanUsername = rawUsername.replace(/^"|"$/g, '');
    this.name = `CMDR ${cleanUsername}`;

    this.userService.profile$.subscribe((profile) => {
      if (profile?.status && this.statusOptions.some((opt) => opt.key === profile.status)) {
        this.currentStatus = profile.status;
      }
      this.avatarUrl = profile?.avatarUrl ?? null;
      const roles = profile?.roles ?? [];
      this.activeRankKey = this.normalizeRank(roles[0]);
    });
    this.userService.getMyProfile().subscribe();

    this.notificationService.refreshFromStorage();
    this.notificationService.notifications$.subscribe((items) => {
      this.notifications = items;
      this.unreadCount = items.filter((item) => !item.read).length;
    });

    this.zone.runOutsideAngular(() => {
      try {
        const userId = this.authService.getUserIdFromToken();
        this.websocketService.connectNotifications(userId);
      } catch {
        this.websocketService.connectNotifications();
      }

      this.websocketService.listenForNotifications().subscribe((raw) => {
        this.zone.run(() => {
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
      });
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

  setStatus(status: StatusKey): void {
    this.currentStatus = status;
    this.userService.updateMyProfile({ status }).subscribe();
  }

  get statusBadgeClass(): string {
    return this.statusBadgeClasses[this.currentStatus] ?? '';
  }

  get avatarInitial(): string {
    const raw = this.name.replace(/^CMDR\s+/i, '').trim();
    return raw ? raw.charAt(0).toUpperCase() : 'P';
  }

  handleAvatarLoadError(): void {
    this.avatarUrl = null;
  }

  private normalizeRank(role?: string | null): string {
    const normalized = (role ?? '').trim().toUpperCase();
    const mapped = this.rankAliases[normalized] ?? normalized;
    return this.availableRanks.includes(mapped) ? mapped : 'JUNIOR';
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
