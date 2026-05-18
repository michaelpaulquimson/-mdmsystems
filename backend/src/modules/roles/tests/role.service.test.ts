import type { Paginated } from '@mdm/shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeRole, makeAuthUser } from '../../../../tests/factories/index.js';
import { NotFoundError } from '../../../core/errors/http-errors.js';
import type { IAuditService } from '../../audit/audit.service.js';
import type { IRoleRepository } from '../role.repository.js';
import { RoleService } from '../role.service.js';

const makeRoleRepo = (): IRoleRepository => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  withTransaction: vi.fn((fn) => fn({} as never)),
});

const makeAuditService = (): IAuditService => ({
  record: vi.fn().mockResolvedValue(undefined),
  list: vi.fn(),
});

describe('RoleService', () => {
  let repo: ReturnType<typeof makeRoleRepo>;
  let auditService: ReturnType<typeof makeAuditService>;
  let service: RoleService;

  const actor = makeAuthUser({ isAdmin: true });

  beforeEach(() => {
    repo = makeRoleRepo();
    auditService = makeAuditService();
    service = new RoleService(repo, auditService as IAuditService);
  });

  describe('get', () => {
    it('returns role when found', async () => {
      const role = makeRole();
      vi.mocked(repo.findById).mockResolvedValue(role);
      await expect(service.get(role.id, actor)).resolves.toEqual(role);
    });

    it('throws NotFoundError when role does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.get('missing', actor)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('list', () => {
    it('delegates to repo.findAll with provided filters', async () => {
      const paginated: Paginated<ReturnType<typeof makeRole>> = {
        data: [makeRole()],
        pagination: { total: 1, limit: 50, offset: 0 },
      };
      vi.mocked(repo.findAll).mockResolvedValue(paginated);
      const result = await service.list(actor, { limit: 50, offset: 0 });
      expect(result).toEqual(paginated);
      expect(repo.findAll).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    });
  });

  describe('create', () => {
    it('creates role and records audit', async () => {
      const role = makeRole({ name: 'Editor', permissions: ['content:read', 'content:create'] });
      vi.mocked(repo.create).mockResolvedValue(role);

      const result = await service.create(
        { name: 'Editor', permissions: ['content:read', 'content:create'] },
        actor,
      );

      expect(result).toEqual(role);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', entityType: 'role' }),
        expect.anything(),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundError when role does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' }, actor)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('updates role and records audit with before/after', async () => {
      const before = makeRole({ name: 'Old', permissions: [] });
      const after = { ...before, name: 'New', permissions: ['content:read'] };
      vi.mocked(repo.findById).mockResolvedValue(before);
      vi.mocked(repo.update).mockResolvedValue(after);

      const result = await service.update(
        before.id,
        { name: 'New', permissions: ['content:read'] },
        actor,
      );

      expect(result.name).toBe('New');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', before, after }),
        expect.anything(),
      );
    });
  });

  describe('delete', () => {
    it('throws NotFoundError when role does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.delete('missing', actor)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('deletes role and records audit', async () => {
      const role = makeRole();
      vi.mocked(repo.findById).mockResolvedValue(role);
      vi.mocked(repo.deleteById).mockResolvedValue(true);

      await service.delete(role.id, actor);

      expect(repo.deleteById).toHaveBeenCalledWith(role.id, expect.anything());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entityType: 'role',
          before: role,
          after: null,
        }),
        expect.anything(),
      );
    });
  });
});
