import { type Permission } from '@mdm/shared';

import { useAuthStore } from '@/shared/stores/auth.store';

export function usePermission(permission: Permission): boolean {
  const user = useAuthStore((state) => state.user);

  if (!user) return false;
  if (user.isAdmin) return true;

  const permissions = user.permissions ?? [];
  return permissions.includes(permission);
}
