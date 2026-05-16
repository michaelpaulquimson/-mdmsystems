import { useQuery } from '@tanstack/react-query';

import { contentApi, type ContentListParams } from '../api/content.api';

export function useContentList(params?: ContentListParams) {
  return useQuery({
    queryKey: ['content', params],
    queryFn: () => contentApi.list(params),
  });
}
