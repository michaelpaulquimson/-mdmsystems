import { createHash } from 'crypto';

import type { AuthResponse, AuthUser, LoginInput, RefreshInput } from '@mdm/shared';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

import type { IRefreshTokenRepository } from './refresh-token.repository.js';
import { env } from '../../core/config/env.js';
import { UnauthorizedError } from '../../core/errors/http-errors.js';
import type { AuditService } from '../audit/audit.service.js';
import type { IUserRepository } from '../users/user.repository.js';

interface LoginContext {
  ip?: string;
  userAgent?: string;
}

type TokenPayload = AuthUser & { permissions: string[] };

export interface IAuthService {
  login(input: LoginInput, ctx: LoginContext): Promise<AuthResponse>;
  refresh(
    input: RefreshInput,
    ctx: LoginContext,
  ): Promise<{ accessToken: string; refreshToken: string }>;
  logout(refreshToken: string, actor: AuthUser, ctx: LoginContext): Promise<void>;
  me(actor: AuthUser): Promise<AuthUser>;
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function buildTokenPayload(user: AuthUser, permissions: string[]): TokenPayload {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    organizationId: user.organizationId,
    teamId: user.teamId,
    roleId: user.roleId,
    permissions,
  };
}

function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
}

export class AuthService implements IAuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly auditService: AuditService,
  ) {}

  async login(input: LoginInput, ctx: LoginContext): Promise<AuthResponse> {
    const userWithHash = await this.userRepo.findByEmailWithPasswordHash(input.email);
    if (!userWithHash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const { passwordHash, ...user } = userWithHash;
    const match = await bcrypt.compare(input.password, passwordHash);
    if (!match) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const permissions = await this.userRepo.findPermissionsForUser(user.id);
    const payload = buildTokenPayload(user, permissions);
    const accessToken = signAccessToken(payload);

    const refreshToken = await this.refreshTokenRepo.create({
      userId: user.id,
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
      ...(ctx.ip !== undefined && { ipAddress: ctx.ip }),
    });

    await this.auditService.record({
      actorUserId: user.id,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      organizationId: user.organizationId,
      before: null,
      after: null,
      ...(ctx.ip !== undefined && { ipAddress: ctx.ip }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    });

    return { accessToken, refreshToken, user };
  }

  async refresh(
    input: RefreshInput,
    ctx: LoginContext,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const hash = hashToken(input.refreshToken);

    return this.userRepo.withTransaction(async (tx) => {
      const tokenRow = await this.refreshTokenRepo.findByHash(hash, tx);

      if (!tokenRow) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Check reuse before revoked_at: a rotated token has both replaced_by and revoked_at set.
      // Testing revoked_at first would swallow the reuse signal and skip chain revocation.
      if (tokenRow.replaced_by !== null) {
        await this.refreshTokenRepo.revokeChainForUser(tokenRow.user_id, tx);
        await this.auditService.record(
          {
            actorUserId: tokenRow.user_id,
            action: 'refresh-reuse-detected',
            entityType: 'refresh_token',
            entityId: tokenRow.id,
            organizationId: null,
            before: null,
            after: null,
            ...(ctx.ip !== undefined && { ipAddress: ctx.ip }),
            ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
          },
          tx,
        );
        throw new UnauthorizedError('Token reuse detected — all sessions revoked');
      }

      if (tokenRow.revoked_at !== null || new Date(tokenRow.expires_at) < new Date()) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Revoke old token
      await this.refreshTokenRepo.revoke(tokenRow.id, tx);

      // Issue new refresh token
      const newRawToken = await this.refreshTokenRepo.create(
        {
          userId: tokenRow.user_id,
          ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
          ...(ctx.ip !== undefined && { ipAddress: ctx.ip }),
        },
        tx,
      );

      // Record the replacement chain
      const newHash = hashToken(newRawToken);
      const newTokenRow = await this.refreshTokenRepo.findByHash(newHash, tx);
      if (newTokenRow) {
        await this.refreshTokenRepo.setReplacedBy(tokenRow.id, newTokenRow.id, tx);
      }

      // Build new access token
      const userRecord = await this.userRepo.findById(tokenRow.user_id, tx);
      if (!userRecord) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      const permissions = await this.userRepo.findPermissionsForUser(userRecord.id, tx);
      const payload = buildTokenPayload(userRecord, permissions);
      const accessToken = signAccessToken(payload);

      await this.auditService.record(
        {
          actorUserId: userRecord.id,
          action: 'token-refreshed',
          entityType: 'refresh_token',
          entityId: tokenRow.id,
          organizationId: userRecord.organizationId,
          before: null,
          after: null,
          ...(ctx.ip !== undefined && { ipAddress: ctx.ip }),
          ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
        },
        tx,
      );

      return { accessToken, refreshToken: newRawToken };
    });
  }

  async logout(refreshToken: string, actor: AuthUser, ctx: LoginContext): Promise<void> {
    const hash = hashToken(refreshToken);
    const tokenRow = await this.refreshTokenRepo.findByHash(hash);
    if (tokenRow && tokenRow.user_id === actor.id) {
      await this.refreshTokenRepo.revoke(tokenRow.id);
    }

    await this.auditService.record({
      actorUserId: actor.id,
      action: 'logout',
      entityType: 'user',
      entityId: actor.id,
      organizationId: actor.organizationId,
      before: null,
      after: null,
      ...(ctx.ip !== undefined && { ipAddress: ctx.ip }),
      ...(ctx.userAgent !== undefined && { userAgent: ctx.userAgent }),
    });
  }

  async me(actor: AuthUser): Promise<AuthUser> {
    return actor;
  }
}
