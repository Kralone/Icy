import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';


import { User } from '../../../model/user.model';
import { UserService } from '../../../core/services/user/user.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';
import { finalize } from 'rxjs';

export type MemberSortColumn = 'username' | 'role' | 'createdAt' | 'lastSeenAt';

function toTime(value?: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormsModule,
    DatePipe,
    LoadingOverlayComponent
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
  } = {
    username: '',
    discordId: '',
    role: 'JUNIOR'
  };

  availableRoles: string[] = ['ADMIN', 'OFFICIER', 'SPECIALISTE', 'INGENIEUR', 'ASSOCIE', 'JUNIOR'];
  roleLabels: Record<string, string> = {
    ADMIN: 'Directeur',
    OFFICIER: 'Officier',
    SPECIALISTE: 'Specialiste',
    INGENIEUR: 'Ingenieur',
    ASSOCIE: 'Associe',
    JUNIOR: 'Junior',
    USER: 'Junior',
    MEMBRE: 'Junior',
    RECRUE: 'Junior',
    BOT: 'Bot'
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
      role: 'JUNIOR'
    };
    this.isEditMode = false;
    this.editedUserId = null;
  }

  // ==== CRUD actions ====
  addUser(): void {
    if (!this.newUser.username || !this.newUser.discordId || !this.newUser.role) return;

    this.userService.createUser(this.newUser.username, this.newUser.discordId, this.newUser.role).subscribe({
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
      role: this.normalizeRole(user.roles?.[0])
    };

    this.editedUserId = user.id;
    this.isEditMode = true;
    this.isAddUserModalOpen = true;
  }

  updateUser(): void {
    if (!this.editedUserId) return;

    const payload = {
      id: this.editedUserId,
      username: this.newUser.username,
      discordId: this.newUser.discordId,
      role: this.newUser.role
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
