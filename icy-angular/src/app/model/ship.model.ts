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
  brand: { name: string };
  imageUrl: string;

  focus?: string;
  scu?: number;
  size?: string;
  crew?: string;

  flightReady: boolean;
}

