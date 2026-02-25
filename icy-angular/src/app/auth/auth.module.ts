import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LoginComponent } from '../../../../../angular-iceforge/src/app/auth/components/login/login.component';
import {RecruitmentComponent} from './components/recruitment/recruitment.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LoginComponent,
    RecruitmentComponent
  ],
  exports: [LoginComponent, RecruitmentComponent]
})
export class AuthModule {}
