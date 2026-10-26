export interface JwtPayload {
  sub: string;
  id?: string;
  userId?: string;
  username?: string;
  preferred_username?: string;
  email?: string;
  role?: string;
  roles?: string[];
  realm_access?: {
    roles: string[];
  };
  family_name?: string;
  given_name?: string;
  keycloakUserId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  sub: string;
  username: string;
  role: string;
  keycloakUserId?: string;
  email?: string;
}
