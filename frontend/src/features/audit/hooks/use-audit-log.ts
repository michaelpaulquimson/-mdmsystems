import { useQuery } from '@tanstack/react-query';

import { auditApi, type AuditListParams } from '../api/audit.api';

export function useAuditLog(params?: AuditListParams) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => auditApi.list(params),
  });
}
