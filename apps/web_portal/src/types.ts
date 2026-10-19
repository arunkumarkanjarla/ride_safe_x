/** Mirrors @ridenova/contracts auth types (Phase 2). */
export interface RoleOut {
  code: string;
  name: string;
}

export interface UserOut {
  id: string;
  email: string;
  display_name: string;
  status: string;
  roles: RoleOut[];
  permissions: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserOut;
}

export interface LoginRequest {
  email: string;
  password: string;
}
