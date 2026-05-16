import type { User, CreateUserInput, UpdateUserInput, Paginated } from '@mdm/shared';

import { apiClient } from '@/shared/api/client';

export interface UserListParams {
  limit?: number;
  offset?: number;
  search?: string;
  organizationId?: string;
}

export const usersApi = {
  list: (params?: UserListParams) =>
    apiClient.get<Paginated<User>>('/api/v1/users', { params }).then((r) => r.data),

  get: (id: string) => apiClient.get<User>(`/api/v1/users/${id}`).then((r) => r.data),

  create: (data: CreateUserInput) =>
    apiClient.post<User>('/api/v1/users', data).then((r) => r.data),

  update: (id: string, data: UpdateUserInput) =>
    apiClient.patch<User>(`/api/v1/users/${id}`, data).then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/api/v1/users/${id}`),
};
