import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from '@/app/protected-route';
import { AppShell } from '@/shared/components/layout/app-shell';

// Lazy-loaded page modules
const LoginPage = lazy(() =>
  import('@/features/auth/pages/login-page').then((m) => ({ default: m.LoginPage })),
);
const OrganizationsPage = lazy(() =>
  import('@/features/organizations/pages/organizations-page').then((m) => ({
    default: m.OrganizationsPage,
  })),
);
const TeamsPage = lazy(() =>
  import('@/features/teams/pages/teams-page').then((m) => ({ default: m.TeamsPage })),
);
const UsersPage = lazy(() =>
  import('@/features/users/pages/users-page').then((m) => ({ default: m.UsersPage })),
);
const RolesPage = lazy(() =>
  import('@/features/roles/pages/roles-page').then((m) => ({ default: m.RolesPage })),
);
const ContentPage = lazy(() =>
  import('@/features/content/pages/content-page').then((m) => ({ default: m.ContentPage })),
);
const AuditPage = lazy(() =>
  import('@/features/audit/pages/audit-page').then((m) => ({ default: m.AuditPage })),
);

function ForbiddenPage(): JSX.Element {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold text-destructive">403</h1>
      <p className="text-lg text-muted-foreground">
        You don&apos;t have permission to access this page.
      </p>
    </div>
  );
}

function NotFoundPage(): JSX.Element {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-lg text-muted-foreground">Page not found.</p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/content" replace />,
      },
      {
        path: 'organizations',
        element: (
          <ProtectedRoute requireAdmin>
            <OrganizationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'teams',
        element: (
          <ProtectedRoute requireAdmin>
            <TeamsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute requireAdmin>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'roles',
        element: (
          <ProtectedRoute requireAdmin>
            <RolesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'content',
        element: <ContentPage />,
      },
      {
        path: 'audit',
        element: (
          <ProtectedRoute requireAdmin>
            <AuditPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '/403',
    element: <ForbiddenPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
