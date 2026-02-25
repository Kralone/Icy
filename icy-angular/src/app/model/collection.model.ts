export interface TemplateListItemDTO {
  id: number;
  name: string;
  archetype: string;
}

export interface TemplateDetailDTO extends TemplateListItemDTO {
  axisX: unknown;     // JSON libre
  axisY: unknown;     // JSON libre
  defaults?: unknown; // JSON libre
  createdAt?: string; // optionnel suivant backend
}


export interface UserCollectionListItemDTO {
  id: number;
  name: string;
  templateId: number;
  updatedAt?: string;
}

export interface UserCollectionDetailDTO {
  id: number;
  name: string;
  templateId: number;
  template?: TemplateDetailDTO;
  checked: string[];
  createdAt?: string;
  updatedAt?: string;
}
