import type { Paginated } from '@mdm/shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeContentItem, makeAuthUser, makeUser } from '../../../../tests/factories/index.js';
import { NotFoundError, ForbiddenError } from '../../../core/errors/http-errors.js';
import type { IAuditService } from '../../audit/audit.service.js';
import type { IUserRepository } from '../../users/user.repository.js';
import type { IContentRepository } from '../content.repository.js';
import { ContentService } from '../content.service.js';

// ─── Fake factory helpers ──────────────────────────────────────────────────────

const makeContentRepo = (): IContentRepository => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  findAssignedToUser: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  withTransaction: vi.fn((fn) => fn({} as never)),
});

const makeUserRepo = (): Pick<IUserRepository, 'findById'> & Record<string, unknown> => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  findByEmail: vi.fn(),
  findByEmailWithPasswordHash: vi.fn(),
  findPermissionsForUser: vi.fn(),
  getEmailById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  withTransaction: vi.fn((fn: (tx: never) => unknown) => fn({} as never)),
});

const makeAuditService = (): IAuditService => ({
  record: vi.fn().mockResolvedValue(undefined),
  list: vi.fn(),
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ContentService', () => {
  let contentRepo: ReturnType<typeof makeContentRepo>;
  let userRepo: ReturnType<typeof makeUserRepo>;
  let auditService: ReturnType<typeof makeAuditService>;
  let service: ContentService;

  const adminActor = makeAuthUser({ isAdmin: true, organizationId: null });
  const orgId = '00000000-0000-0000-0000-000000000001';
  const memberActor = makeAuthUser({ isAdmin: false, organizationId: orgId });

  beforeEach(() => {
    contentRepo = makeContentRepo();
    userRepo = makeUserRepo();
    auditService = makeAuditService();
    service = new ContentService(
      contentRepo,
      userRepo as unknown as IUserRepository,
      auditService as IAuditService,
    );
  });

  // ─── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('delegates to repo.findAll with no org filter for admin', async () => {
      const paginated: Paginated<ReturnType<typeof makeContentItem>> = {
        data: [makeContentItem()],
        pagination: { total: 1, limit: 50, offset: 0 },
      };
      vi.mocked(contentRepo.findAll).mockResolvedValue(paginated);

      const result = await service.list(adminActor, { limit: 50, offset: 0 });

      expect(result).toEqual(paginated);
      // Admin should not inject organizationId filter
      expect(contentRepo.findAll).toHaveBeenCalledWith(
        expect.not.objectContaining({ organizationId: expect.anything() }),
      );
    });

    it('injects organizationId filter from actor for non-admin', async () => {
      const paginated: Paginated<ReturnType<typeof makeContentItem>> = {
        data: [],
        pagination: { total: 0, limit: 50, offset: 0 },
      };
      vi.mocked(contentRepo.findAll).mockResolvedValue(paginated);

      await service.list(memberActor, { limit: 50, offset: 0 });

      expect(contentRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: orgId }),
      );
    });
  });

  // ─── getAssignedToUser ───────────────────────────────────────────────────────

  describe('getAssignedToUser', () => {
    it('returns assigned content when user exists in same org', async () => {
      const targetUser = makeUser({ id: 'user-1', organizationId: orgId });
      const items = [makeContentItem({ organizationId: orgId })];
      vi.mocked(userRepo.findById).mockResolvedValue(targetUser);
      vi.mocked(contentRepo.findAssignedToUser).mockResolvedValue(items);

      const result = await service.getAssignedToUser('user-1', memberActor);

      expect(result).toEqual(items);
      expect(contentRepo.findAssignedToUser).toHaveBeenCalledWith('user-1', orgId);
    });

    it('throws NotFoundError when target user does not exist', async () => {
      vi.mocked(userRepo.findById).mockResolvedValue(null);
      await expect(service.getAssignedToUser('missing', memberActor)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('throws NotFoundError (not 403) when non-admin accesses cross-org user', async () => {
      const otherOrgUser = makeUser({ organizationId: 'other-org' });
      vi.mocked(userRepo.findById).mockResolvedValue(otherOrgUser);

      await expect(service.getAssignedToUser(otherOrgUser.id, memberActor)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates content item and records audit in same transaction', async () => {
      const item = makeContentItem({ organizationId: orgId });
      vi.mocked(contentRepo.create).mockResolvedValue(item);

      const result = await service.create({ title: 'Test', body: 'Body' }, memberActor);

      expect(result).toEqual(item);
      expect(contentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test',
          body: 'Body',
          organizationId: orgId,
          createdByUserId: memberActor.id,
        }),
        expect.anything(),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', entityType: 'content_item' }),
        expect.anything(),
      );
    });

    it('throws ForbiddenError when actor has no org and is not admin', async () => {
      const noOrgActor = makeAuthUser({ isAdmin: false, organizationId: null });
      await expect(service.create({ title: 'x', body: 'y' }, noOrgActor)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it('throws ForbiddenError when admin has no org context', async () => {
      // Admin without organizationId cannot create content (no org context)
      await expect(service.create({ title: 'x', body: 'y' }, adminActor)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates content and records audit', async () => {
      const before = makeContentItem({ organizationId: orgId });
      const after = { ...before, title: 'New Title' };
      vi.mocked(contentRepo.findById).mockResolvedValue(before);
      vi.mocked(contentRepo.update).mockResolvedValue(after);

      const result = await service.update(before.id, { title: 'New Title' }, memberActor);

      expect(result.title).toBe('New Title');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', entityType: 'content_item', before, after }),
        expect.anything(),
      );
    });

    it('throws NotFoundError when content item does not exist', async () => {
      vi.mocked(contentRepo.findById).mockResolvedValue(null);
      await expect(service.update('missing', { title: 'x' }, memberActor)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('throws NotFoundError (not 403) for cross-org access by non-admin', async () => {
      const otherOrgItem = makeContentItem({ organizationId: 'other-org' });
      vi.mocked(contentRepo.findById).mockResolvedValue(otherOrgItem);

      await expect(
        service.update(otherOrgItem.id, { title: 'x' }, memberActor),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes content and records audit', async () => {
      const item = makeContentItem({ organizationId: orgId });
      vi.mocked(contentRepo.findById).mockResolvedValue(item);
      vi.mocked(contentRepo.deleteById).mockResolvedValue(true);

      await service.delete(item.id, memberActor);

      expect(contentRepo.deleteById).toHaveBeenCalledWith(item.id, expect.anything());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entityType: 'content_item',
          before: item,
          after: null,
        }),
        expect.anything(),
      );
    });

    it('throws NotFoundError when content item does not exist', async () => {
      vi.mocked(contentRepo.findById).mockResolvedValue(null);
      await expect(service.delete('missing', memberActor)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws NotFoundError (not 403) for cross-org delete by non-admin', async () => {
      const otherOrgItem = makeContentItem({ organizationId: 'other-org' });
      vi.mocked(contentRepo.findById).mockResolvedValue(otherOrgItem);

      await expect(service.delete(otherOrgItem.id, memberActor)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
