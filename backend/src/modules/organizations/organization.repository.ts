import type {
  CreateOrganizationInput,
  ListFilters,
  Organization,
  Paginated,
  UpdateOrganizationInput,
} from '@mdm/shared';
import type { PoolClient, Pool } from 'pg';
import { z } from 'zod';

import { BaseRepository } from '../../core/db/base.repository.js';
import { ConflictError } from '../../core/errors/http-errors.js';

const OrgRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

type OrgRow = z.infer<typeof OrgRowSchema>;

export interface IOrganizationRepository {
  findById(id: string, client?: PoolClient): Promise<Organization | null>;
  findAll(filters: ListFilters, client?: PoolClient): Promise<Paginated<Organization>>;
  create(input: CreateOrganizationInput, client?: PoolClient): Promise<Organization>;
  update(
    id: string,
    input: UpdateOrganizationInput,
    client?: PoolClient,
  ): Promise<Organization | null>;
  deleteById(id: string, client?: PoolClient): Promise<boolean>;
  withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T>;
}

export class OrganizationRepository
  extends BaseRepository<Organization, OrgRow>
  implements IOrganizationRepository
{
  protected readonly table = 'organizations';
  protected readonly rowSchema = OrgRowSchema;

  constructor(pool: Pool) {
    super(pool);
  }

  protected toDomain(row: OrgRow): Organization {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  override async findAll(
    filters: ListFilters,
    client?: PoolClient,
  ): Promise<Paginated<Organization>> {
    const db = client ?? this.pool;
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.search) {
      conditions.push(`name ILIKE $${idx++}`);
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

  async create(input: CreateOrganizationInput, client?: PoolClient): Promise<Organization> {
    const db = client ?? this.pool;
    try {
      const { rows } = await db.query(`INSERT INTO organizations (name) VALUES ($1) RETURNING *`, [
        input.name,
      ]);
      return this.parseRow(rows[0]);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictError('Organization name already exists');
      }
      throw err;
    }
  }

  async update(
    id: string,
    input: UpdateOrganizationInput,
    client?: PoolClient,
  ): Promise<Organization | null> {
    const db = client ?? this.pool;
    const fieldMap: Record<string, string> = { name: 'name' };
    const fields = Object.entries(input).filter(
      ([k, v]) => v !== undefined && fieldMap[k] !== undefined,
    );
    if (fields.length === 0) return this.findById(id, client);

    const setClauses = fields.map(([key], i) => `${fieldMap[key]!} = $${i + 1}`);
    const values = fields.map(([, v]) => v);
    values.push(id);

    const { rows } = await db.query(
      `UPDATE organizations SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    return rows[0] ? this.parseRow(rows[0]) : null;
  }
}
