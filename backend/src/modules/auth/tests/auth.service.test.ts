import { hash as bcryptHash } from 'bcrypt';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env before auth.service.ts resolves it (static imports are hoisted; vi.mock is hoisted further)
vi.mock('../../../core/config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://mdm:mdm@localhost:5432/mdm_test',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-here',
    BACKEND_PORT: 4000,
    CORS_ORIGINS: 'http://localhost:5173',
    LOG_LEVEL: 'info',
    BCRYPT_ROUNDS: 1,
  },
}));

import { makeAuthUser, makeUser } from '../../../../tests/factories/index.js';
import { UnauthorizedError } from '../../../core/errors/http-errors.js';
import type { IAuditService } from '../../audit/audit.service.js';
import type { IUserRepository } from '../../users/user.repository.js';
import { AuthService } from '../auth.service.js';
import type { IRefreshTokenRepository } from '../refresh-token.repository.js';

// ─── Fake factory helpers ──────────────────────────────────────────────────────

const makeUserRepo = (): IUserRepository => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  findByEmail: vi.fn(),
  findByEmailWithPasswordHash: vi.fn(),
  findPermissionsForUser: vi.fn(),
  getEmailById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  withTransaction: vi.fn((fn) => fn({} as never)),
});

const makeRefreshTokenRepo = (): IRefreshTokenRepository => ({
  create: vi.fn(),
  findByHash: vi.fn(),
  revoke: vi.fn(),
  revokeChainForUser: vi.fn(),
  setReplacedBy: vi.fn(),
});

const makeAuditService = (): IAuditService => ({
  record: vi.fn().mockResolvedValue(undefined),
  list: vi.fn(),
});

// ─── Constants ────────────────────────────────────────────────────────────────

const FAKE_RAW_TOKEN = 'fake-raw-refresh-token';
const FAKE_NEW_RAW_TOKEN = 'fake-new-raw-refresh-token';
const ctx = { ip: '127.0.0.1', userAgent: 'test-agent' };

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let userRepo: ReturnType<typeof makeUserRepo>;
  let refreshTokenRepo: ReturnType<typeof makeRefreshTokenRepo>;
  let auditService: ReturnType<typeof makeAuditService>;
  let service: AuthService;

  beforeEach(() => {
    userRepo = makeUserRepo();
    refreshTokenRepo = makeRefreshTokenRepo();
    auditService = makeAuditService();
    service = new AuthService(userRepo, refreshTokenRepo, auditService as IAuditService);
  });

  // ─── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns accessToken + refreshToken + user for correct credentials', async () => {
      const user = makeUser({ email: 'test@example.com' });
      const passwordHash = await bcryptHash('correct-password', 1);
      const userWithHash = { ...user, passwordHash };

      vi.mocked(userRepo.findByEmailWithPasswordHash).mockResolvedValue(userWithHash);
      vi.mocked(userRepo.findPermissionsForUser).mockResolvedValue(['content:read']);
      vi.mocked(refreshTokenRepo.create).mockResolvedValue(FAKE_RAW_TOKEN);

      const result = await service.login(
        { email: 'test@example.com', password: 'correct-password' },
        ctx,
      );

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBe(FAKE_RAW_TOKEN);
      expect(result.user).toMatchObject({ id: user.id, email: user.email });
    });

    it('throws UnauthorizedError for wrong password', async () => {
      const user = makeUser();
      const passwordHash = await bcryptHash('real-password', 1);
      vi.mocked(userRepo.findByEmailWithPasswordHash).mockResolvedValue({
        ...user,
        passwordHash,
      });

      await expect(
        service.login({ email: user.email, password: 'wrong-password' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError for unknown email', async () => {
      vi.mocked(userRepo.findByEmailWithPasswordHash).mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'any' }, ctx),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('records a login audit event', async () => {
      const user = makeUser();
      const passwordHash = await bcryptHash('pass1word', 1);
      vi.mocked(userRepo.findByEmailWithPasswordHash).mockResolvedValue({ ...user, passwordHash });
      vi.mocked(userRepo.findPermissionsForUser).mockResolvedValue([]);
      vi.mocked(refreshTokenRepo.create).mockResolvedValue(FAKE_RAW_TOKEN);

      await service.login({ email: user.email, password: 'pass1word' }, ctx);

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login', entityType: 'user', entityId: user.id }),
      );
    });
  });

  // ─── me ─────────────────────────────────────────────────────────────────────

  describe('me', () => {
    it('returns the actor directly', async () => {
      const actor = makeAuthUser();
      const result = await service.me(actor);
      expect(result).toEqual(actor);
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('returns new accessToken and refreshToken for valid token', async () => {
      const user = makeUser();
      const authUser = makeAuthUser({ id: user.id });

      const validTokenRow = {
        id: 'token-id-1',
        user_id: user.id,
        token_hash: 'some-hash',
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1_000_000).toISOString(),
        revoked_at: null,
        replaced_by: null,
        user_agent: null,
        ip_address: null,
      };

      // withTransaction passes through
      vi.mocked(userRepo.withTransaction).mockImplementation((fn) => fn({} as never));
      vi.mocked(refreshTokenRepo.findByHash).mockResolvedValue(validTokenRow);
      vi.mocked(refreshTokenRepo.revoke).mockResolvedValue(undefined);
      vi.mocked(refreshTokenRepo.create).mockResolvedValue(FAKE_NEW_RAW_TOKEN);
      vi.mocked(userRepo.findById).mockResolvedValue(authUser);
      vi.mocked(userRepo.findPermissionsForUser).mockResolvedValue([]);

      // For setReplacedBy: we need findByHash to return a new token row on second call
      const newTokenRow = { ...validTokenRow, id: 'token-id-2', token_hash: 'new-hash' };
      vi.mocked(refreshTokenRepo.findByHash)
        .mockResolvedValueOnce(validTokenRow)
        .mockResolvedValueOnce(newTokenRow);
      vi.mocked(refreshTokenRepo.setReplacedBy).mockResolvedValue(undefined);

      const result = await service.refresh({ refreshToken: FAKE_RAW_TOKEN }, ctx);

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBe(FAKE_NEW_RAW_TOKEN);
    });

    it('throws UnauthorizedError for revoked token', async () => {
      const revokedRow = {
        id: 'token-id',
        user_id: 'user-id',
        token_hash: 'hash',
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1_000_000).toISOString(),
        revoked_at: new Date().toISOString(),
        replaced_by: null,
        user_agent: null,
        ip_address: null,
      };

      vi.mocked(userRepo.withTransaction).mockImplementation((fn) => fn({} as never));
      vi.mocked(refreshTokenRepo.findByHash).mockResolvedValue(revokedRow);

      await expect(service.refresh({ refreshToken: 'any-token' }, ctx)).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    });

    it('throws UnauthorizedError for expired token', async () => {
      const expiredRow = {
        id: 'token-id',
        user_id: 'user-id',
        token_hash: 'hash',
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() - 1_000).toISOString(), // in the past
        revoked_at: null,
        replaced_by: null,
        user_agent: null,
        ip_address: null,
      };

      vi.mocked(userRepo.withTransaction).mockImplementation((fn) => fn({} as never));
      vi.mocked(refreshTokenRepo.findByHash).mockResolvedValue(expiredRow);

      await expect(service.refresh({ refreshToken: 'any-token' }, ctx)).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    });

    it('throws UnauthorizedError when token not found', async () => {
      vi.mocked(userRepo.withTransaction).mockImplementation((fn) => fn({} as never));
      vi.mocked(refreshTokenRepo.findByHash).mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: 'nonexistent' }, ctx)).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    });

    it('calls revokeChainForUser and throws when reuse (replaced_by is set)', async () => {
      const reuseRow = {
        id: 'token-id',
        user_id: 'user-id',
        token_hash: 'hash',
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1_000_000).toISOString(),
        revoked_at: null,
        replaced_by: 'some-other-token-id', // indicates this token was already rotated
        user_agent: null,
        ip_address: null,
      };

      vi.mocked(userRepo.withTransaction).mockImplementation((fn) => fn({} as never));
      vi.mocked(refreshTokenRepo.findByHash).mockResolvedValue(reuseRow);
      vi.mocked(refreshTokenRepo.revokeChainForUser).mockResolvedValue(undefined);

      await expect(service.refresh({ refreshToken: 'reused-token' }, ctx)).rejects.toBeInstanceOf(
        UnauthorizedError,
      );

      expect(refreshTokenRepo.revokeChainForUser).toHaveBeenCalledWith(
        reuseRow.user_id,
        expect.anything(),
      );
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('calls refreshTokenRepo.revoke and records audit', async () => {
      const actor = makeAuthUser();
      const tokenRow = {
        id: 'token-id',
        user_id: actor.id,
        token_hash: 'hash',
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1_000_000).toISOString(),
        revoked_at: null,
        replaced_by: null,
        user_agent: null,
        ip_address: null,
      };

      vi.mocked(refreshTokenRepo.findByHash).mockResolvedValue(tokenRow);
      vi.mocked(refreshTokenRepo.revoke).mockResolvedValue(undefined);

      await service.logout(FAKE_RAW_TOKEN, actor, ctx);

      expect(refreshTokenRepo.revoke).toHaveBeenCalledWith(tokenRow.id);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'logout', entityType: 'user', entityId: actor.id }),
      );
    });

    it('skips revoke when token row not found but still records audit', async () => {
      const actor = makeAuthUser();
      vi.mocked(refreshTokenRepo.findByHash).mockResolvedValue(null);

      await service.logout('unknown-token', actor, ctx);

      expect(refreshTokenRepo.revoke).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'logout' }),
      );
    });
  });
});
