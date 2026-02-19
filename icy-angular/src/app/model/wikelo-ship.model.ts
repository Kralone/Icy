export interface WikeloShip {
  id: number;
  shipName: string;
  missionText: string | null;
  costText: string | null;
  reputationText: string | null;
  componentsText: string | null;
  sourceSheet: string;
  sourceUrl: string;
  scrapedAt: string;
  updatedAt: string | null;
}
