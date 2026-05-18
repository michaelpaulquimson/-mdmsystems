import { apiClient } from '@/shared/api/client';
import type { Paginated, Role } from '@mdm/shared';

export async function getRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<Paginated<Role>>('/roles?limit=200');
  return data.data;
}
