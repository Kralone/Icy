import { Component, OnInit } from '@angular/core';
import {User} from '../../../model/user.model';
import {UserService} from '../../../core/services/user/user.service';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {AuthService} from '../../../core/services/auth/auth.service';
import {LoadingOverlayComponent} from '../../../shared/loading-overlay/loading-overlay.component';

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
  paginatedUsers: User[] = [];

  sortColumn: keyof User = 'username';
  sortAsc: boolean = true;

  currentPage: number = 1;
  itemsPerPage: number = 10;

  isLoading = true;

  searchTerm: string = '';

  isEditMode = false;
  editedUserId: string | null = null;

  constructor(private userService: UserService, private authService: AuthService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;

    this.userService.getAllUsers().subscribe({
      next: (response) => {
        this.users = response.data;
        this._filteredUsers = this.users;
        this.applyFilters();
      },
      error: (err) => {
        console.error("Erreur de chargement des utilisateurs :", err);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }


  applyFilters(): void {
    this.filteredUsers = this.users.filter((user) =>
      user.username.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
    this.sortUsers();
  }

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
    this.filteredUsers.sort((a, b) => {
      const aVal = a[this.sortColumn];
      const bVal = b[this.sortColumn];
      return (aVal < bVal ? -1 : 1) * (this.sortAsc ? 1 : -1);
    });
    this.updatePagination();
  }

  updatePagination(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(start, end);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredUsers.length / this.itemsPerPage);
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

  isAddUserModalOpen = false;

  newUser: {
    username: string;
    discordId: string;
    role: string;
  } = {
    username: '',
    discordId: '',
    role: 'USER'
  };


  availableRoles: string[] = ['ADMIN', 'USER'];

  addUser(): void {
    if (!this.newUser.username || !this.newUser.discordId || !this.newUser.role) return;

    console.log(this.newUser);
    this.userService.createUser(this.newUser.username, this.newUser.discordId, this.newUser.role).subscribe(() => {
      this.isAddUserModalOpen = false;
      this.resetForm();
      this.loadUsers();
    });
  }

  resetForm(): void {
    this.newUser = {
      username: '',
      discordId: '',
      role: 'USER'
    };
    this.isEditMode = false;
    this.editedUserId = null;
  }


  deleteUser(id: string): void {
    if (!confirm("Es-tu sûr de vouloir supprimer cet utilisateur ?")) return;

    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.loadUsers(); // recharge la liste
      },
      error: (err) => {
        console.error('Erreur de suppression', err);
        // Tu peux afficher une notification ici si tu en as une
      }
    });
  }

  resetPassword(userId: string) {
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

  get filteredUsers(): any[] {
    return this._filteredUsers.filter(user =>
      user.username.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  set filteredUsers(value: any[]) {
    this._filteredUsers = value;
  }

  private _filteredUsers: any[] = [];

  editUser(user: User): void {
    this.newUser = {
      username: user.username,
      discordId: user.discordId,
      role: typeof user.roles[0] === 'string' ? user.roles[0] : 'USER'
    };
    console.log(user.roles);
    this.editedUserId = user.id;
    this.isEditMode = true;
    this.isAddUserModalOpen = true;
  }

  updateUser(): void {
    if (!this.editedUserId) return;

    const payload = {
      id: this.editedUserId,
      username: this.newUser.username,
      discordId: this.newUser.discordId!,
      role: this.newUser.role
    };

    this.userService.updateUser(payload).subscribe({
      next: () => {
        this.resetForm();
        this.isAddUserModalOpen = false;
        this.loadUsers(); // rafraîchir la liste
      },
      error: (err) => {
        console.error('Erreur lors de la mise à jour', err);
        alert('Échec de la mise à jour');
      }
    });
  }


}
