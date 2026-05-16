import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';

import { contentApi } from '../api/content.api';

export function useCreateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: contentApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['content'] });
      toast.success('Content item created successfully.');
    },
    onError: (error: unknown) => {
      toast.error(parseApiError(error).message);
    },
  });
}
