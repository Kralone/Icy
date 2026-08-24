import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Recruitment } from './recruitment.model';
import {Router, RouterLink} from '@angular/router';
import {RecruitmentService} from '../../../core/services/recruitment/recruitment.service';

@Component({
  selector: 'app-recruitment',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
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
    console.log('🚀 onSubmit() déclenché');
    if (this.recruitmentForm.invalid) return;

    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    // ✅ Envoi d’un objet propre et typé
    const recruitmentData = {
      username: this.recruitmentForm.value.username,
      discordTag: this.recruitmentForm.value.discordTag,
      motivation: this.recruitmentForm.value.motivation,
      referral: this.recruitmentForm.value.referral,
      experience: this.recruitmentForm.value.experience,
      preferredGameplay: this.recruitmentForm.value.preferredGameplay,
    };

    this.recruitmentService.create(recruitmentData).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = '✅ Candidature envoyée avec succès !';
        this.recruitmentForm.reset();

        // Redirection automatique après 3 secondes
        setTimeout(() => this.router.navigate(['/auth/login']), 3000);
      },
      error: (err) => {
        console.error('Erreur création candidature :', err);
        this.loading = false;
        this.errorMessage = '❌ Une erreur est survenue. Merci de réessayer.';
      }
    });
  }

}
