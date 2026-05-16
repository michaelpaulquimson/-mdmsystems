import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';

import { teamsApi } from '../api/teams.api';

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team created successfully.');
    },
    onError: (error: unknown) => {
      toast.error(parseApiError(error).message);
    },
  });
}
