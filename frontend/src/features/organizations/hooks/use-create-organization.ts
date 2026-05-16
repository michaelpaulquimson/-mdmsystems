import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';

import { organizationsApi } from '../api/organizations.api';

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: organizationsApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization created successfully.');
    },
    onError: (error: unknown) => {
      toast.error(parseApiError(error).message);
    },
  });
}
