import { getAssignedContent } from '@/features/content/api/content.api';
import { useQuery } from '@tanstack/react-query';

export function useAssignedContent(userId: string, enabled = true) {
  return useQuery({
    queryKey: ['content', 'assigned', userId],
    queryFn: () => getAssignedContent(userId),
    staleTime: 0,
    enabled: enabled && userId.length > 0,
  });
}
