import axios from 'axios';
import { useEffect, useState, type ReactNode } from 'react';

import { env } from '@/shared/config/env';
import { useAuthStore, type AuthUserWithPermissions } from '@/shared/stores/auth.store';

interface AuthBootstrapProps {
  children: ReactNode;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export function AuthBootstrap({ children }: AuthBootstrapProps): ReactNode {
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const refreshToken = useAuthStore((state) => state.refreshToken);
  const accessToken = useAuthStore((state) => state.accessToken);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      // If we already have an accessToken in memory, nothing to do
      if (accessToken) {
        setIsBootstrapping(false);
        return;
      }

      // If there's no refreshToken either, we're definitely logged out
      if (!refreshToken) {
        setIsBootstrapping(false);
        return;
      }

      try {
        // Use bare axios (no interceptors) to avoid re-entrant refresh loops during bootstrap.
        // Step 1: Exchange refreshToken for a new accessToken
        const refreshResponse = await axios.post<RefreshResponse>(
          `${env.VITE_API_URL}/api/v1/auth/refresh`,
          { refreshToken },
        );
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data;

        // Step 2: Fetch the current user profile using the new token directly in the header
        const meResponse = await axios.get<AuthUserWithPermissions>(
          `${env.VITE_API_URL}/api/v1/auth/me`,
          { headers: { Authorization: `Bearer ${newAccessToken}` } },
        );
        const user = meResponse.data;

        // Step 3: Commit everything to the store (new refresh token is always rotated)
        setAuth(user, newAccessToken, newRefreshToken);
      } catch {
        clearAuth();
      } finally {
        setIsBootstrapping(false);
      }
    }

    bootstrap();
  }, []); // intentionally empty — runs once on mount

  if (isBootstrapping) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
