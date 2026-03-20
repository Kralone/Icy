// ✅ Modèle Ship utilisé pour le hangar et la sélection
export interface ShipSalePoint {
  location: string;
  price: number;
}

export interface ShipCargoGrid {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

export interface Ship {
  id: number;
  name: string;
  brand: {
    name: string;
  };
  imageUrl: string;
  focus: string;
  crew: string;
  notes?: string;
  size?: string;
  scu?: number;
  flightReady?: boolean;
  inGamePurchase?: boolean;
  rewardInGame?: boolean;
  loaner?: boolean;
  salePoints?: ShipSalePoint[];
  cargoGrids?: ShipCargoGrid[];
}

export interface ShipCreateDTO {
  name: string;
  brand: { name: string };
  imageUrl: string;

  focus?: string;
  scu?: number;
  size?: string;
  crew?: string;
  notes?: string;

  flightReady: boolean;
  salePoints?: ShipSalePoint[];
  cargoGrids?: ShipCargoGrid[];
}

