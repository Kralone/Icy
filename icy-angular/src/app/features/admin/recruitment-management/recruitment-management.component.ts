// recruitment-management.component.ts
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { RecruitmentAdmin } from '../../../model/recruitment-admin.model';
import { RecruitmentService } from '../../../core/services/recruitment/recruitment.service';

@Component({
  selector: 'app-recruitment-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './recruitment-management.component.html',
})
export class RecruitmentManagementComponent implements OnInit {
  openRecruitments: RecruitmentAdmin[] = [];
  processedRecruitments: RecruitmentAdmin[] = [];

  // Pagination
  pageSizes: number[] = [10, 20, 30];

  openPage = 1;
  openItemsPerPage = 10;

  processedPage = 1;
  processedItemsPerPage = 10;

  // Loading
  isLoading = false;
  isUpdating = false;

  // Modal
  motivationModalOpen = false;
  selectedRecruitment: RecruitmentAdmin | null = null;

  // Comment
  modalComment = '';
  isSavingComment = false;

  constructor(
    private recruitmentService: RecruitmentService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadRecruitments();
  }

  loadRecruitments(): void {
    this.isLoading = true;

    this.recruitmentService.getAll().subscribe({
      next: (data: RecruitmentAdmin[]) => {
        const all = data ?? [];

        const open = all.filter(r => r.status === 'PENDING');
        const processed = all.filter(r => r.status === 'ACCEPTED' || r.status === 'REFUSED');

        // Tri demandé:
        // - ouverts: plus vieux -> plus récent
        this.openRecruitments = open.sort((a, b) => this.toTime(a.createdAt) - this.toTime(b.createdAt));

        // - traités: plus récent -> plus vieux
        this.processedRecruitments = processed.sort((a, b) => this.toTime(b.createdAt) - this.toTime(a.createdAt));

        // Reset pages si besoin
        this.openPage = 1;
        this.processedPage = 1;

        // Si modal ouverte, resync sur l'item (au cas où statut/comment a changé)
        if (this.selectedRecruitment) {
          const refreshed = all.find(r => r.id === this.selectedRecruitment!.id);
          if (refreshed) {
            this.selectedRecruitment = refreshed;
            this.modalComment = refreshed.comment ?? '';
          }
        }

        this.isLoading = false;
      },
      error: (err: unknown) => {
        console.error('Erreur chargement recrutements', err);
        this.isLoading = false;
      },
    });
  }

  private toTime(dateStr: string): number {
    const t = Date.parse(dateStr);
    return Number.isNaN(t) ? 0 : t;
  }

  // ===================== PAGINATION OPEN =====================
  get openTotalPages(): number {
    const total = Math.ceil(this.openRecruitments.length / this.openItemsPerPage);
    return total <= 0 ? 0 : total;
  }

  get openPaginatedRecruitments(): RecruitmentAdmin[] {
    if (this.openRecruitments.length === 0) return [];
    const start = (this.openPage - 1) * this.openItemsPerPage;
    return this.openRecruitments.slice(start, start + this.openItemsPerPage);
  }

  onOpenPageSizeChange(): void {
    this.openPage = 1;
  }

  prevOpenPage(): void {
    if (this.openPage > 1) this.openPage--;
  }

  nextOpenPage(): void {
    if (this.openPage < this.openTotalPages) this.openPage++;
  }

  // ===================== PAGINATION PROCESSED =====================
  get processedTotalPages(): number {
    const total = Math.ceil(this.processedRecruitments.length / this.processedItemsPerPage);
    return total <= 0 ? 0 : total;
  }

  get processedPaginatedRecruitments(): RecruitmentAdmin[] {
    if (this.processedRecruitments.length === 0) return [];
    const start = (this.processedPage - 1) * this.processedItemsPerPage;
    return this.processedRecruitments.slice(start, start + this.processedItemsPerPage);
  }

  onProcessedPageSizeChange(): void {
    this.processedPage = 1;
  }

  prevProcessedPage(): void {
    if (this.processedPage > 1) this.processedPage--;
  }

  nextProcessedPage(): void {
    if (this.processedPage < this.processedTotalPages) this.processedPage++;
  }

  // ===================== MODAL =====================
  openMotivation(rec: RecruitmentAdmin): void {
    this.selectedRecruitment = rec;
    this.modalComment = rec.comment ?? '';
    this.motivationModalOpen = true;
  }

  closeMotivation(): void {
    this.motivationModalOpen = false;
    this.selectedRecruitment = null;
    this.modalComment = '';
    this.isSavingComment = false;
  }

  saveComment(): void {
    if (!this.selectedRecruitment) return;

    const updated: RecruitmentAdmin = {
      ...this.selectedRecruitment,
      comment: (this.modalComment ?? '').trim(),
    };

    this.isSavingComment = true;

    // On utilise update() que tu as déjà dans ton service
    this.recruitmentService.update(updated).subscribe({
      next: () => {
        // On reload pour refléter partout (tables + badge 💬)
        this.isSavingComment = false;
        this.loadRecruitments();
      },
      error: (err: unknown) => {
        console.error('Erreur sauvegarde commentaire', err);
        this.isSavingComment = false;
        alert('Échec de la sauvegarde du commentaire.');
      }
    });
  }

  // ===================== ACTIONS =====================
  acceptRecruitment(rec: RecruitmentAdmin): void {
    if (!confirm(`Accepter la candidature de ${rec.username} ?`)) return;

    this.isUpdating = true;
    this.recruitmentService.accept(rec.id).subscribe({
      next: () => {
        this.isUpdating = false;
        // Si on accepte depuis la modal, on ferme (optionnel)
        if (this.selectedRecruitment?.id === rec.id) this.closeMotivation();
        this.loadRecruitments();
      },
      error: (err: unknown) => {
        console.error('Erreur acceptation recrutement', err);
        this.isUpdating = false;
      },
    });
  }

  refuseRecruitment(rec: RecruitmentAdmin): void {
    if (!confirm(`Refuser la candidature de ${rec.username} ?`)) return;

    this.isUpdating = true;
    this.recruitmentService.refuse(rec.id).subscribe({
      next: () => {
        this.isUpdating = false;
        if (this.selectedRecruitment?.id === rec.id) this.closeMotivation();
        this.loadRecruitments();
      },
      error: (err: unknown) => {
        console.error('Erreur refus recrutement', err);
        this.isUpdating = false;
      },
    });
  }
}
