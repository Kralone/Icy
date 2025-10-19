import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { RecruitmentAdmin } from '../../../model/recruitment-admin.model';
import { RecruitmentService } from '../../../core/services/recruitment/recruitment.service';

@Component({
  selector: 'app-recruitment-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './recruitment-management.component.html',
})
export class RecruitmentManagementComponent implements OnInit {
  openRecruitments: RecruitmentAdmin[] = [];
  processedRecruitments: RecruitmentAdmin[] = [];

  isLoading = false;
  editingRecruitment: RecruitmentAdmin | null = null;
  isUpdating = false;

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
        this.openRecruitments = data.filter(
          (r: RecruitmentAdmin) => r.status === 'PENDING'
        );
        this.processedRecruitments = data.filter(
          (r: RecruitmentAdmin) => r.status === 'ACCEPTED' || r.status === 'REFUSED'
        );
        this.isLoading = false;
      },
      error: (err: unknown) => {
        console.error('Erreur chargement recrutements', err);
        this.isLoading = false;
      },
    });
  }

  processRecruitment(recruitment: RecruitmentAdmin): void {
    if (
      !confirm(
        `Marquer la candidature de ${recruitment.username} comme traitée ?`
      )
    ) return;

    this.isUpdating = true;
    this.recruitmentService.markProcessed(recruitment.id).subscribe({
      next: () => {
        this.loadRecruitments();
        this.isUpdating = false;
      },
      error: (err: unknown) => {
        console.error('Erreur traitement recrutement', err);
        this.isUpdating = false;
      },
    });
  }

  deleteRecruitment(id: number): void {
    if (!confirm(`Supprimer cette candidature ?`)) return;

    this.recruitmentService.delete(id).subscribe({
      next: () => this.loadRecruitments(),
      error: (err: unknown) =>
        console.error('Erreur suppression recrutement', err),
    });
  }

  editRecruitment(rec: RecruitmentAdmin): void {
    this.editingRecruitment = { ...rec };
  }

  cancelEdit(): void {
    this.editingRecruitment = null;
  }

  updateRecruitment(): void {
    if (!this.editingRecruitment) return;
    this.isUpdating = true;

    this.recruitmentService.update(this.editingRecruitment).subscribe({
      next: () => {
        this.loadRecruitments();
        this.isUpdating = false;
        this.editingRecruitment = null;
      },
      error: (err: unknown) => {
        console.error('Erreur mise à jour recrutement', err);
        this.isUpdating = false;
      },
    });
  }

  acceptRecruitment(rec: RecruitmentAdmin): void {
    if (!confirm(`Accepter la candidature de ${rec.username} ?`)) return;

    this.isUpdating = true;
    this.recruitmentService.accept(rec.id).subscribe({
      next: () => {
        this.loadRecruitments();
        this.isUpdating = false;
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
        this.loadRecruitments();
        this.isUpdating = false;
      },
      error: (err: unknown) => {
        console.error('Erreur refus recrutement', err);
        this.isUpdating = false;
      },
    });
  }

}
