import type { UpdateTeamInput } from '@mdm/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';

import { teamsApi } from '../api/teams.api';

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeamInput }) => teamsApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team updated successfully.');
    },
    onError: (error: unknown) => {
      toast.error(parseApiError(error).message);
    },
  });
}
