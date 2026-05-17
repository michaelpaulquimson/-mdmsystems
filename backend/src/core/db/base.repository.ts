import type { ListFilters, Paginated } from '@mdm/shared';
import type { Pool, PoolClient } from 'pg';
import type { ZodTypeDef, ZodType } from 'zod';

export abstract class BaseRepository<TDomain, TRow> {
  constructor(protected readonly pool: Pool) {}

  protected abstract readonly table: string;
  // Accept schemas that may coerce/transform the raw DB row (unknown input → TRow output)
  protected abstract readonly rowSchema: ZodType<TRow, ZodTypeDef, unknown>;
  protected abstract toDomain(row: TRow): TDomain;

  protected parseRow(raw: unknown): TDomain {
    return this.toDomain(this.rowSchema.parse(raw));
  }

  async findById(id: string, client?: PoolClient): Promise<TDomain | null> {
    const db = client ?? this.pool;
    const { rows } = await db.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
    const row = rows[0];
    return row ? this.parseRow(row) : null;
  }

  async findAll(filters: ListFilters, client?: PoolClient): Promise<Paginated<TDomain>> {
    const db = client ?? this.pool;
    const rawLimit = filters.limit;
    const rawOffset = filters.offset;
    const limit = Math.min(Number.isFinite(rawLimit) ? (rawLimit as number) : 50, 200);
    const offset =
      Number.isFinite(rawOffset) && (rawOffset as number) >= 0 ? (rawOffset as number) : 0;

    const { rows } = await db.query(
      `SELECT * FROM ${this.table} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const { rows: countRows } = await db.query(`SELECT COUNT(*)::int AS total FROM ${this.table}`);
    const total = (countRows[0] as { total: number }).total;

    return { data: rows.map((r) => this.parseRow(r)), pagination: { total, limit, offset } };
  }

  async deleteById(id: string, client?: PoolClient): Promise<boolean> {
    const db = client ?? this.pool;
    const { rowCount } = await db.query(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  }

  async withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
