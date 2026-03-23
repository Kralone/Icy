import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth/auth.service';
import { UserService } from '../../core/services/user/user.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { forkJoin } from 'rxjs';
import { ShipSelectorComponent } from '../../shared/ship-selector/ship-selector.component';
import { RankOrbitComponent } from '../../shared/rank-orbit/rank-orbit.component';
import { LoadingOverlayComponent } from '../../shared/loading-overlay/loading-overlay.component';
import { Ship } from '../../model/ship.model';
import { AcquisitionType } from '../../shared/ship-selector/ship-selector.component';

type StatusKey = 'connecte' | 'enjeu' | 'absent' | 'indisponible' | 'horsligne';

interface StatusOption {
  key: StatusKey;
  label: string;
  badgeClass: string;
}
interface RankOption {
  key: string;
  label: string;
}
type ProfileTabId = 'profile' | 'ranks' | 'settings';

interface ProfileTabOption {
  id: ProfileTabId;
  label: string;
  subtitle: string;
}

interface RankGuideEntry {
  level: number;
  key: string;
  label: string;
  currentHolder?: string;
  description: string;
  privileges: string[];
  howToUnlock: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ShipSelectorComponent, RankOrbitComponent, LoadingOverlayComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  profileTabs: ProfileTabOption[] = [
    { id: 'profile', label: 'Profil', subtitle: 'Identite et stats' },
    { id: 'ranks', label: 'Guide des rangs', subtitle: 'Hierarchie IceForge' },
    { id: 'settings', label: 'Parametres', subtitle: 'Notifications et options' }
  ];
  activeTab: ProfileTabId = 'profile';

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
  rankOptions: RankOption[] = [
    { key: 'ADMIN', label: 'Directeur' },
    { key: 'OFFICIER', label: 'Officier' },
    { key: 'SPECIALISTE', label: 'Spécialiste' },
    { key: 'INGENIEUR', label: 'Ingénieur' },
    { key: 'ASSOCIE', label: 'Associé' },
    { key: 'JUNIOR', label: 'Junior' }
  ];
  roleAliases: Record<string, string> = {
    USER: 'JUNIOR',
    MEMBRE: 'JUNIOR',
    RECRUE: 'JUNIOR'
  };
  rankGuide: RankGuideEntry[] = [
    {
      level: 1,
      key: 'JUNIOR',
      label: 'Junior',
      description:
        "Nouveau membre de l'organisation. Tu commences ton aventure dans IceForge en participant aux operations et en apprenant les fondamentaux de la corpo.",
      privileges: ['Acces aux missions de base', 'Canaux Discord generaux', 'Flotte partagee en soutien'],
      howToUnlock: "Attribue automatiquement a l'arrivée dans la corpo."
    },
    {
      level: 2,
      key: 'ASSOCIE',
      label: 'Associe',
      currentHolder: 'HollowMike',
      description:
        "Membre actif qui a deja fait ses preuves. Tu participes a des missions plus complexes et commences a prendre des initiatives operationnelles.",
      privileges: [
        'Missions intermediaires',
        'Canaux strategiques Discord',
        'Invitation a des ops privees',
        'Droit de vote sur les decisions non critiques'
      ],
      howToUnlock: "Sur recommandation d'un Officier ou apres 10 operations completees."
    },
    {
      level: 3,
      key: 'INGENIEUR',
      label: 'Ingenieur',
      description:
        'Specialiste technique de la corpo. Tu maitrises les systemes de vaisseaux, la logistique ou le combat et tu aides les profils plus juniors.',
      privileges: [
        'Toutes les missions standards',
        'Acces a la flotte avancee',
        'Role de soutien technique en operation',
        'Channel ingenierie Discord'
      ],
      howToUnlock: "Sur evaluation des competences techniques par un Officier."
    },
    {
      level: 4,
      key: 'SPECIALISTE',
      label: 'Specialiste',
      description:
        "Expert reconnu dans son domaine. Tu encadres regulierement des membres moins experimentes et prends des responsabilites tactiques.",
      privileges: [
        'Toutes les missions',
        "Role de chef d'escouade",
        'Briefings pre-op',
        'Channel Specialistes Discord',
        'Participation aux votes strategiques'
      ],
      howToUnlock: "Sur nomination d'un Officier, apres validation de l'expertise."
    },
    {
      level: 5,
      key: 'OFFICIER',
      label: 'Officier',
      currentHolder: 'Draknyr, Professeur Zero',
      description:
        "Pilier de l'organisation. Tu planifies les grandes operations, pilotes le recrutement et representes la corpo a l'extérieur.",
      privileges: [
        'Tous les acces',
        "Commandement d'opérations",
        'Recrutement et evaluation des membres',
        'Channel Officiers (confidentiel)',
        'Co-decision sur les alliances'
      ],
      howToUnlock: 'Nomination directe par le Directeur.'
    },
    {
      level: 6,
      key: 'ADMIN',
      label: 'Directeur',
      currentHolder: 'Kralone (Fondateur)',
      description:
        "Fondateur et commandant supreme d'IceForge. Le Directeur definit la vision strategique, les alliances, les regles et l'identité de la corporation.",
      privileges: [
        'Acces total et illimite',
        'Controle de toutes les ressources',
        'Decision finale sur tous les sujets',
        'Administration du site et des outils',
        'Relations diplomatiques inter-orgs'
      ],
      howToUnlock: 'Rang fondateur, unique.'
    }
  ];

  profile = {
    username: 'Pilote',
    description: 'Une petite description qui en dit long sur vous...',
    status: 'connecte' as StatusKey,
    discordId: '',
    roles: [] as string[],
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
  quickStats = {
    missions: 0,
    events: 0,
    ships: 0,
    collections: 0
  };

  profileLoaded = false;
  dataReady = false;
  pendingProfile = true;
  pendingStats = true;
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

    this.userService.getMyProfile().subscribe({
      next: (response) => {
        const data = response.data;
        if (!data) {
        this.pendingProfile = false;
        this.updateReadyState();
        return;
      }
        this.profile.username = data.username ?? this.profile.username;
        this.profile.description = data.description ?? this.profile.description;
        this.pendingDescription = this.profile.description;
        this.profile.discordId = data.discordId ?? this.profile.discordId;
        this.profile.status = (data.status as StatusKey) ?? this.profile.status;
        this.profile.avatarUrl = data.avatarUrl ?? this.profile.avatarUrl;
        this.profile.roles = data.roles ?? this.profile.roles;
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
        this.pendingProfile = false;
        this.updateReadyState();
      },
      error: () => {
        this.pendingProfile = false;
        this.updateReadyState();
      }
    });

    this.userService.getMyQuickStats().subscribe({
      next: (response) => {
        if (!response.data) {
          this.pendingStats = false;
          this.updateReadyState();
          return;
        }
        this.quickStats = response.data;
        this.pendingStats = false;
        this.updateReadyState();
      },
      error: () => {
        this.quickStats = {
          missions: 0,
          events: 0,
          ships: 0,
          collections: 0
        };
        this.pendingStats = false;
        this.updateReadyState();
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

  get activeRankKey(): string {
    const roles = this.profile.roles ?? [];
    const normalized = roles
      .map((role) => (role ?? '').toUpperCase())
      .map((role) => this.roleAliases[role] ?? role);
    const matched = this.rankOptions.find((rank) => normalized.includes(rank.key));
    return matched?.key ?? 'JUNIOR';
  }

  get activeRankLabel(): string {
    const matched = this.rankOptions.find((rank) => rank.key === this.activeRankKey);
    return matched?.label ?? 'Junior';
  }

  get activeGuideRank(): RankGuideEntry | null {
    const matched = this.rankGuide.find((rank) => rank.key === this.activeRankKey);
    return matched ?? null;
  }

  setActiveTab(tab: ProfileTabId): void {
    this.activeTab = tab;
  }

  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const maxSize = 2_000_000;
    if (file.size > maxSize) {
      this.toast.error('Image trop lourde. Taille max: 2 Mo.');
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
    let avatarRequestIndex = -1;

    if (this.pendingAvatarFile) {
      avatarRequestIndex = requests.push(this.userService.uploadMyAvatar(this.pendingAvatarFile)) - 1;
    }

    if (this.pendingDescription !== this.profile.description) {
      requests.push(this.userService.updateMyProfile({ description: this.pendingDescription }));
    }

    if (!requests.length) return;

    this.isSavingProfile = true;
    forkJoin(requests).subscribe({
      next: (responses) => {
        if (avatarRequestIndex >= 0) {
          const avatarResponse = responses[avatarRequestIndex] as any;
          const avatarUrl = avatarResponse?.data?.avatarUrl ?? '';
          if (avatarUrl) {
            this.profile.avatarUrl = avatarUrl;
          }
        }
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

  private updateReadyState(): void {
    if (!this.pendingProfile && !this.pendingStats) {
      this.dataReady = true;
    }
  }
}
