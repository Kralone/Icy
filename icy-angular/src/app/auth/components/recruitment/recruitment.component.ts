import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RecruitmentService } from './recruitment.service';
import { Recruitment } from './recruitment.model';
import {Router, RouterLink} from '@angular/router';

@Component({
  selector: 'app-recruitment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './recruitment.component.html'
})
export class RecruitmentComponent implements OnInit {
  recruitmentForm!: FormGroup;
  successMessage = '';
  errorMessage = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private recruitmentService: RecruitmentService,
    private router: Router
  ) {}

  ngOnInit() {
    // ✅ Initialisation ici, après injection du FormBuilder
    this.recruitmentForm = this.fb.group({
      username: ['', Validators.required],
      discordTag: ['', Validators.required],
      motivation: ['', [Validators.required, Validators.minLength(10)]],
      referral: [''],
      experience: [''],
      preferredGameplay: ['']
    });
  }

  onSubmit() {
    if (this.recruitmentForm.invalid) return;

    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    const recruitment: Recruitment = {
      ...this.recruitmentForm.value,
      accept: false,
      status: 'PENDING'
    } as Recruitment;

    this.recruitmentService.create(recruitment).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = '✅ Candidature envoyée avec succès !';
        this.recruitmentForm.reset();

        // Redirection automatique après 3 secondes
        setTimeout(() => this.router.navigate(['/auth/login']), 3000);
      },
      error: () => {
        this.loading = false;
        this.errorMessage = '❌ Une erreur est survenue. Merci de réessayer.';
      }
    });
  }
}
