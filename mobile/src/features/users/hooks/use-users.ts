import { getUsers } from '@/features/users/api/users.api';
import { useQuery } from '@tanstack/react-query';

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 60_000,
    enabled,
  });
}
