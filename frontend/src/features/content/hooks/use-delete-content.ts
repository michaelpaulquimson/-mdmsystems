import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';

import { contentApi } from '../api/content.api';

export function useDeleteContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contentApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['content'] });
      toast.success('Content item deleted successfully.');
    },
    onError: (error: unknown) => {
      toast.error(parseApiError(error).message);
    },
  });
}
