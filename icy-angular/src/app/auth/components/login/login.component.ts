import { Component, OnInit } from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import {firstValueFrom} from 'rxjs';
import {NgIf} from '@angular/common';

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
  isTransitioning: boolean = false;
  private tempUser: any = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
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
    this.authService.verifyToken().subscribe(valid => {
      if (valid) {
        this.router.navigate(['/icy/dashboard']);
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
      if (response.tokens.accessToken === 'resetPwd' && response.tokens.refreshToken === 'resetPwd') {
        this.tempUser = response.user; // stockage temporaire en mémoire
        this.showResetModal = true;
        return;
      }

      // ✅ Login normal
      await this.navigateWithTransition('/icy/dashboard');

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

  if (newPassword.length < 6) {
    this.errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
    return;
  }

  if (newPassword !== confirmPassword) {
    this.errorMessage = 'Les mots de passe ne correspondent pas.';
    return;
  }

  const resetPayload = {
    id: this.tempUser.id,
    newPassword
  };

  try {
    const response = await firstValueFrom(this.authService.resetPassword(resetPayload));
    localStorage.setItem('token', response.tokens.accessToken);
    localStorage.setItem('refreshToken', response.tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.user.username));

    this.showResetModal = false;
    await this.navigateWithTransition('/icy/dashboard');
  } catch (err) {
    this.errorMessage = "Erreur lors de la réinitialisation.";
  }
}

  onBack(): void {
    // Par exemple : revenir à la page d'accueil ou précédente
    this.router.navigate(['/']);
  }

  private async navigateWithTransition(path: string): Promise<void> {
    this.isTransitioning = true;
    await this.router.navigateByUrl(path);
  }

}
