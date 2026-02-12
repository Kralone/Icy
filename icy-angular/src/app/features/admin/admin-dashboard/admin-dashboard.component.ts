import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { User } from '../../../model/user.model';
import { UserService } from '../../../core/services/user/user.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  imports: [
    FormsModule,
    CommonModule,
    LoadingOverlayComponent
  ]
})
export class AdminDashboardComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  paginatedUsers: User[] = [];

  sortColumn: keyof User = 'username';
  sortAsc: boolean = true;

  currentPage: number = 1;
  itemsPerPage: number = 10;

  isLoading = true;
  searchTerm: string = '';

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

    this.userService.getAllUsers().subscribe({
      next: (response) => {
        this.users = response.data ?? [];
        this.filteredUsers = [...this.users];
        this.currentPage = 1;
        this.applyFilters();
      },
      error: (err) => {
        console.error('Erreur de chargement des utilisateurs :', err);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
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
  sortBy(column: keyof User): void {
    if (this.sortColumn === column) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = column;
      this.sortAsc = true;
    }
    this.sortUsers();
  }

  sortUsers(): void {
    this.filteredUsers.sort((a: any, b: any) => {
      const aVal = (a?.[this.sortColumn] ?? '') as any;
      const bVal = (b?.[this.sortColumn] ?? '') as any;

      if (aVal === bVal) return 0;
      return (aVal < bVal ? -1 : 1) * (this.sortAsc ? 1 : -1);
    });

    this.updatePagination();
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
