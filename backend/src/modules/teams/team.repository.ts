import type { CreateTeamInput, ListFilters, Paginated, Team, UpdateTeamInput } from '@mdm/shared';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { BaseRepository } from '../../core/db/base.repository.js';
import { ConflictError } from '../../core/errors/http-errors.js';

const TeamRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  organization_id: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

type TeamRow = z.infer<typeof TeamRowSchema>;

export interface TeamListFilters extends ListFilters {
  organizationId?: string;
}

export interface ITeamRepository {
  findById(id: string, client?: PoolClient): Promise<Team | null>;
  findAll(filters: TeamListFilters, client?: PoolClient): Promise<Paginated<Team>>;
  findByOrgAndId(orgId: string, teamId: string, client?: PoolClient): Promise<Team | null>;
  create(input: CreateTeamInput, client?: PoolClient): Promise<Team>;
  update(id: string, input: UpdateTeamInput, client?: PoolClient): Promise<Team | null>;
  deleteById(id: string, client?: PoolClient): Promise<boolean>;
  withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T>;
}

export class TeamRepository extends BaseRepository<Team, TeamRow> implements ITeamRepository {
  protected readonly table = 'teams';
  protected readonly rowSchema = TeamRowSchema;

  constructor(pool: Pool) {
    super(pool);
  }

  protected toDomain(row: TeamRow): Team {
    return {
      id: row.id,
      name: row.name,
      organizationId: row.organization_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  override async findAll(filters: TeamListFilters, client?: PoolClient): Promise<Paginated<Team>> {
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

  async findByOrgAndId(orgId: string, teamId: string, client?: PoolClient): Promise<Team | null> {
    const db = client ?? this.pool;
    const { rows } = await db.query(
      `SELECT * FROM ${this.table} WHERE id = $1 AND organization_id = $2`,
      [teamId, orgId],
    );
    return rows[0] ? this.parseRow(rows[0]) : null;
  }

  async create(input: CreateTeamInput, client?: PoolClient): Promise<Team> {
    const db = client ?? this.pool;
    try {
      const { rows } = await db.query(
        `INSERT INTO teams (name, organization_id) VALUES ($1, $2) RETURNING *`,
        [input.name, input.organizationId],
      );
      return this.parseRow(rows[0]);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictError('Team name already exists in this organization');
      }
      throw err;
    }
  }

  async update(id: string, input: UpdateTeamInput, client?: PoolClient): Promise<Team | null> {
    const db = client ?? this.pool;
    const fieldMap: Record<string, string> = {
      name: 'name',
      organizationId: 'organization_id',
    };

    const fields = Object.entries(input).filter(([key, v]) => v !== undefined && key in fieldMap);
    if (fields.length === 0) return this.findById(id, client);

    const setClauses = fields.map(([key], i) => `${fieldMap[key]} = $${i + 1}`);
    const values = fields.map(([, v]) => v);
    values.push(id);

    const { rows } = await db.query(
      `UPDATE teams SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    return rows[0] ? this.parseRow(rows[0]) : null;
  }
}
