import { BASE_URL, apiClient } from '@/shared/api/client';
import type { AuthUserWithProfile } from '@/shared/stores/auth.store';
import type { AuthResponse, LoginInput } from '@mdm/shared';
import axios from 'axios';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserWithProfile;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', input);
  // /auth/login returns user without permissions/profile names. Call /me with the fresh
  // token via raw axios (no interceptors) to get the enriched user.
  const { data: user } = await axios.get<AuthUserWithProfile>(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${data.accessToken}` },
  });
  return { accessToken: data.accessToken, refreshToken: data.refreshToken, user };
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post('/auth/logout', { refreshToken });
}
