import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import {firstValueFrom} from 'rxjs';
import {isPlatformBrowser, NgIf} from '@angular/common';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  imports: [
    ReactiveFormsModule,
    NgIf,
    RouterLink
  ],
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  passwordForm: FormGroup;
  errorMessage: string = '';
  showResetModal: boolean = false;
  private passwordResetToken: string | null = null;
  private returnUrl = '/icy/dashboard';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
    });
    this.passwordForm = this.fb.group({
      newPassword: ['', Validators.required],
      confirmPassword: ['', Validators.required]
    })
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    const rawReturnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/icy/dashboard';
    this.returnUrl = rawReturnUrl.startsWith('/') ? rawReturnUrl : '/icy/dashboard';
    this.authService.verifyToken().subscribe(valid => {
      if (valid) {
        this.router.navigateByUrl(this.returnUrl);
      }
    });
  }

  async onSubmit(): Promise<void> {
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.errorMessage = 'Veuillez remplir tous les champs.';
      return;
    }

    const { username, password } = this.loginForm.value;

    try {
      const response = await firstValueFrom(this.authService.login(username, password));

      // 🔍 Cas spécial : utilisateur en reset password
      if (response.tokens.accessToken === 'resetPwd') {
        if (!response.passwordResetToken) {
          throw new Error('Jeton de réinitialisation manquant.');
        }
        this.passwordResetToken = response.passwordResetToken;
        this.showResetModal = true;
        return;
      }

      // ✅ Login normal
      await this.router.navigateByUrl(this.returnUrl);

    } catch (error) {
      console.error('Erreur de login', error);
      this.errorMessage = 'Nom d’utilisateur ou mot de passe incorrect.';
    }
  }


async onResetPassword(): Promise<void> {
  this.errorMessage = ''; // reset erreur

  if (this.passwordForm.invalid) {
    this.errorMessage = 'Tous les champs sont requis.';
    return;
  }

  const newPassword = this.passwordForm.value.newPassword;
  const confirmPassword = this.passwordForm.value.confirmPassword;

  if (newPassword.length < 12) {
    this.errorMessage = 'Le mot de passe doit contenir au moins 12 caractères.';
    return;
  }

  if (new TextEncoder().encode(newPassword).length > 72) {
    this.errorMessage = 'Le mot de passe ne doit pas dépasser 72 octets.';
    return;
  }

  if (newPassword !== confirmPassword) {
    this.errorMessage = 'Les mots de passe ne correspondent pas.';
    return;
  }

  if (!this.passwordResetToken) {
    this.errorMessage = 'La session de réinitialisation a expiré. Veuillez vous reconnecter.';
    return;
  }

  const resetPayload = {
    resetToken: this.passwordResetToken,
    newPassword
  };

  try {
    const response = await firstValueFrom(this.authService.resetPassword(resetPayload));
    if (this.isBrowser) {
      localStorage.setItem('token', response.tokens.accessToken);
      localStorage.setItem('refreshToken', response.tokens.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.user.username));
    }

    this.showResetModal = false;
    this.passwordResetToken = null;
    await this.router.navigateByUrl(this.returnUrl);
  } catch (err) {
    this.errorMessage = "Erreur lors de la réinitialisation.";
  }
}

  onBack(): void {
    // Par exemple : revenir à la page d'accueil ou précédente
    this.router.navigate(['/']);
  }

}
