import type { CreateUserInput, ListFilters, Paginated, UpdateUserInput, User } from '@mdm/shared';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { BaseRepository } from '../../core/db/base.repository.js';
import { ConflictError } from '../../core/errors/http-errors.js';

const UserRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  password_hash: z.string(),
  is_admin: z.boolean(),
  organization_id: z.string().nullable(),
  team_id: z.string().nullable(),
  role_id: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

type UserRow = z.infer<typeof UserRowSchema>;

export type UserDomain = User;
export type UserWithHash = User & { passwordHash: string };

export interface UserListFilters extends ListFilters {
  organizationId?: string;
}

export interface IUserRepository {
  findById(id: string, client?: PoolClient): Promise<User | null>;
  findAll(filters: UserListFilters, client?: PoolClient): Promise<Paginated<User>>;
  findByEmail(email: string, client?: PoolClient): Promise<User | null>;
  findByEmailWithPasswordHash(email: string, client?: PoolClient): Promise<UserWithHash | null>;
  findPermissionsForUser(userId: string, client?: PoolClient): Promise<string[]>;
  getEmailById(userId: string, client?: PoolClient): Promise<string | null>;
  create(input: CreateUserInput & { passwordHash: string }, client?: PoolClient): Promise<User>;
  update(
    id: string,
    input: UpdateUserInput & { passwordHash?: string },
    client?: PoolClient,
  ): Promise<User | null>;
  deleteById(id: string, client?: PoolClient): Promise<boolean>;
  withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T>;
}

export class UserRepository extends BaseRepository<User, UserRow> implements IUserRepository {
  protected readonly table = 'users';
  protected readonly rowSchema = UserRowSchema;

  constructor(pool: Pool) {
    super(pool);
  }

  protected toDomain(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      isAdmin: row.is_admin,
      organizationId: row.organization_id,
      teamId: row.team_id,
      roleId: row.role_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  override async findAll(filters: UserListFilters, client?: PoolClient): Promise<Paginated<User>> {
    const db = client ?? this.pool;
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.organizationId) {
      conditions.push(`u.organization_id = $${idx++}`);
      params.push(filters.organizationId);
    }
    if (filters.search) {
      conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataParams = [...params, limit, offset];

    const { rows } = await db.query(
      `SELECT u.* FROM users u ${where} ORDER BY u.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      dataParams,
    );
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM users u ${where}`,
      params,
    );
    const total = (countRows[0] as { total: number }).total;

    return {
      data: rows.map((r) => this.parseRow(r)),
      pagination: { total, limit, offset },
    };
  }

  async findByEmail(email: string, client?: PoolClient): Promise<User | null> {
    const db = client ?? this.pool;
    const { rows } = await db.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    return rows[0] ? this.parseRow(rows[0]) : null;
  }

  async findByEmailWithPasswordHash(
    email: string,
    client?: PoolClient,
  ): Promise<UserWithHash | null> {
    const db = client ?? this.pool;
    const { rows } = await db.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    if (!rows[0]) return null;
    const parsed = UserRowSchema.parse(rows[0]);
    const domain = this.toDomain(parsed);
    return { ...domain, passwordHash: parsed.password_hash };
  }

  async findPermissionsForUser(userId: string, client?: PoolClient): Promise<string[]> {
    const db = client ?? this.pool;
    const { rows } = await db.query<{ permissions: string[] }>(
      `SELECT COALESCE(r.permissions, '[]'::jsonb) AS permissions FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [userId],
    );
    return rows[0]?.permissions ?? [];
  }

  async getEmailById(userId: string, client?: PoolClient): Promise<string | null> {
    const db = client ?? this.pool;
    const { rows } = await db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [
      userId,
    ]);
    return rows[0]?.email ?? null;
  }

  async create(
    input: CreateUserInput & { passwordHash: string },
    client?: PoolClient,
  ): Promise<User> {
    const db = client ?? this.pool;
    try {
      const { rows } = await db.query(
        `INSERT INTO users (email, name, password_hash, is_admin, organization_id, team_id, role_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          input.email,
          input.name,
          input.passwordHash,
          input.isAdmin ?? false,
          input.organizationId ?? null,
          input.teamId ?? null,
          input.roleId ?? null,
        ],
      );
      return this.parseRow(rows[0]);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictError('Email already in use');
      }
      throw err;
    }
  }

  async update(
    id: string,
    input: UpdateUserInput & { passwordHash?: string },
    client?: PoolClient,
  ): Promise<User | null> {
    const db = client ?? this.pool;

    const fieldMap: Record<string, string> = {
      email: 'email',
      name: 'name',
      isAdmin: 'is_admin',
      organizationId: 'organization_id',
      teamId: 'team_id',
      roleId: 'role_id',
      passwordHash: 'password_hash',
    };

    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return this.findById(id, client);

    const setClauses = fields.map(([key], i) => `${fieldMap[key] ?? key} = $${i + 1}`);
    const values = fields.map(([, v]) => v);
    values.push(id);

    const { rows } = await db.query(
      `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    return rows[0] ? this.parseRow(rows[0]) : null;
  }
}
