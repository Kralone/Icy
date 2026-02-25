import { UserStatusKey } from './user-profile.model';

export interface UserOnline {
  id: string;
  username: string;
  status: UserStatusKey;
  avatarUrl?: string | null;
}
