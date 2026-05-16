import { useQuery } from '@tanstack/react-query';

import { rolesApi, type RoleListParams } from '../api/roles.api';

export function useRoles(params?: RoleListParams) {
  return useQuery({
    queryKey: ['roles', params],
    queryFn: () => rolesApi.list(params),
  });
}
