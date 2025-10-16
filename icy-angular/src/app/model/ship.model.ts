// ✅ Modèle Ship utilisé pour le hangar et la sélection
export interface Ship {
  id: number;
  name: string;
  brand: {
    name: string;
  };
  imageUrl: string;
  focus: string;
  crew: string;
  inGamePurchase?: boolean;
  loaner?: boolean;
}

export interface ShipCreateDTO {
  name: string;
  brand: { name: string }; // le nom de la marque, côté backend tu résous en objet
  imageUrl: string;
  focus?: string;
  crew?: string;
  link?: string; // si tu veux garder un lien optionnel
}
