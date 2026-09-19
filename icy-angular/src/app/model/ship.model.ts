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

export type ShipCatalogGroup = 'STANDARD' | 'WIKELO' | 'PYAM_EXEC' | 'BATTAGLIA';

export interface Ship {
  id: number;
  name: string;
  brand: {
    name: string;
    imageUrl?: string;
  };
  imageUrl: string;
  focus: string;
  crew: string;
  catalogGroup?: ShipCatalogGroup;
  notes?: string;
  size?: string;
  scu?: number | null;
  oreCapacity?: number | null;
  flightReady?: boolean;
  inGamePurchase?: boolean;
  rewardInGame?: boolean;
  loaner?: boolean;
  salePoints?: ShipSalePoint[];
  cargoGrids?: ShipCargoGrid[];
  /** Catalogue enrichment used by Executive/PYAM detail views. */
  components?: ShipLoadoutItem[];
  weapons?: ShipLoadoutItem[];
}

export interface ShipLoadoutItem {
  name: string;
  quantity?: number;
  imageUrl?: string;
  manufacturer?: string;
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

