import type {
  Organization,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  Paginated,
} from '@mdm/shared';

import { apiClient } from '@/shared/api/client';

export interface OrganizationListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export const organizationsApi = {
  list: (params?: OrganizationListParams) =>
    apiClient.get<Paginated<Organization>>('/api/v1/organizations', { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Organization>(`/api/v1/organizations/${id}`).then((r) => r.data),

  create: (data: CreateOrganizationInput) =>
    apiClient.post<Organization>('/api/v1/organizations', data).then((r) => r.data),

  update: (id: string, data: UpdateOrganizationInput) =>
    apiClient.patch<Organization>(`/api/v1/organizations/${id}`, data).then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/api/v1/organizations/${id}`),
};
