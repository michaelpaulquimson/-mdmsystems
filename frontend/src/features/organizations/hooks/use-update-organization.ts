import type { UpdateOrganizationInput } from '@mdm/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';

import { organizationsApi } from '../api/organizations.api';

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrganizationInput }) =>
      organizationsApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization updated successfully.');
    },
    onError: (error: unknown) => {
      toast.error(parseApiError(error).message);
    },
  });
}
