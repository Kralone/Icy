import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecruitmentComponent } from './recruitment.component';
import {coreTestProviders} from '@testing/test-providers';
import {RecruitmentService} from '../../../core/services/recruitment/recruitment.service';
import {Subject} from 'rxjs';
import {vi} from 'vitest';

describe('RecruitmentComponent', () => {
  let component: RecruitmentComponent;
  let fixture: ComponentFixture<RecruitmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecruitmentComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecruitmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('explains invalid fields after submission without sending a request', () => {
    const create = vi.spyOn(TestBed.inject(RecruitmentService), 'create');
    fixture.nativeElement.querySelector('button[type="submit"]').click();
    fixture.detectChanges();

    expect(create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#username-error').textContent).toContain('Indique ton nom');
    expect(fixture.nativeElement.querySelector('#discordTag-error').textContent).toContain('identifiant Discord');
    expect(fixture.nativeElement.querySelector('#motivation-error').textContent).toContain('10 caractères');
  });

  it('keeps a confirmation after success and prevents duplicate submissions', () => {
    const response = new Subject<void>();
    const create = vi.spyOn(TestBed.inject(RecruitmentService), 'create').mockReturnValue(response);
    component.recruitmentForm.patchValue({username: 'Pilote', discordTag: 'pilote', motivation: 'Je souhaite rejoindre votre équipe.'});

    component.onSubmit();
    component.onSubmit();
    expect(create).toHaveBeenCalledTimes(1);
    response.next();
    response.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('examen');
    component.onSubmit();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
