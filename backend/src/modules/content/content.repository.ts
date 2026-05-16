import type {
  ContentItem,
  CreateContentInput,
  ListFilters,
  Paginated,
  UpdateContentInput,
} from '@mdm/shared';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { BaseRepository } from '../../core/db/base.repository.js';

const ContentRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  assigned_to_user_id: z.string().nullable(),
  created_by_user_id: z.string().nullable(),
  organization_id: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

type ContentRow = z.infer<typeof ContentRowSchema>;

export interface ContentListFilters extends ListFilters {
  organizationId?: string;
  assignedToUserId?: string;
}

export interface IContentRepository {
  findById(id: string, client?: PoolClient): Promise<ContentItem | null>;
  findAll(filters: ContentListFilters, client?: PoolClient): Promise<Paginated<ContentItem>>;
  findAssignedToUser(
    userId: string,
    organizationId: string | null,
    client?: PoolClient,
  ): Promise<ContentItem[]>;
  create(
    input: CreateContentInput & { organizationId: string; createdByUserId: string },
    client?: PoolClient,
  ): Promise<ContentItem>;
  update(
    id: string,
    input: UpdateContentInput,
    organizationId: string,
    client?: PoolClient,
  ): Promise<ContentItem | null>;
  deleteById(id: string, client?: PoolClient): Promise<boolean>;
  withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T>;
}

export class ContentRepository
  extends BaseRepository<ContentItem, ContentRow>
  implements IContentRepository
{
  protected readonly table = 'content_items';
  protected readonly rowSchema = ContentRowSchema;

  constructor(pool: Pool) {
    super(pool);
  }

  protected toDomain(row: ContentRow): ContentItem {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      assignedToUserId: row.assigned_to_user_id,
      createdByUserId: row.created_by_user_id,
      organizationId: row.organization_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  override async findAll(
    filters: ContentListFilters,
    client?: PoolClient,
  ): Promise<Paginated<ContentItem>> {
    const db = client ?? this.pool;
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.organizationId) {
      conditions.push(`organization_id = $${idx++}`);
      params.push(filters.organizationId);
    }
    if (filters.assignedToUserId) {
      conditions.push(`assigned_to_user_id = $${idx++}`);
      params.push(filters.assignedToUserId);
    }
    if (filters.search) {
      conditions.push(`title ILIKE $${idx++}`);
      params.push(`%${filters.search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataParams = [...params, limit, offset];

    const { rows } = await db.query(
      `SELECT * FROM ${this.table} ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      dataParams,
    );
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM ${this.table} ${where}`,
      params,
    );
    const total = (countRows[0] as { total: number }).total;

    return {
      data: rows.map((r) => this.parseRow(r)),
      pagination: { total, limit, offset },
    };
  }

  async findAssignedToUser(
    userId: string,
    organizationId: string | null,
    client?: PoolClient,
  ): Promise<ContentItem[]> {
    const db = client ?? this.pool;
    const conditions = ['assigned_to_user_id = $1'];
    const params: unknown[] = [userId];
    let idx = 2;

    if (organizationId) {
      conditions.push(`organization_id = $${idx++}`);
      params.push(organizationId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const { rows } = await db.query(
      `SELECT * FROM ${this.table} ${where} ORDER BY created_at DESC`,
      params,
    );
    return rows.map((r) => this.parseRow(r));
  }

  async create(
    input: CreateContentInput & { organizationId: string; createdByUserId: string },
    client?: PoolClient,
  ): Promise<ContentItem> {
    const db = client ?? this.pool;
    const { rows } = await db.query(
      `INSERT INTO content_items (title, body, assigned_to_user_id, created_by_user_id, organization_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.title,
        input.body,
        input.assignedToUserId ?? null,
        input.createdByUserId,
        input.organizationId,
      ],
    );
    return this.parseRow(rows[0]);
  }

  async update(
    id: string,
    input: UpdateContentInput,
    organizationId: string,
    client?: PoolClient,
  ): Promise<ContentItem | null> {
    const db = client ?? this.pool;
    const fieldMap: Record<string, string> = {
      title: 'title',
      body: 'body',
      assignedToUserId: 'assigned_to_user_id',
    };

    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return this.findById(id, client);

    const setClauses = fields.map(([key], i) => `${fieldMap[key] ?? key} = $${i + 1}`);
    const values = fields.map(([, v]) => v);
    values.push(id, organizationId);

    const { rows } = await db.query(
      `UPDATE content_items
       SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length - 1} AND organization_id = $${values.length}
       RETURNING *`,
      values,
    );
    return rows[0] ? this.parseRow(rows[0]) : null;
  }
}
