// ✅ Interface utilisée côté hangar (réponse API)
export interface ShipListDTO {
  shipId: number;
  name: string;
  brand: string;
  imageUrl: string;
  focus: string;
  crew: string;
  inGamePurchase: boolean;
  rewardInGame: boolean;
  loaner: boolean;
}
