import { useQuery } from '@tanstack/react-query';

import { usersApi, type UserListParams } from '../api/users.api';

export function useUsers(params?: UserListParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => usersApi.list(params),
  });
}
