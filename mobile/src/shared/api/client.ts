import { useAuthStore } from '@/shared/stores/auth.store';
import { ErrorCode } from '@mdm/shared';
import axios from 'axios';

export interface ApiError {
  code: ErrorCode;
  message: string;
}

let unauthenticatedHandler: (() => void) | null = null;

export function setUnauthenticatedHandler(fn: () => void): void {
  unauthenticatedHandler = fn;
}

export const BASE_URL = (process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000') + '/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
});

// Attach access token from in-memory store on every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// De-duplicate concurrent refresh calls behind a single in-flight promise
let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) {
      return Promise.reject(error);
    }

    const config = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !config._retry) {
      config._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        unauthenticatedHandler?.();
        return Promise.reject(parseError(error));
      }

      try {
        if (!refreshPromise) {
          // Use a raw axios instance to avoid interceptor recursion.
          // /auth/refresh returns only { accessToken, refreshToken } — preserve existing user.
          refreshPromise = axios
            .post<{ accessToken: string; refreshToken: string }>(`${BASE_URL}/auth/refresh`, {
              refreshToken,
            })
            .then(({ data }) => {
              const store = useAuthStore.getState();
              const currentUser = store.user;
              if (currentUser) {
                store.setAuth(data.accessToken, data.refreshToken, currentUser);
              } else {
                store.clearAuth();
                throw new Error('Session expired');
              }
              return data.accessToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newToken = await refreshPromise;
        if (config.headers) config.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(config);
      } catch {
        useAuthStore.getState().clearAuth();
        unauthenticatedHandler?.();
        return Promise.reject(parseError(error));
      }
    }

    return Promise.reject(parseError(error));
  },
);

function parseError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return { code: ErrorCode.INTERNAL, message: 'An unexpected error occurred' };
  }

  const raw = error.response?.data as { error?: { code?: unknown; message?: unknown } } | undefined;
  const rawCode = raw?.error?.code;
  const message =
    typeof raw?.error?.message === 'string'
      ? raw.error.message
      : (error.message ?? 'Request failed');

  const knownCodes = Object.values(ErrorCode) as string[];
  const code: ErrorCode =
    typeof rawCode === 'string' && knownCodes.includes(rawCode)
      ? (rawCode as ErrorCode)
      : ErrorCode.INTERNAL;

  return { code, message };
}
