import axios, { type AxiosRequestConfig } from 'axios';

import { env } from '@/shared/config/env';
import { useAuthStore } from '@/shared/stores/auth.store';

export const apiClient = axios.create({
  baseURL: env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return config;
});

// Single in-flight refresh promise to de-duplicate concurrent 401s
let refreshPromise: Promise<string> | null = null;
// Prevent concurrent 401 failures from triggering multiple redirects
let isRedirectingToLogin = false;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await axios.post<{ accessToken: string; refreshToken: string }>(
    `${env.VITE_API_URL}/api/v1/auth/refresh`,
    { refreshToken },
  );

  const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
  const { user, setAuth } = useAuthStore.getState();
  if (user) {
    setAuth(user, newAccessToken, newRefreshToken);
  } else {
    // No user in store (unexpected at runtime — bootstrap should have populated it)
    // Fail closed: clear auth so the user is prompted to log in again
    useAuthStore.getState().clearAuth();
    throw new Error('Session expired — please log in again');
  }
  return newAccessToken;
}

// Response interceptor: handle 401 by refreshing token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Guard: network errors have no config
    if (!error.config) return Promise.reject(error);
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    const is401 = error.response?.status === 401;
    const isAuthEndpoint = /\/auth\/(login|refresh|logout)/.test(originalRequest.url ?? '');

    // Refresh only on 401s that are not from auth endpoints (avoids infinite loop)
    if (is401 && !isAuthEndpoint && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // De-duplicate: reuse the same promise if refresh is already in-flight
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const newAccessToken = await refreshPromise;

        // Retry the original request with the new token
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] =
            `Bearer ${newAccessToken}`;
        } else {
          originalRequest.headers = { Authorization: `Bearer ${newAccessToken}` };
        }

        return apiClient(originalRequest);
      } catch {
        useAuthStore.getState().clearAuth();
        if (!isRedirectingToLogin && window.location.pathname !== '/login') {
          isRedirectingToLogin = true;
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
