import { Component, OnInit } from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import {firstValueFrom} from 'rxjs';
import {NgIf} from '@angular/common';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  imports: [
    ReactiveFormsModule,
    NgIf
  ],
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  passwordForm: FormGroup;
  errorMessage: string = '';
  showResetModal: boolean = false;

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
    console.log(this.loginForm.value);
    if (this.loginForm.valid) {
      const {username, password} = this.loginForm.value;
      try {
        const success = await firstValueFrom(this.authService.login(username, password));
        if (success) {


          if (localStorage.getItem('refreshToken') === "resetPwd" && localStorage.getItem('token') === "resetPwd") {
            this.showResetModal = true;
          } else {
            await this.router.navigate(['/icy/dashboard']);
          }

        } else {
          this.errorMessage = 'Nom d\'utilisateur ou mot de passe incorrect';
        }
      } catch (error) {
        this.errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
      }
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

  const user = JSON.parse(localStorage.getItem('user')!);
  const resetPayload = {
    id: user.id,
    newPassword
  };

  try {
    const response = await firstValueFrom(this.authService.resetPassword(resetPayload));
    localStorage.setItem('token', response.tokens.accessToken);
    localStorage.setItem('refreshToken', response.tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.user));

    this.showResetModal = false;
    this.router.navigate(['/icy/dashboard']);
  } catch (err) {
    this.errorMessage = "Erreur lors de la réinitialisation.";
  }
}

  onBack(): void {
    // Par exemple : revenir à la page d'accueil ou précédente
    this.router.navigate(['/']);
  }



}
