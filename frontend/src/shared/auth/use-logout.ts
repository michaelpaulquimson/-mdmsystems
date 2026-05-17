import { useNavigate } from 'react-router-dom';

import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth.store';

export function useLogout(): () => Promise<void> {
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const navigate = useNavigate();

  return async function logout(): Promise<void> {
    try {
      if (refreshToken) {
        await apiClient.post('/api/v1/auth/logout', { refreshToken });
      }
    } catch {
      // Best-effort — clear local state regardless of server response
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
    }
  };
}
