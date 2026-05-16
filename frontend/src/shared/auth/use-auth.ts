import { useAuthStore, type AuthUserWithPermissions } from '@/shared/stores/auth.store';

export interface UseAuthReturn {
  user: AuthUserWithPermissions | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export function useAuth(): UseAuthReturn {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);

  return {
    user,
    accessToken,
    isAuthenticated: !!accessToken,
    isAdmin: user?.isAdmin ?? false,
  };
}
