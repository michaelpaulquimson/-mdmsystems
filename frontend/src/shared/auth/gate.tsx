import { type Permission } from '@mdm/shared';
import { type ReactNode } from 'react';

import { usePermission } from '@/shared/auth/use-permission';

interface GateProps {
  permission: Permission;
  children: ReactNode;
}

export function Gate({ permission, children }: GateProps): ReactNode {
  const hasPermission = usePermission(permission);

  if (!hasPermission) return null;

  return <>{children}</>;
}
