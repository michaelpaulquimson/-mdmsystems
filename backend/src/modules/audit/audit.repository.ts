import type { ListFilters, Paginated } from '@mdm/shared';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

export interface CreateAuditInput {
  actorUserId: string | null;
  action:
    | 'create'
    | 'update'
    | 'delete'
    | 'login'
    | 'logout'
    | 'refresh-reuse-detected'
    | 'token-refreshed';
  entityType: string;
  entityId: string | null;
  organizationId: string | null;
  before: unknown;
  after: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  organizationId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  occurredAt: string;
}

export type AuditFilters = ListFilters & {
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
};

export interface IAuditRepository {
  create(input: CreateAuditInput, client?: PoolClient): Promise<void>;
  findAll(filters: AuditFilters, client?: PoolClient): Promise<Paginated<AuditLogEntry>>;
}

const AuditRowSchema = z.object({
  id: z.string(),
  actor_user_id: z.string().nullable(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  organization_id: z.string().nullable(),
  before: z.unknown(),
  after: z.unknown(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  occurred_at: z.coerce.date(),
});

type AuditRow = z.infer<typeof AuditRowSchema>;

function toDomain(row: AuditRow): AuditLogEntry {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    organizationId: row.organization_id,
    before: row.before,
    after: row.after,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    occurredAt: row.occurred_at.toISOString(),
  };
}

export class AuditRepository implements IAuditRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateAuditInput, client?: PoolClient): Promise<void> {
    const db = client ?? this.pool;
    await db.query(
      `INSERT INTO audit_log
        (actor_user_id, action, entity_type, entity_id, organization_id, before, after, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.actorUserId,
        input.action,
        input.entityType,
        input.entityId,
        input.organizationId,
        JSON.stringify(input.before),
        JSON.stringify(input.after),
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );
  }

  async findAll(filters: AuditFilters, client?: PoolClient): Promise<Paginated<AuditLogEntry>> {
    const db = client ?? this.pool;
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.actorUserId) {
      conditions.push(`actor_user_id = $${idx++}`);
      params.push(filters.actorUserId);
    }
    if (filters.entityType) {
      conditions.push(`entity_type = $${idx++}`);
      params.push(filters.entityType);
    }
    if (filters.entityId) {
      conditions.push(`entity_id = $${idx++}`);
      params.push(filters.entityId);
    }
    if (filters.organizationId) {
      conditions.push(`organization_id = $${idx++}`);
      params.push(filters.organizationId);
    }
    if (filters.from) {
      conditions.push(`occurred_at >= $${idx++}`);
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`occurred_at <= $${idx++}`);
      params.push(filters.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataParams = [...params, limit, offset];
    const { rows } = await db.query(
      `SELECT * FROM audit_log ${where} ORDER BY occurred_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      dataParams,
    );
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM audit_log ${where}`,
      params,
    );
    const total = (countRows[0] as { total: number }).total;

    return {
      data: rows.map((r) => toDomain(AuditRowSchema.parse(r))),
      pagination: { total, limit, offset },
    };
  }
}
