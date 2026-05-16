import type { Paginated } from '@mdm/shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeOrganization, makeAuthUser } from '../../../../tests/factories/index.js';
import { NotFoundError } from '../../../core/errors/http-errors.js';
import type { IAuditService } from '../../audit/audit.service.js';
import type { IOrganizationRepository } from '../organization.repository.js';
import { OrganizationService } from '../organization.service.js';

const makeRepo = (): IOrganizationRepository => ({
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

describe('OrganizationService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let auditService: ReturnType<typeof makeAuditService>;
  let service: OrganizationService;
  const actor = makeAuthUser({ isAdmin: true });

  beforeEach(() => {
    repo = makeRepo();
    auditService = makeAuditService();
    service = new OrganizationService(repo, auditService as IAuditService);
  });

  describe('get', () => {
    it('returns org when found', async () => {
      const org = makeOrganization();
      vi.mocked(repo.findById).mockResolvedValue(org);
      await expect(service.get(org.id, actor)).resolves.toEqual(org);
    });

    it('throws NotFoundError when org missing', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.get('missing-id', actor)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('list', () => {
    it('delegates to repo.findAll', async () => {
      const paginated: Paginated<ReturnType<typeof makeOrganization>> = {
        data: [makeOrganization()],
        pagination: { total: 1, limit: 50, offset: 0 },
      };
      vi.mocked(repo.findAll).mockResolvedValue(paginated);
      const result = await service.list(actor, { limit: 50, offset: 0 });
      expect(result).toEqual(paginated);
      expect(repo.findAll).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    });
  });

  describe('create', () => {
    it('creates org and records audit', async () => {
      const org = makeOrganization({ name: 'Acme' });
      vi.mocked(repo.create).mockResolvedValue(org);

      const result = await service.create({ name: 'Acme' }, actor);

      expect(result).toEqual(org);
      expect(repo.create).toHaveBeenCalledWith({ name: 'Acme' }, expect.anything());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', entityType: 'organization' }),
        expect.anything(),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundError when org missing', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' }, actor)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('updates org and records audit', async () => {
      const before = makeOrganization({ name: 'Old' });
      const after = { ...before, name: 'New' };
      vi.mocked(repo.findById).mockResolvedValue(before);
      vi.mocked(repo.update).mockResolvedValue(after);

      const result = await service.update(before.id, { name: 'New' }, actor);

      expect(result.name).toBe('New');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', before, after }),
        expect.anything(),
      );
    });
  });

  describe('delete', () => {
    it('throws NotFoundError when org missing', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.delete('missing', actor)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('deletes org and records audit', async () => {
      const org = makeOrganization();
      vi.mocked(repo.findById).mockResolvedValue(org);
      vi.mocked(repo.deleteById).mockResolvedValue(true);

      await service.delete(org.id, actor);

      expect(repo.deleteById).toHaveBeenCalledWith(org.id, expect.anything());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', entityType: 'organization' }),
        expect.anything(),
      );
    });
  });
});
