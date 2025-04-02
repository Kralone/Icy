export interface Role {
  id: string;
  name: string;
}

export interface UserRole {
  id: string;
  role: Role;
}

export interface User {
  id: string;
  username: string;
  roles: UserRole[];
}
