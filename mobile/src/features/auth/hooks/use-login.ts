import { login, type LoginResult } from '@/features/auth/api/auth.api';
import { useAuthStore } from '@/shared/stores/auth.store';
import type { LoginInput } from '@mdm/shared';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (data: LoginResult) => {
      setAuth(data.accessToken, data.refreshToken, data.user);
      router.replace('/(auth)');
    },
  });
}
