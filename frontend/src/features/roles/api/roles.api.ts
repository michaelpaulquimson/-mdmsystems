import type { Role, CreateRoleInput, UpdateRoleInput, Paginated } from '@mdm/shared';

import { apiClient } from '@/shared/api/client';

export interface RoleListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export const rolesApi = {
  list: (params?: RoleListParams) =>
    apiClient.get<Paginated<Role>>('/api/v1/roles', { params }).then((r) => r.data),

  get: (id: string) => apiClient.get<Role>(`/api/v1/roles/${id}`).then((r) => r.data),

  create: (data: CreateRoleInput) =>
    apiClient.post<Role>('/api/v1/roles', data).then((r) => r.data),

  update: (id: string, data: UpdateRoleInput) =>
    apiClient.patch<Role>(`/api/v1/roles/${id}`, data).then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/api/v1/roles/${id}`),
};
