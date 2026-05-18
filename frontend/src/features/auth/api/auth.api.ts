import type { AuthUser } from '@mdm/shared';

import { apiClient } from '@/shared/api/client';

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  login: (data: LoginInput) =>
    apiClient.post<AuthResponse>('/api/v1/auth/login', data).then((r) => r.data),

  refresh: (refreshToken: string) =>
    apiClient.post<RefreshResponse>('/api/v1/auth/refresh', { refreshToken }).then((r) => r.data),

  logout: (refreshToken: string) => apiClient.post('/api/v1/auth/logout', { refreshToken }),

  me: () =>
    apiClient.get<AuthUser & { permissions?: string[] }>('/api/v1/auth/me').then((r) => r.data),
};
