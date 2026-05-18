import { apiClient } from '@/shared/api/client';
import type { ContentItem } from '@mdm/shared';

export async function getAssignedContent(userId: string): Promise<ContentItem[]> {
  const { data } = await apiClient.get<ContentItem[]>(`/content/assigned/${userId}`);
  return data;
}
