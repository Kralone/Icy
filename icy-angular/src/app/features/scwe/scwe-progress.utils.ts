import { ScweScoreSchema } from '../../model/scwe-player.model';

/** Same fields as the server's sum; missing limits never become a fictitious target. */
export function scweGlobalTarget(schema: ScweScoreSchema | null | undefined): number | null {
  const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  if (!schema) return null;
  if (positive(schema.total?.max)) return schema.total.max;
  const keys = schema.total?.mode?.toLowerCase() === 'sum' ? schema.total.keys : undefined;
  const fields = (schema.fields ?? []).filter(field => !Array.isArray(keys) || keys.includes(field.key));
  const sum = fields.length && fields.every(field => positive(field.max))
    ? fields.reduce((total, field) => total + field.max, 0) : 0;
  const milestones = (schema.total?.milestones ?? []).map(m => m.at).filter(positive);
  const target = Math.max(sum, ...milestones, 0);
  return target > 0 ? target : null;
}

export function scweProgressBackground(value: number, target: number): string {
  return target > 0 && value >= target
    ? 'linear-gradient(to right, #34d399, #22c55e)'
    : 'linear-gradient(to right, #22d3ee, #3b82f6)';
}
