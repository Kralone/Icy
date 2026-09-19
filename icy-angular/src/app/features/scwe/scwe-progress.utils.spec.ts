import { scweGlobalTarget, scweProgressBackground } from './scwe-progress.utils';

describe('SCWE global progress', () => {
  const fields = [{key: 'relief', label: 'Orison Relief', max: 72000}];
  it('uses the field target for Orison Relief instead of 1000', () => {
    expect(scweGlobalTarget({fields})).toBe(72000);
    expect(3000 / scweGlobalTarget({fields})! * 100).toBeCloseTo(4.1667, 3);
  });
  it('sums only fields included by the server in total.keys', () => {
    expect(scweGlobalTarget({fields: [...fields, {key: 'other', label: 'Other', max: 500}],
      total: {mode: 'sum', keys: ['relief']}})).toBe(72000);
  });
  it('handles unsorted milestones and preserves an explicit total target', () => {
    expect(scweGlobalTarget({fields: [], total: {mode: 'sum', keys: [], milestones: [{at: 72000}, {at: 1000}]}})).toBe(72000);
    expect(scweGlobalTarget({fields, total: {mode: 'sum', keys: ['relief'], max: 90000}})).toBe(90000);
  });
  it('does not invent a target when limits are absent or incomplete', () => {
    expect(scweGlobalTarget(null)).toBeNull();
    expect(scweGlobalTarget({fields: []})).toBeNull();
    expect(scweGlobalTarget({fields: [...fields, {key: 'unknown', label: 'Unknown', max: NaN}]})).toBeNull();
  });
  it('is green both at and above the target', () => {
    expect(scweProgressBackground(72000, 72000)).toContain('#22c55e');
    expect(scweProgressBackground(75000, 72000)).toContain('#22c55e');
    expect(scweProgressBackground(3000, 72000)).toContain('#3b82f6');
  });
});
