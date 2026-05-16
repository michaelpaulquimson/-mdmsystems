import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';

import { organizationsApi } from '../api/organizations.api';

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => organizationsApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization deleted successfully.');
    },
    onError: (error: unknown) => {
      toast.error(parseApiError(error).message);
    },
  });
}
