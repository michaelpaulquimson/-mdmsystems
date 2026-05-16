import { useQuery } from '@tanstack/react-query';

import { organizationsApi, type OrganizationListParams } from '../api/organizations.api';

export function useOrganizations(params?: OrganizationListParams) {
  return useQuery({
    queryKey: ['organizations', params],
    queryFn: () => organizationsApi.list(params),
  });
}
