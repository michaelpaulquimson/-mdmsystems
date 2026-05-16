import { randomBytes, createHash } from 'crypto';

import type { Pool, PoolClient } from 'pg';

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  replaced_by: string | null;
  user_agent: string | null;
  ip_address: string | null;
}

interface CreateRefreshTokenInput {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface IRefreshTokenRepository {
  create(input: CreateRefreshTokenInput, client?: PoolClient): Promise<string>;
  findByHash(hash: string, client?: PoolClient): Promise<RefreshTokenRow | null>;
  revoke(id: string, client?: PoolClient): Promise<void>;
  revokeChainForUser(userId: string, client?: PoolClient): Promise<void>;
  setReplacedBy(id: string, replacedById: string, client?: PoolClient): Promise<void>;
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateRefreshTokenInput, client?: PoolClient): Promise<string> {
    const db = client ?? this.pool;
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, NOW() + INTERVAL '30 days', $3, $4)`,
      [input.userId, tokenHash, input.userAgent ?? null, input.ipAddress ?? null],
    );

    return rawToken;
  }

  async findByHash(hash: string, client?: PoolClient): Promise<RefreshTokenRow | null> {
    const db = client ?? this.pool;
    const { rows } = await db.query<RefreshTokenRow>(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1`,
      [hash],
    );
    return rows[0] ?? null;
  }

  async revoke(id: string, client?: PoolClient): Promise<void> {
    const db = client ?? this.pool;
    await db.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [id]);
  }

  async revokeChainForUser(userId: string, client?: PoolClient): Promise<void> {
    const db = client ?? this.pool;
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  async setReplacedBy(id: string, replacedById: string, client?: PoolClient): Promise<void> {
    const db = client ?? this.pool;
    await db.query(`UPDATE refresh_tokens SET replaced_by = $2 WHERE id = $1`, [id, replacedById]);
  }
}
