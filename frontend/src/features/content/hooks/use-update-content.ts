import type { UpdateContentInput } from '@mdm/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { parseApiError } from '@/shared/api/error';

import { contentApi } from '../api/content.api';

export function useUpdateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContentInput }) =>
      contentApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['content'] });
      toast.success('Content item updated successfully.');
    },
    onError: (error: unknown) => {
      toast.error(parseApiError(error).message);
    },
  });
}
