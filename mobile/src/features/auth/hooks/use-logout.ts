import { logout } from '@/features/auth/api/auth.api';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

export function useLogout() {
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: () => (refreshToken ? logout(refreshToken) : Promise.resolve()),
    onSettled: () => {
      // Clear auth and redirect regardless of whether the API call succeeded.
      // The token is spent either way.
      clearAuth();
      router.replace('/login');
    },
  });
}
