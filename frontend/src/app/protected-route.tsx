import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '@/shared/auth/use-auth';
import { useAuthStore } from '@/shared/stores/auth.store';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: ProtectedRouteProps): JSX.Element {
  const { isAuthenticated, isAdmin } = useAuth();
  const refreshToken = useAuthStore((state) => state.refreshToken);

  // If no accessToken AND no refreshToken, we're definitely not logged in
  if (!isAuthenticated && !refreshToken) {
    return <Navigate to="/login" replace />;
  }

  // If requireAdmin and user is not an admin, redirect to 403
  if (requireAdmin && isAuthenticated && !isAdmin) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
