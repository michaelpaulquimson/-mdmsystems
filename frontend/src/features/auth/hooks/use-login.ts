import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';
import { useAuthStore } from '@/shared/stores/auth.store';

import { authApi } from '../api/auth.api';

export function useLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: authApi.login,
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
