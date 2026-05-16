import { useQuery } from '@tanstack/react-query';

import { teamsApi, type TeamListParams } from '../api/teams.api';

export function useTeams(params?: TeamListParams) {
  return useQuery({
    queryKey: ['teams', params],
    queryFn: () => teamsApi.list(params),
  });
}
