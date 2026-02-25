export interface Recruitment {
  id?: number;
  username: string;
  discordTag: string;
  motivation: string;
  referral?: string;
  experience?: string;
  preferredGameplay?: string;
  accept: boolean;
  status?: string;
  comment?: string;
  createdAt?: string;
}
