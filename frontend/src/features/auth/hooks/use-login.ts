import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';
import { env } from '@/shared/config/env';
import { useAuthStore } from '@/shared/stores/auth.store';
import type { AuthUserWithPermissions } from '@/shared/stores/auth.store';

import { authApi } from '../api/auth.api';

export function useLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (input: Parameters<typeof authApi.login>[0]) => {
      const data = await authApi.login(input);
      // /login returns user without permissions. Use raw axios (no interceptors) to call /me
      // with the fresh access token so the 401-retry loop cannot interfere.
      const meRes = await axios.get<AuthUserWithPermissions>(`${env.VITE_API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });
      return { ...data, user: meRes.data };
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      void navigate('/');
    },
    onError: (error: unknown) => {
      toast.error(parseApiError(error).message);
    },
  });

  return { login: mutateAsync, isPending };
}
