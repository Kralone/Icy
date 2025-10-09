import { Component } from '@angular/core';
import {FormBuilder, FormGroup, Validators, FormArray, FormControl, ReactiveFormsModule} from '@angular/forms';
import { Router } from '@angular/router';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-recrutement',
  templateUrl: './recruit.component.html',
  imports: [
    ReactiveFormsModule, CommonModule
  ]
})
export class RecrutementComponent {
  recruitmentForm: FormGroup;
  successMessage: string = '';
  errorMessage: string = '';

  constructor(private fb: FormBuilder, private router: Router) {
    this.recruitmentForm = this.fb.group({
      discord: ['', [Validators.required, Validators.minLength(3)]],
      inGame: ['', Validators.required],
      age: ['', [Validators.required, Validators.min(13)]],
      availability: ['', Validators.required],
      roles: this.fb.array([], Validators.required),
      experience: ['', Validators.required],
      previousOrg: [''],
      motivation: ['', [Validators.required, Validators.minLength(10)]],
    });
  }

  onSubmit(): void {
    if (this.recruitmentForm.invalid) {
      this.errorMessage = 'Merci de remplir tous les champs obligatoires.';
      this.successMessage = '';
      return;
    }

    const data = this.recruitmentForm.value;
    console.log('Formulaire soumis :', data);

    this.successMessage = 'Merci pour ta candidature !';
    this.errorMessage = '';
    this.recruitmentForm.reset();
  }

  onBack(): void {
    this.router.navigate(['/']);
  }

  onRoleChange(event: any) {
    const rolesArray: FormArray = this.recruitmentForm.get('roles') as FormArray;
    const value = event.target.value;

    if (event.target.checked) {
      rolesArray.push(new FormControl(value));
    } else {
      const index = rolesArray.controls.findIndex(x => x.value === value);
      rolesArray.removeAt(index);
    }
  }
}
