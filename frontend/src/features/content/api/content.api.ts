import type { ContentItem, CreateContentInput, UpdateContentInput, Paginated } from '@mdm/shared';

import { apiClient } from '@/shared/api/client';

export interface ContentListParams {
  limit?: number;
  offset?: number;
  assignedToUserId?: string;
}

export const contentApi = {
  list: (params?: ContentListParams) =>
    apiClient.get<Paginated<ContentItem>>('/api/v1/content', { params }).then((r) => r.data),

  getAssigned: (userId: string) =>
    apiClient.get<Paginated<ContentItem>>(`/api/v1/content/assigned/${userId}`).then((r) => r.data),

  create: (data: CreateContentInput) =>
    apiClient.post<ContentItem>('/api/v1/content', data).then((r) => r.data),

  update: (id: string, data: UpdateContentInput) =>
    apiClient.patch<ContentItem>(`/api/v1/content/${id}`, data).then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/api/v1/content/${id}`),
};
