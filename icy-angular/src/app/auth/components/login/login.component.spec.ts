import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginComponent } from './login.component';
import {coreTestProviders} from '@testing/test-providers';
import {AuthService} from '../../../core/services/auth/auth.service';
import {Subject} from 'rxjs';
import {Router} from '@angular/router';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('prevents duplicate submissions while login is pending', async () => {
    const loginResponse = new Subject<any>();
    const authService = TestBed.inject(AuthService);
    const loginSpy = vi.spyOn(authService, 'login').mockReturnValue(loginResponse);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    component.loginForm.setValue({username: 'Pilot', password: 'secret'});

    const firstSubmission = component.onSubmit();
    const secondSubmission = component.onSubmit();
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(component.submitting).toBe(true);
    expect(submitButton.disabled).toBe(true);
    expect(submitButton.textContent?.trim()).toBe('Connexion…');

    loginResponse.next({
      tokens: {accessToken: 'access-token', refreshToken: 'refresh-token'},
      user: {username: 'Pilot'}
    });
    loginResponse.complete();
    await Promise.all([firstSubmission, secondSubmission]);

    expect(component.submitting).toBe(false);
  });
});
