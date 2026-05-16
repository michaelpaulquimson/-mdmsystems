import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';

import { usersApi } from '../api/users.api';

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully.');
    },
    onError: (error: unknown) => {
      toast.error(parseApiError(error).message);
    },
  });
}
