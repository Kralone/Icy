export type SchemaTab = 'form' | 'json';

export type MilestoneForm = {
  at: number | null;
  label: string;
  imageUrl: string;
  reward?: string;
};

export type FieldForm = {
  key: string;
  label: string;
  min: number | null;
  max: number | null;
  milestones: MilestoneForm[];
};

export type TotalForm = {
  mode: 'sum';
  keys: string[];
  milestones: MilestoneForm[];
};

export type SchemaFormModel = {
  version: number;
  fields: FieldForm[];
  total: TotalForm;
};

