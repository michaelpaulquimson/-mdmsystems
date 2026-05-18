import { apiClient } from '@/shared/api/client';
import type { User } from '@mdm/shared';

export async function getUsers(): Promise<User[]> {
  const { data } = await apiClient.get<{ data: User[] }>('/users?limit=200');
  return data.data;
}
