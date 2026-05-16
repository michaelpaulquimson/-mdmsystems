import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';

import { rolesApi } from '../api/roles.api';

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rolesApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role created successfully.');
    },
    onError: (error: unknown) => {
      toast.error(parseApiError(error).message);
    },
  });
}
