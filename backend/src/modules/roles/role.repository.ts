import type { CreateRoleInput, ListFilters, Paginated, Role, UpdateRoleInput } from '@mdm/shared';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { BaseRepository } from '../../core/db/base.repository.js';
import { ConflictError } from '../../core/errors/http-errors.js';

const RoleRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  permissions: z.array(z.string()),
  created_at: z.coerce.date(),
});

type RoleRow = z.infer<typeof RoleRowSchema>;

export interface IRoleRepository {
  findById(id: string, client?: PoolClient): Promise<Role | null>;
  findAll(filters: ListFilters, client?: PoolClient): Promise<Paginated<Role>>;
  create(input: CreateRoleInput, client?: PoolClient): Promise<Role>;
  update(id: string, input: UpdateRoleInput, client?: PoolClient): Promise<Role | null>;
  deleteById(id: string, client?: PoolClient): Promise<boolean>;
  withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T>;
}

export class RoleRepository extends BaseRepository<Role, RoleRow> implements IRoleRepository {
  protected readonly table = 'roles';
  protected readonly rowSchema = RoleRowSchema;

  constructor(pool: Pool) {
    super(pool);
  }

  protected toDomain(row: RoleRow): Role {
    return {
      id: row.id,
      name: row.name,
      permissions: row.permissions,
      createdAt: row.created_at.toISOString(),
    };
  }

  override async findAll(filters: ListFilters, client?: PoolClient): Promise<Paginated<Role>> {
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

  async create(input: CreateRoleInput, client?: PoolClient): Promise<Role> {
    const db = client ?? this.pool;
    try {
      const { rows } = await db.query(
        `INSERT INTO roles (name, permissions) VALUES ($1, $2) RETURNING *`,
        [input.name, JSON.stringify(input.permissions)],
      );
      return this.parseRow(rows[0]);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictError('Role name already exists');
      }
      throw err;
    }
  }

  async update(id: string, input: UpdateRoleInput, client?: PoolClient): Promise<Role | null> {
    const db = client ?? this.pool;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.permissions !== undefined) {
      setClauses.push(`permissions = $${idx++}`);
      values.push(JSON.stringify(input.permissions));
    }

    if (setClauses.length === 0) return this.findById(id, client);

    values.push(id);
    const { rows } = await db.query(
      `UPDATE roles SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return rows[0] ? this.parseRow(rows[0]) : null;
  }
}
