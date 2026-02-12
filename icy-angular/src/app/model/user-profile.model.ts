export type UserStatusKey = 'connecte' | 'enjeu' | 'absent' | 'indisponible' | 'horsligne';

export interface UserProfile {
  id: string;
  username: string;
  discordId: string;
  description?: string | null;
  status?: UserStatusKey | null;
  avatarUrl?: string | null;
  favoriteShip?: {
    id: number;
    name: string;
    imageUrl?: string | null;
  } | null;
  notifications?: {
    global: boolean;
    events: boolean;
    fleet: boolean;
    goals: boolean;
    discord: boolean;
  } | null;
}

export interface UserProfileUpdate {
  description?: string;
  status?: UserStatusKey;
  avatarUrl?: string;
  favoriteShipId?: number | null;
  clearFavoriteShip?: boolean;
  notifGlobal?: boolean;
  notifEvents?: boolean;
  notifFleet?: boolean;
  notifGoals?: boolean;
  notifDiscord?: boolean;
}

export interface UserQuickStats {
  missions: number;
  events: number;
  ships: number;
  collections: number;
}
