import type { Paginated } from '@mdm/shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeOrganization, makeTeam, makeAuthUser } from '../../../../tests/factories/index.js';
import { NotFoundError } from '../../../core/errors/http-errors.js';
import type { IAuditService } from '../../audit/audit.service.js';
import type { IOrganizationRepository } from '../../organizations/organization.repository.js';
import type { ITeamRepository } from '../team.repository.js';
import { TeamService } from '../team.service.js';

const makeTeamRepo = (): ITeamRepository => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  findByOrgAndId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  withTransaction: vi.fn((fn) => fn({} as never)),
});

const makeOrgRepo = (): IOrganizationRepository => ({
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

describe('TeamService', () => {
  let teamRepo: ReturnType<typeof makeTeamRepo>;
  let orgRepo: ReturnType<typeof makeOrgRepo>;
  let auditService: ReturnType<typeof makeAuditService>;
  let service: TeamService;

  const admin = makeAuthUser({ isAdmin: true });
  const orgId = 'org-aaa';
  const nonAdmin = makeAuthUser({ isAdmin: false, organizationId: orgId });

  beforeEach(() => {
    teamRepo = makeTeamRepo();
    orgRepo = makeOrgRepo();
    auditService = makeAuditService();
    service = new TeamService(teamRepo, orgRepo, auditService as IAuditService);
  });

  describe('get', () => {
    it('returns team for admin regardless of org', async () => {
      const team = makeTeam({ organizationId: 'other-org' });
      vi.mocked(teamRepo.findById).mockResolvedValue(team);
      await expect(service.get(team.id, admin)).resolves.toEqual(team);
    });

    it('returns team for non-admin in the same org', async () => {
      const team = makeTeam({ organizationId: orgId });
      vi.mocked(teamRepo.findById).mockResolvedValue(team);
      await expect(service.get(team.id, nonAdmin)).resolves.toEqual(team);
    });

    it('throws NotFoundError when team does not exist', async () => {
      vi.mocked(teamRepo.findById).mockResolvedValue(null);
      await expect(service.get('missing', admin)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws NotFoundError for non-admin accessing another org team', async () => {
      const team = makeTeam({ organizationId: 'other-org' });
      vi.mocked(teamRepo.findById).mockResolvedValue(team);
      await expect(service.get(team.id, nonAdmin)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('list', () => {
    it('passes unscoped filters for admin', async () => {
      const paginated: Paginated<ReturnType<typeof makeTeam>> = {
        data: [],
        pagination: { total: 0, limit: 50, offset: 0 },
      };
      vi.mocked(teamRepo.findAll).mockResolvedValue(paginated);
      await service.list(admin, { limit: 50, offset: 0 });
      expect(teamRepo.findAll).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    });

    it('injects organizationId for non-admin', async () => {
      const paginated: Paginated<ReturnType<typeof makeTeam>> = {
        data: [],
        pagination: { total: 0, limit: 50, offset: 0 },
      };
      vi.mocked(teamRepo.findAll).mockResolvedValue(paginated);
      await service.list(nonAdmin, { limit: 50, offset: 0 });
      expect(teamRepo.findAll).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        organizationId: orgId,
      });
    });
  });

  describe('create', () => {
    it('throws NotFoundError when org does not exist', async () => {
      vi.mocked(orgRepo.findById).mockResolvedValue(null);
      await expect(
        service.create({ name: 'Eng', organizationId: 'bad-org' }, admin),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('creates team and records audit', async () => {
      const org = makeOrganization({ id: orgId });
      const team = makeTeam({ name: 'Eng', organizationId: orgId });
      vi.mocked(orgRepo.findById).mockResolvedValue(org);
      vi.mocked(teamRepo.create).mockResolvedValue(team);

      const result = await service.create({ name: 'Eng', organizationId: orgId }, admin);

      expect(result).toEqual(team);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', entityType: 'team' }),
        expect.anything(),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundError when team does not exist', async () => {
      vi.mocked(teamRepo.findById).mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' }, admin)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('throws NotFoundError for non-admin updating another org team', async () => {
      const team = makeTeam({ organizationId: 'other-org' });
      vi.mocked(teamRepo.findById).mockResolvedValue(team);
      await expect(service.update(team.id, { name: 'x' }, nonAdmin)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('updates team and records audit', async () => {
      const before = makeTeam({ organizationId: orgId });
      const after = { ...before, name: 'Updated' };
      vi.mocked(teamRepo.findById).mockResolvedValue(before);
      vi.mocked(teamRepo.update).mockResolvedValue(after);

      const result = await service.update(before.id, { name: 'Updated' }, admin);

      expect(result.name).toBe('Updated');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', before, after }),
        expect.anything(),
      );
    });
  });

  describe('delete', () => {
    it('throws NotFoundError when team does not exist', async () => {
      vi.mocked(teamRepo.findById).mockResolvedValue(null);
      await expect(service.delete('missing', admin)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws NotFoundError for non-admin deleting another org team', async () => {
      const team = makeTeam({ organizationId: 'other-org' });
      vi.mocked(teamRepo.findById).mockResolvedValue(team);
      await expect(service.delete(team.id, nonAdmin)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('deletes team and records audit', async () => {
      const team = makeTeam({ organizationId: orgId });
      vi.mocked(teamRepo.findById).mockResolvedValue(team);
      vi.mocked(teamRepo.deleteById).mockResolvedValue(true);

      await service.delete(team.id, admin);

      expect(teamRepo.deleteById).toHaveBeenCalledWith(team.id, expect.anything());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', entityType: 'team' }),
        expect.anything(),
      );
    });
  });
});
