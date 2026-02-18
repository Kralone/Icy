import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { WikeloService } from '../../../core/services/wikelo/wikelo.service';
import { WikeloShip } from '../../../model/wikelo-ship.model';
import { UserService } from '../../../core/services/user/user.service';

@Component({
  standalone: true,
  selector: 'app-wikelo',
  imports: [CommonModule, RouterLink],
  templateUrl: './wikelo.component.html',
  styleUrl: './wikelo.component.css'
})
export class WikeloComponent implements OnInit {
  ships: WikeloShip[] = [];
  isLoading = true;
  isRescraping = false;
  errorMessage = '';
  canRescrape = false;

  constructor(
    private wikeloService: WikeloService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.resolveCanRescrape();
    this.loadShips();
  }

  get lastScrapedAt(): string | null {
    if (!this.ships.length) return null;
    const sorted = [...this.ships].sort((a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());
    return sorted[0]?.scrapedAt ?? null;
  }

  loadShips(): void {
    this.errorMessage = '';
    this.isLoading = true;
    this.wikeloService.getShips()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          this.ships = response.data ?? [];
        },
        error: () => {
          this.errorMessage = 'Impossible de charger les donnees Wikelo.';
        }
      });
  }

  triggerRescrape(): void {
    if (!this.canRescrape || this.isRescraping) return;

    const confirmed = window.confirm('Rescraper les donnees Wikelo maintenant ? Cette action va remplacer les donnees en base.');
    if (!confirmed) return;

    this.errorMessage = '';
    this.isRescraping = true;
    this.wikeloService.rescrapeShips()
      .pipe(finalize(() => this.isRescraping = false))
      .subscribe({
        next: (response) => {
          this.ships = response.data ?? [];
        },
        error: () => {
          this.errorMessage = 'Le rescrape a echoue.';
        }
      });
  }

  private resolveCanRescrape(): void {
    this.userService.getMyProfile().subscribe({
      next: (response) => {
        const roles = (response?.data?.roles ?? []).map((role) => (role ?? '').toUpperCase());
        this.canRescrape = roles.includes('ADMIN') || roles.includes('OFFICIER');
      },
      error: () => {
        this.canRescrape = false;
      }
    });
  }
}
