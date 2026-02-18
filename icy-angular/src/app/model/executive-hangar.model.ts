export interface ExecutiveHangarConfig {
  initialOpenTime: string;
  updatedAt?: string;
  updatedByUserId?: string;
}

export interface ExecutiveHangarPlayerStatus {
  userId: string;
  hasExecShip: boolean;
  updatedAt?: string;
  updatedByUserId?: string;
}
