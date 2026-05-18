import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { makeUser, makeAuthUser } from '../../../../tests/factories/index.js';
import { ConflictError, NotFoundError } from '../../../core/errors/http-errors.js';
import type { IAuditService } from '../../audit/audit.service.js';
import type { IOrganizationRepository } from '../../organizations/organization.repository.js';
import type { IRoleRepository } from '../../roles/role.repository.js';
import type { ITeamRepository } from '../../teams/team.repository.js';
import type { IUserRepository } from '../user.repository.js';
import { UserService } from '../user.service.js';

const makeUserRepo = (): IUserRepository => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  withTransaction: vi.fn((fn) => fn({} as never)),
  findByEmailWithPasswordHash: vi.fn(),
  findPermissionsForUser: vi.fn(),
  findByEmail: vi.fn(),
  getEmailById: vi.fn(),
});

const makeOrgRepo = (): IOrganizationRepository => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  withTransaction: vi.fn((fn) => fn({} as never)),
});

const makeTeamRepo = (): ITeamRepository => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  withTransaction: vi.fn((fn) => fn({} as never)),
});

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

describe('UserService', () => {
  let userRepo: ReturnType<typeof makeUserRepo>;
  let orgRepo: ReturnType<typeof makeOrgRepo>;
  let teamRepo: ReturnType<typeof makeTeamRepo>;
  let roleRepo: ReturnType<typeof makeRoleRepo>;
  let auditService: ReturnType<typeof makeAuditService>;
  let service: UserService;

  const orgId = 'org-111';
  const admin = makeAuthUser({ isAdmin: true, organizationId: orgId });
  const nonAdmin = makeAuthUser({ isAdmin: false, organizationId: orgId });

  beforeEach(() => {
    userRepo = makeUserRepo();
    orgRepo = makeOrgRepo();
    teamRepo = makeTeamRepo();
    roleRepo = makeRoleRepo();
    auditService = makeAuditService();
    service = new UserService(userRepo, orgRepo, teamRepo, roleRepo, auditService as IAuditService);
  });

  describe('get', () => {
    it('returns user when found and same org', async () => {
      const user = makeUser({ organizationId: orgId });
      vi.mocked(userRepo.findById).mockResolvedValue(user);
      await expect(service.get(user.id, nonAdmin)).resolves.toEqual(user);
    });

    it('throws NotFoundError when user does not exist', async () => {
      vi.mocked(userRepo.findById).mockResolvedValue(null);
      await expect(service.get('missing', admin)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws NotFoundError for non-admin accessing another org user', async () => {
      const user = makeUser({ organizationId: 'other-org' });
      vi.mocked(userRepo.findById).mockResolvedValue(user);
      await expect(service.get(user.id, nonAdmin)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('list', () => {
    it('passes unscoped filters for admin', async () => {
      vi.mocked(userRepo.findAll).mockResolvedValue({
        data: [],
        pagination: { total: 0, limit: 50, offset: 0 },
      });
      await service.list(admin, { limit: 50, offset: 0 });
      expect(userRepo.findAll).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    });

    it('injects organizationId for non-admin', async () => {
      vi.mocked(userRepo.findAll).mockResolvedValue({
        data: [],
        pagination: { total: 0, limit: 50, offset: 0 },
      });
      await service.list(nonAdmin, { limit: 50, offset: 0 });
      expect(userRepo.findAll).toHaveBeenCalledWith({
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
        service.create(
          { email: 'a@b.com', name: 'A', password: 'Pass1234', organizationId: 'bad' },
          admin,
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('creates user with hashed password and records audit', async () => {
      const user = makeUser({ organizationId: orgId });
      vi.mocked(userRepo.create).mockResolvedValue(user);

      const result = await service.create(
        { email: 'a@b.com', name: 'A', password: 'Pass1234' },
        admin,
      );

      expect(result).toEqual(user);
      // Password must be hashed — repo receives passwordHash, not raw password
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: expect.any(String) }),
        expect.anything(),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', entityType: 'user' }),
        expect.anything(),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundError when user does not exist', async () => {
      vi.mocked(userRepo.findById).mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' }, admin)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('throws NotFoundError for non-admin updating another org user', async () => {
      const user = makeUser({ organizationId: 'other-org' });
      vi.mocked(userRepo.findById).mockResolvedValue(user);
      await expect(service.update(user.id, { name: 'x' }, nonAdmin)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('strips isAdmin from non-admin update (privilege escalation blocked)', async () => {
      const user = makeUser({ organizationId: orgId });
      const updated = makeUser({ ...user, name: 'Updated' });
      vi.mocked(userRepo.findById).mockResolvedValue(user);
      vi.mocked(userRepo.update).mockResolvedValue(updated);

      await service.update(user.id, { name: 'Updated', isAdmin: true } as never, nonAdmin);

      // isAdmin must NOT appear in the update payload
      expect(userRepo.update).toHaveBeenCalledWith(
        user.id,
        expect.not.objectContaining({ isAdmin: true }),
        expect.anything(),
      );
    });

    it('updates user and records audit', async () => {
      const before = makeUser({ organizationId: orgId });
      const after = { ...before, name: 'New Name' };
      vi.mocked(userRepo.findById).mockResolvedValue(before);
      vi.mocked(userRepo.update).mockResolvedValue(after);

      await service.update(before.id, { name: 'New Name' }, admin);

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', before, after }),
        expect.anything(),
      );
    });
  });

  describe('delete', () => {
    it('throws NotFoundError when user does not exist', async () => {
      vi.mocked(userRepo.findById).mockResolvedValue(null);
      await expect(service.delete('missing', admin)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ConflictError when actor deletes their own account', async () => {
      const user = makeUser({ id: admin.id, organizationId: orgId });
      vi.mocked(userRepo.findById).mockResolvedValue(user);
      await expect(service.delete(admin.id, admin)).rejects.toBeInstanceOf(ConflictError);
    });

    it('deletes user and records audit', async () => {
      const user = makeUser({ organizationId: orgId });
      vi.mocked(userRepo.findById).mockResolvedValue(user);
      vi.mocked(userRepo.deleteById).mockResolvedValue(true);

      await service.delete(user.id, admin);

      expect(userRepo.deleteById).toHaveBeenCalledWith(user.id, expect.anything());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', entityType: 'user' }),
        expect.anything(),
      );
    });
  });
});
