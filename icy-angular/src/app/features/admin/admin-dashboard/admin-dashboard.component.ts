import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';


import { User } from '../../../model/user.model';
import { UserService } from '../../../core/services/user/user.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';
import { finalize } from 'rxjs';
import { PoleIconComponent } from '../../../shared/pole-icon/pole-icon.component';
import { AvailabilityHeatmapComponent } from '../../../shared/availability/availability-heatmap.component';
import { SPECIALIST_RANK, SPECIALTIES, TREASURER_ROLE, hasRole, memberRank, specialtyLabel } from '../../../core/services/user/member-rank';

export type MemberSortColumn = 'username' | 'role' | 'createdAt' | 'lastSeenAt';

function toTime(value?: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormsModule,
    DatePipe,
    PoleIconComponent,
    LoadingOverlayComponent,
    AvailabilityHeatmapComponent
]
})
export class AdminDashboardComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  paginatedUsers: User[] = [];

  /** Colonnes triables : nom, rôle (par rang), date de création et dernière connexion. */
  sortColumn: MemberSortColumn = 'username';
  sortAsc: boolean = true;
  readonly sortableColumns: { key: MemberSortColumn; label: string }[] = [
    { key: 'username', label: 'Nom' },
    { key: 'role', label: 'Rôle' },
    { key: 'createdAt', label: 'Compte créé' },
    { key: 'lastSeenAt', label: 'Dernière connexion' }
  ];

  currentPage: number = 1;
  itemsPerPage: number = 10;

  isLoading = true;
  loadError: string | null = null;
  searchTerm: string = '';
  showInactive = false;

  isAddUserModalOpen = false;

  isEditMode = false;
  editedUserId: string | null = null;

  newUser: {
    username: string;
    discordId: string;
    role: string;
    treasurer: boolean;
    /** Pôle du Spécialiste ; vide tant qu'aucun n'est choisi. */
    specialty: string;
  } = {
    username: '',
    discordId: '',
    role: 'JUNIOR',
    treasurer: false,
    specialty: ''
  };

  readonly specialistRank = SPECIALIST_RANK;
  readonly specialties = SPECIALTIES;
  readonly specialtyLabel = specialtyLabel;

  availableRoles: string[] = ['ADMIN', 'OFFICIER', 'SPECIALISTE', 'INGENIEUR', 'ASSOCIE', 'JUNIOR'];
  roleLabels: Record<string, string> = {
    ADMIN: 'Directeur',
    OFFICIER: 'Officier',
    SPECIALISTE: 'Spécialiste',
    INGENIEUR: 'Ingénieur',
    ASSOCIE: 'Associé',
    JUNIOR: 'Junior',
    USER: 'Junior',
    MEMBRE: 'Junior',
    RECRUE: 'Junior',
    BOT: 'Bot',
    TRESORIER: 'Trésorier'
  };
  roleAliases: Record<string, string> = {
    USER: 'JUNIOR',
    MEMBRE: 'JUNIOR',
    RECRUE: 'JUNIOR'
  };

  constructor(private userService: UserService, private authService: AuthService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.loadError = null;

    const usersRequest = this.showInactive
      ? this.userService.getInactiveUsers()
      : this.userService.getAllUsers();

    usersRequest.pipe(
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe({
      next: (response) => {
        this.users = response.data ?? [];
        this.filteredUsers = [...this.users];
        this.currentPage = 1;
        this.applyFilters();
      },
      error: (err) => {
        console.error('Erreur de chargement des utilisateurs :', err);
        this.users = [];
        this.filteredUsers = [];
        this.updatePagination();
        this.loadError = 'Impossible de charger les membres pour le moment.';
      }
    });
  }

  setInactiveView(showInactive: boolean): void {
    if (this.showInactive === showInactive) return;
    this.showInactive = showInactive;
    this.searchTerm = '';
    this.loadUsers();
  }

  // ==== Filters / Search ====
  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase().trim();

    this.filteredUsers = this.users.filter((user) =>
      (user.username ?? '').toLowerCase().includes(term)
    );

    this.sortUsers();
  }

  // ==== Sorting ====
  /** Un premier clic sur une date montre les plus récentes d'abord ; sur le nom ou le rôle, l'ordre croissant. */
  sortBy(column: MemberSortColumn): void {
    if (this.sortColumn === column) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = column;
      this.sortAsc = column === 'username' || column === 'role';
    }
    this.sortUsers();
  }

  ariaSort(column: MemberSortColumn): 'ascending' | 'descending' | 'none' {
    return this.sortColumn !== column ? 'none' : this.sortAsc ? 'ascending' : 'descending';
  }

  sortUsers(): void {
    const direction = this.sortAsc ? 1 : -1;
    this.filteredUsers.sort((a, b) => {
      const left = this.sortValue(a);
      const right = this.sortValue(b);
      // Une date absente reste en fin de liste, quel que soit le sens du tri.
      if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
      const compared = typeof left === 'string' && typeof right === 'string'
        ? left.localeCompare(right, 'fr', { sensitivity: 'base' })
        : (left as number) - (right as number);
      return (compared || (a.username ?? '').localeCompare(b.username ?? '', 'fr', { sensitivity: 'base' })) * direction;
    });

    this.updatePagination();
  }

  private sortValue(user: User): string | number | null {
    switch (this.sortColumn) {
      case 'role': return this.rankOrder(user);
      case 'createdAt': return toTime(user.createdAt);
      case 'lastSeenAt': return toTime(user.lastSeenAt);
      default: return user.username ?? '';
    }
  }

  /** Rang le plus élevé du membre : Directeur d'abord. */
  private rankOrder(user: User): number {
    const ranks = (user.roles ?? []).map(role => this.availableRoles.indexOf(this.roleAliases[role?.toUpperCase()] ?? role?.toUpperCase())).filter(index => index >= 0);
    return ranks.length ? Math.min(...ranks) : this.availableRoles.length;
  }

  // ==== Pagination ====
  onPageSizeChange(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    const pages = this.totalPages;
    if (this.currentPage > pages) {
      this.currentPage = Math.max(1, pages);
    }

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(start, end);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.itemsPerPage));
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  // ==== Modal helpers ====
  closeModal(): void {
    this.isAddUserModalOpen = false;
    this.resetForm();
  }

  resetForm(): void {
    this.newUser = {
      username: '',
      discordId: '',
      role: 'JUNIOR',
      treasurer: false,
      specialty: ''
    };
    this.isEditMode = false;
    this.editedUserId = null;
  }

  // ==== CRUD actions ====
  addUser(): void {
    if (!this.newUser.username || !this.newUser.discordId || !this.newUser.role || this.specialtyMissing) return;

    this.userService.createUser(this.newUser.username, this.newUser.discordId, this.newUser.role, this.selectedSpecialty).subscribe({
      next: () => {
        this.closeModal();
        this.loadUsers();
      },
      error: (err) => {
        console.error(err);
        alert("Échec de l'ajout.");
      }
    });
  }

  editUser(user: User): void {
    this.newUser = {
      username: user.username,
      discordId: user.discordId,
      role: this.normalizeRole(memberRank(user.roles)),
      treasurer: hasRole(user.roles, TREASURER_ROLE),
      specialty: specialtyLabel(user.specialty) ? (user.specialty ?? '').toUpperCase() : ''
    };

    this.editedUserId = user.id;
    this.isEditMode = true;
    this.isAddUserModalOpen = true;
  }

  updateUser(): void {
    if (!this.editedUserId || this.specialtyMissing) return;

    const payload = {
      id: this.editedUserId,
      username: this.newUser.username,
      discordId: this.newUser.discordId,
      role: this.newUser.role,
      treasurer: this.newUser.treasurer,
      specialty: this.selectedSpecialty
    };

    this.userService.updateUser(payload).subscribe({
      next: () => {
        this.closeModal();
        this.loadUsers();
      },
      error: (err) => {
        console.error('Erreur lors de la mise à jour', err);
        alert('Échec de la mise à jour');
      }
    });
  }

  /** Le pôle n'est envoyé que pour un Spécialiste : il n'existe pas pour les autres grades. */
  get selectedSpecialty(): string | null {
    return this.newUser.role === SPECIALIST_RANK && this.newUser.specialty ? this.newUser.specialty : null;
  }

  get selectedSpecialtyDescription(): string | null {
    return SPECIALTIES.find(pole => pole.key === this.selectedSpecialty)?.description ?? null;
  }

  get specialtyMissing(): boolean {
    return this.newUser.role === SPECIALIST_RANK && !this.newUser.specialty;
  }

  /** Grade du membre, celui qui est mis en avant dans la liste. */
  rankLabel(user: User): string {
    const rank = this.normalizeRole(memberRank(user.roles));
    return this.roleLabels[rank] ?? rank;
  }

  /** Clé du grade, qui choisit sa couleur dans la liste. */
  rankKey(user: User): string {
    return this.normalizeRole(memberRank(user.roles));
  }

  /** Ce qui précise le grade, affiché en petit dessous : le pôle du Spécialiste, puis la fonction de trésorier. */
  rankDetails(user: User): { key: string; label: string; testId: string }[] {
    const details: { key: string; label: string; testId: string }[] = [];
    const pole = specialtyLabel(user.specialty);
    if (pole && memberRank(user.roles) === SPECIALIST_RANK) {
      details.push({ key: (user.specialty ?? '').trim().toUpperCase(), label: pole, testId: 'member-specialty' });
    }
    if (hasRole(user.roles, TREASURER_ROLE)) {
      details.push({ key: TREASURER_ROLE, label: this.roleLabels[TREASURER_ROLE], testId: 'member-function' });
    }
    return details;
  }

  private normalizeRole(role?: string | null): string {
    const resolved = (role ?? 'JUNIOR').toUpperCase();
    const normalized = this.roleAliases[resolved] ?? resolved;
    return this.availableRoles.includes(normalized) ? normalized : 'JUNIOR';
  }

  deleteUser(id: string): void {
    if (!confirm('Es-tu sûr de vouloir supprimer cet utilisateur ?')) return;

    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.loadUsers();
      },
      error: (err) => {
        console.error('Erreur de suppression', err);
        alert('Échec de la suppression');
      }
    });
  }

  reactivateUser(user: User): void {
    if (!confirm(`Réactiver le compte de ${user.username} ?`)) return;

    this.userService.reactivateUser(user.id).subscribe({
      next: () => this.loadUsers(),
      error: (err) => {
        console.error('Erreur de réactivation', err);
        alert('Échec de la réactivation');
      }
    });
  }

  resetPassword(userId: string): void {
    this.authService.forceResetPassword(userId).subscribe({
      next: () => {
        alert('Mot de passe temporaire envoyé sur Discord.');
      },
      error: (err) => {
        console.error(err);
        alert('Échec de la réinitialisation.');
      }
    });
  }
}
