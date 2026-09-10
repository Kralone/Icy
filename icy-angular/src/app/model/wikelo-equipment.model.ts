export interface WikeloEquipmentRecipeItem {
  name: string;
  /** Source quantity, including its unit where supplied. */
  quantity: string;
}

export interface WikeloEquipmentRecipe {
  id: string;
  name: string;
  reputation: string | null;
  sourceUrl: string;
  sourceVersion: string | null;
  ingredients: WikeloEquipmentRecipeItem[];
  rewards: WikeloEquipmentRecipeItem[];
}

export interface WikeloEquipment {
  id: number;
  name: string;
  family: 'FPS_WEAPON' | 'ARMOR' | 'ITEM';
  manufacturer: string | null;
  description: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  recipes?: WikeloEquipmentRecipe[];
}
