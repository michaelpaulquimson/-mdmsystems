import {
  Building2,
  Users,
  Users2,
  ShieldCheck,
  FileText,
  ClipboardList,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { apiClient } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/use-auth';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useAuthStore } from '@/shared/stores/auth.store';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Content', to: '/content', icon: <FileText className="h-4 w-4" /> },
  {
    label: 'Organizations',
    to: '/organizations',
    icon: <Building2 className="h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: 'Teams',
    to: '/teams',
    icon: <Users2 className="h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: 'Users',
    to: '/users',
    icon: <Users className="h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: 'Roles',
    to: '/roles',
    icon: <ShieldCheck className="h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: 'Audit Log',
    to: '/audit',
    icon: <ClipboardList className="h-4 w-4" />,
    adminOnly: true,
  },
];

export function AppShell(): JSX.Element {
  const { user, isAdmin } = useAuth();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } catch {
      // Best-effort logout — clear state regardless
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
    }
  }

  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r bg-card">
        {/* Logo / brand */}
        <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold tracking-tight">MDM Admin</span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="shrink-0 border-t p-3">
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-medium">{user?.name ?? 'Unknown'}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email ?? ''}</p>
            {isAdmin && (
              <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Admin
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              handleLogout().catch(() => {
                toast.error('Logout failed');
              });
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
