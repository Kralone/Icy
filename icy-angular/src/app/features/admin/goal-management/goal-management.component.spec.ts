import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GoalManagementComponent } from './goal-management.component';
import { GoalService } from '../../../core/services/goal/goal.service';
import { UserService } from '../../../core/services/user/user.service';
import { Goal } from '../../../model/goal.model';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

const goal = (id: number, parentId: number | null = null, subGoals: Goal[] = []): Goal => ({id, parentId, name: `Objectif ${id}`, description: '', current: 0, target: 10, pinned: false, completed: false, createdAt: '', subGoals});

describe('GoalManagementComponent', () => {
  let component: GoalManagementComponent;
  let fixture: ComponentFixture<GoalManagementComponent>;
  let service: {getAllGoals: ReturnType<typeof vi.fn>; getAllTemplates: ReturnType<typeof vi.fn>; addGoal: ReturnType<typeof vi.fn>; updateTemplate: ReturnType<typeof vi.fn>; applyTemplate: ReturnType<typeof vi.fn>};
  beforeEach(async () => {
    service = {getAllGoals: vi.fn(() => of([])), getAllTemplates: vi.fn(() => of([])), addGoal: vi.fn(() => of(undefined)), updateTemplate: vi.fn(() => of(undefined)), applyTemplate: vi.fn(() => of(undefined))};
    await TestBed.configureTestingModule({imports: [GoalManagementComponent], providers: [{provide: GoalService, useValue: service}, {provide: UserService, useValue: {getAllUsers: () => of({data: []})}}]}).compileComponents();
    fixture = TestBed.createComponent(GoalManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows retry on failed loading rather than an empty result', () => {
    service.getAllGoals.mockReturnValueOnce(throwError(() => new Error('offline')));
    component.loadGoals();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Impossible de charger les objectifs.');
    expect(fixture.nativeElement.textContent).not.toContain('Aucun objectif en cours.');
    component.loadGoals();
    fixture.detectChanges();
    expect(component.goalsError).toBe('');
  });

  it('keeps failed form input and prevents duplicate submissions', () => {
    const pending = new Subject<void>();
    service.addGoal.mockReturnValue(pending);
    component.form.name = 'Collecte';
    component.createOrUpdateGoal();
    component.createOrUpdateGoal();
    expect(service.addGoal).toHaveBeenCalledTimes(1);
    pending.error(new Error('offline'));
    expect(component.form.name).toBe('Collecte');
    expect(component.busy).toBe(false);
    expect(component.actionError).toContain('Vos saisies sont conservées');
  });

  it('rejects invalid targets and excludes an edited subtree from parent choices', () => {
    component.form.name = 'Collecte';
    component.form.target = NaN;
    component.createOrUpdateGoal();
    expect(service.addGoal).not.toHaveBeenCalled();
    const child = goal(2, 1, [goal(3, 2)]);
    component.rootGoals = [goal(1, null, [child]), goal(4)];
    component.editingGoal = child;
    expect(component.parentOptions.map(node => node.goal.id)).toEqual([1, 4]);
  });

  it('preserves the parent when editing a nested template', async () => {
    component.editTemplate({id: 2, parentId: 1, name: 'Étape', createdAt: '', description: '', target: 4, subTemplates: []});
    component.createTemplateTree();
    expect(service.updateTemplate).toHaveBeenCalledWith(2, expect.objectContaining({parentId: 1}));
    await Promise.resolve();
    await Promise.resolve();
  });

  it('retains member assignment when creating from a template', () => {
    component.templateApplyUserId = 'member-7';
    component.applyTemplate({id: 4, parentId: null, name: 'Modèle', createdAt: '', description: '', target: 1, subTemplates: []});
    expect(service.applyTemplate).toHaveBeenCalledWith(4, {userId: 'member-7'});
  });

  it('rejects fractional and overflowing targets in goals and nested templates', () => {
    component.form.name = 'Collecte';
    component.templateDraftRoot.name = 'Modèle';
    component.addTemplateChild(component.templateDraftRoot);
    const child = component.templateDraftRoot.children[0];
    child.name = 'Étape';
    for (const invalid of [0.5, 2147483648, Infinity, NaN]) {
      component.form.target = invalid;
      component.createOrUpdateGoal();
      child.target = invalid;
      expect(component.isTemplateDraftValid(component.templateDraftRoot)).toBe(false);
    }
    expect(service.addGoal).not.toHaveBeenCalled();
    component.form.target = 2147483647;
    child.target = 2147483647;
    expect(component.isGoalFormValid).toBe(true);
    expect(component.isTemplateDraftValid(component.templateDraftRoot)).toBe(true);
  });

  it('rejects fractional and overflowing progress in edit mode', () => {
    component.editingGoal = goal(1);
    component.form.name = 'Collecte';
    for (const invalid of [0.5, -1, 2147483648, Infinity, NaN]) {
      component.form.current = invalid;
      expect(component.isGoalFormValid).toBe(false);
    }
    component.form.current = 2147483647;
    expect(component.isGoalFormValid).toBe(true);
  });

  it('only shows and sends progress and pinning when editing', () => {
    expect(fixture.nativeElement.querySelector('[name="current"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[name="pinned"]')).toBeNull();
    component.form.name = 'Collecte';
    component.createOrUpdateGoal();
    const payload = service.addGoal.mock.calls[0][0];
    expect(payload).not.toHaveProperty('current');
    expect(payload).not.toHaveProperty('pinned');
    component.editingGoal = goal(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[name="current"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[name="pinned"]')).not.toBeNull();
  });
});
