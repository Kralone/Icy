export interface WikeloShip {
  id: number;
  shipName: string;
  missionText: string | null;
  costText: string | null;
  reputationText: string | null;
  componentsText: string | null;
  rewardsText: string | null;
  rewardManufacturer: string | null;
  rewardImageUrl: string | null;
  sourceVersion: string;
  missionId: string;
  rewardUuid: string;
  sourceUrl: string;
  scrapedAt: string;
  updatedAt: string | null;
}
