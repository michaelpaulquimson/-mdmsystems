import { getRoles } from '@/features/roles/api/roles.api';
import { useQuery } from '@tanstack/react-query';

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
    staleTime: 60_000,
    enabled,
  });
}
