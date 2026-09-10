import {TestBed} from '@angular/core/testing';
import {MiningSheetsComponent} from './mining-sheets.component';
import {coreTestProviders} from '@testing/test-providers';
import {MiningSheet, MiningSheetJob} from '../../../core/services/mining/mining-sheet.service';

describe('MiningSheetsComponent operation workflow', () => {
  function job(id: string, type: MiningSheetJob['type'], costAuec: number): MiningSheetJob {
    return {id, type, costAuec, owner: {id: 'pilot', username: 'Pilote', roles: [], avatarUrl: null}, refineryMethod: null,
      durationMinutes: null, publishedAt: null, finishAt: null, remainingSeconds: null, notes: null, ores: [],
      editableByCurrentUser: true, timerEditableByCurrentUser: true};
  }

  async function setup() {
    await TestBed.configureTestingModule({imports: [MiningSheetsComponent], providers: coreTestProviders}).compileComponents();
    return TestBed.createComponent(MiningSheetsComponent).componentInstance;
  }

  it('separates refinery orders from other costs without altering server data', async () => {
    const component = await setup();
    const jobs = [job('r', 'REFINERY', 100), job('f', 'FUEL', 200), job('m', 'MATERIAL', 50)];
    const sheet = {jobs} as MiningSheet;
    const original = JSON.stringify(sheet);
    expect(component.filteredJobs(sheet).map(row => row.id)).toEqual(['r']);
    component.setDetailTab('COSTS');
    expect(component.filteredJobs(sheet).map(row => row.id)).toEqual(['f', 'm']);
    component.setJobTypeFilter('FUEL');
    expect(component.filteredJobs(sheet).map(row => row.id)).toEqual(['f']);
    component.setDetailTab('JOBS');
    expect(component.filteredJobs(sheet).map(row => row.id)).toEqual(['r']);
    expect(JSON.stringify(sheet)).toBe(original);
  });

  it('retains an unfinished refinery draft when inspecting costs and returning', async () => {
    const component = await setup();
    component.selectedSheet = {editableByCurrentUser: true, status: 'OPEN', members: [job('r', 'REFINERY', 0).owner]} as MiningSheet;
    component.startNewJob('REFINERY');
    const draft = component.newJobDraft!;
    draft.costText = '12 000';
    component.setDetailTab('COSTS');
    expect(component.visibleJobDraft).toBeNull();
    component.setDetailTab('JOBS');
    expect(component.visibleJobDraft).toBe(draft);
    expect(component.visibleJobDraft?.costText).toBe('12 000');
  });
});
