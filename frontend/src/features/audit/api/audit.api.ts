import type { Paginated } from '@mdm/shared';

import { apiClient } from '@/shared/api/client';

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  organizationId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  occurredAt: string;
}

export interface AuditListParams {
  actorUserId?: string;
  entityType?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export const auditApi = {
  list: (params?: AuditListParams) =>
    apiClient.get<Paginated<AuditLogEntry>>('/api/v1/audit', { params }).then((r) => r.data),
};
