import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserService } from '../../core/services/user/user.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { forkJoin, of } from 'rxjs';
import { ShipSelectorComponent } from '../../shared/ship-selector/ship-selector.component';
import { Ship } from '../../model/ship.model';
import { AcquisitionType } from '../../shared/ship-selector/ship-selector.component';

type StatusKey = 'connecte' | 'enjeu' | 'absent' | 'indisponible' | 'horsligne';

interface StatusOption {
  key: StatusKey;
  label: string;
  badgeClass: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ShipSelectorComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  statusOptions: StatusOption[] = [
    { key: 'connecte', label: 'Connecté', badgeClass: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' },
    { key: 'enjeu', label: 'En jeu', badgeClass: 'border-violet-400/30 bg-violet-400/10 text-violet-200' },
    { key: 'absent', label: 'Absent', badgeClass: 'border-amber-400/30 bg-amber-400/10 text-amber-200' },
    { key: 'indisponible', label: 'Indisponible', badgeClass: 'border-rose-400/30 bg-rose-400/10 text-rose-200' }
  ];
  statusLabels: Record<StatusKey, string> = {
    connecte: 'Connecté',
    enjeu: 'En jeu',
    absent: 'Absent',
    indisponible: 'Indisponible',
    horsligne: 'Hors ligne'
  };
  statusClasses: Record<StatusKey, string> = {
    connecte: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    enjeu: 'border-violet-400/30 bg-violet-400/10 text-violet-200',
    absent: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    indisponible: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    horsligne: 'border-slate-400/30 bg-slate-400/10 text-slate-200'
  };

  profile = {
    username: 'Pilote',
    description: 'Explorateur glaciaire, fan de missions à haut risque.',
    status: 'connecte' as StatusKey,
    discordId: '',
    favoriteShip: '',
    avatarUrl: '',
    notifications: {
      global: true,
      events: true,
      fleet: false,
      goals: true,
      discord: false
    }
  };

  isShipModalOpen = false;
  favoriteShipImageUrl = '';
  pendingDescription = '';
  pendingAvatarFile: File | null = null;
  pendingAvatarPreview = '';
  isSavingProfile = false;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private toast: HotToastService
  ) {}

  ngOnInit(): void {
    const rawUsername = this.authService.getCurrentUser();
    if (rawUsername) {
      this.profile.username = rawUsername.replace(/^"|"$/g, '');
    }

    this.userService.getMyProfile().subscribe((response) => {
      const data = response.data;
      if (!data) return;
      this.profile.username = data.username ?? this.profile.username;
      this.profile.description = data.description ?? this.profile.description;
      this.pendingDescription = this.profile.description;
      this.profile.discordId = data.discordId ?? this.profile.discordId;
      this.profile.status = (data.status as StatusKey) ?? this.profile.status;
      this.profile.avatarUrl = data.avatarUrl ?? this.profile.avatarUrl;
      this.pendingAvatarPreview = '';
      this.pendingAvatarFile = null;
      if (data.favoriteShip) {
        this.profile.favoriteShip = data.favoriteShip.name;
        this.favoriteShipImageUrl = data.favoriteShip.imageUrl ?? '';
      }
      if (data.notifications) {
        this.profile.notifications = {
          global: data.notifications.global,
          events: data.notifications.events,
          fleet: data.notifications.fleet,
          goals: data.notifications.goals,
          discord: data.notifications.discord
        };
      }
    });
  }

  get discordUrl(): string | null {
    if (!this.profile.discordId) return null;
    return `https://discord.com/users/${encodeURIComponent(this.profile.discordId)}`;
  }

  get activeStatusLabel(): string {
    return this.statusLabels[this.profile.status] ?? 'Statut';
  }

  get activeStatusClass(): string {
    return this.statusClasses[this.profile.status] ?? '';
  }

  get avatarInitials(): string {
    const value = (this.profile.username || 'P').trim();
    return value.charAt(0).toUpperCase();
  }

  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const maxSize = 1_000_000;
    if (file.size > maxSize) {
      this.toast.error('Image trop lourde. Taille max: 1 Mo.');
      input.value = '';
      return;
    }

    this.pendingAvatarFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.pendingAvatarPreview = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  setStatus(status: StatusKey): void {
    this.profile.status = status;
    this.userService.updateMyProfile({ status }).subscribe();
  }

  openFavoriteShipModal(): void {
    this.isShipModalOpen = true;
  }

  onFavoriteShipSelected(payload: { ship: Ship | null; acquisitionType?: AcquisitionType }): void {
    if (!payload.ship) return;
    this.profile.favoriteShip = payload.ship.name;
    this.favoriteShipImageUrl = payload.ship.imageUrl || '';
    this.userService.updateMyProfile({ favoriteShipId: payload.ship.id }).subscribe();
    this.isShipModalOpen = false;
  }

  saveProfileInfo(): void {
    if (this.isSavingProfile || !this.hasProfileChanges) return;
    const requests = [];

    if (this.pendingAvatarFile) {
      requests.push(this.userService.uploadMyAvatar(this.pendingAvatarFile));
    }

    if (this.pendingDescription !== this.profile.description) {
      requests.push(this.userService.updateMyProfile({ description: this.pendingDescription }));
    }

    if (!requests.length) return;

    this.isSavingProfile = true;
    forkJoin(requests).subscribe({
      next: () => {
        this.profile.description = this.pendingDescription;
        this.pendingAvatarFile = null;
        this.pendingAvatarPreview = '';
        this.toast.success('Profil mis a jour.');
      },
      error: (err) => {
        const message = err?.error?.messageDetail?.message || 'Mise a jour impossible.';
        this.toast.error(message);
      },
      complete: () => {
        this.isSavingProfile = false;
      }
    });
  }

  get hasProfileChanges(): boolean {
    return (
      this.pendingAvatarFile !== null ||
      this.pendingDescription !== this.profile.description
    );
  }
}
