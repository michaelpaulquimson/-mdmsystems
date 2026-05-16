import type { Team, CreateTeamInput, UpdateTeamInput, Paginated } from '@mdm/shared';

import { apiClient } from '@/shared/api/client';

export interface TeamListParams {
  limit?: number;
  offset?: number;
  search?: string;
  organizationId?: string;
}

export const teamsApi = {
  list: (params?: TeamListParams) =>
    apiClient.get<Paginated<Team>>('/api/v1/teams', { params }).then((r) => r.data),

  get: (id: string) => apiClient.get<Team>(`/api/v1/teams/${id}`).then((r) => r.data),

  create: (data: CreateTeamInput) =>
    apiClient.post<Team>('/api/v1/teams', data).then((r) => r.data),

  update: (id: string, data: UpdateTeamInput) =>
    apiClient.patch<Team>(`/api/v1/teams/${id}`, data).then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/api/v1/teams/${id}`),
};
