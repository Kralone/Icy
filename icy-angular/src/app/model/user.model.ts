export interface User {
  id: string;
  username: string;
  discordId: number;
  createdAt: string;
  active: boolean;
  roles: Role[];
}

export interface Role {
  id: string;
  name: string;
}
