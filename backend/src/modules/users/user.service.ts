import type {
  AuthUser,
  CreateUserInput,
  ListFilters,
  Paginated,
  UpdateUserInput,
  User,
} from '@mdm/shared';
import bcrypt from 'bcrypt';

import type { IUserRepository } from './user.repository.js';
import { env } from '../../core/config/env.js';
import { ConflictError, NotFoundError } from '../../core/errors/http-errors.js';
import type { AuditService } from '../audit/audit.service.js';
import type { IOrganizationRepository } from '../organizations/organization.repository.js';
import type { IRoleRepository } from '../roles/role.repository.js';
import type { ITeamRepository } from '../teams/team.repository.js';

export interface IUserService {
  list(actor: AuthUser, filters: ListFilters): Promise<Paginated<User>>;
  get(id: string, actor: AuthUser): Promise<User>;
  create(input: CreateUserInput, actor: AuthUser): Promise<User>;
  update(id: string, input: UpdateUserInput, actor: AuthUser): Promise<User>;
  delete(id: string, actor: AuthUser): Promise<void>;
}

export class UserService implements IUserService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly orgRepo: IOrganizationRepository,
    private readonly teamRepo: ITeamRepository,
    private readonly roleRepo: IRoleRepository,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser, filters: ListFilters): Promise<Paginated<User>> {
    if (actor.isAdmin) {
      return this.userRepo.findAll(filters);
    }
    return this.userRepo.findAll({ ...filters, organizationId: actor.organizationId ?? undefined });
  }

  async get(id: string, actor: AuthUser): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User');

    if (!actor.isAdmin && user.organizationId !== actor.organizationId) {
      throw new NotFoundError('User');
    }

    return user;
  }

  async create(input: CreateUserInput, actor: AuthUser): Promise<User> {
    return this.userRepo.withTransaction(async (tx) => {
      if (input.organizationId) {
        const org = await this.orgRepo.findById(input.organizationId, tx);
        if (!org) throw new NotFoundError('Organization');
      }
      if (input.teamId) {
        const team = await this.teamRepo.findById(input.teamId, tx);
        if (!team) throw new NotFoundError('Team');
      }
      if (input.roleId) {
        const role = await this.roleRepo.findById(input.roleId, tx);
        if (!role) throw new NotFoundError('Role');
      }

      const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
      const user = await this.userRepo.create({ ...input, passwordHash }, tx);

      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'create',
          entityType: 'user',
          entityId: user.id,
          organizationId: user.organizationId,
          before: null,
          after: user,
        },
        tx,
      );

      return user;
    });
  }

  async update(id: string, input: UpdateUserInput, actor: AuthUser): Promise<User> {
    return this.userRepo.withTransaction(async (tx) => {
      const before = await this.userRepo.findById(id, tx);
      if (!before) throw new NotFoundError('User');

      if (!actor.isAdmin && before.organizationId !== actor.organizationId) {
        throw new NotFoundError('User');
      }

      // Non-admins can only update their own profile fields; explicit allowlist prevents
      // future additions to UpdateUserInput from inadvertently becoming accessible
      const safeInput: UpdateUserInput = actor.isAdmin
        ? input
        : { email: input.email, name: input.name, password: input.password };

      if (safeInput.organizationId) {
        const org = await this.orgRepo.findById(safeInput.organizationId, tx);
        if (!org) throw new NotFoundError('Organization');
      }
      if (safeInput.teamId) {
        const team = await this.teamRepo.findById(safeInput.teamId, tx);
        if (!team) throw new NotFoundError('Team');
      }
      if (safeInput.roleId) {
        const role = await this.roleRepo.findById(safeInput.roleId, tx);
        if (!role) throw new NotFoundError('Role');
      }

      const { password: _pw, ...updateFields } = safeInput;

      const updatePayload: typeof updateFields & { passwordHash?: string } = { ...updateFields };
      if (safeInput.password) {
        updatePayload.passwordHash = await bcrypt.hash(safeInput.password, env.BCRYPT_ROUNDS);
      }

      const user = await this.userRepo.update(id, updatePayload, tx);
      if (!user) throw new NotFoundError('User');

      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'update',
          entityType: 'user',
          entityId: user.id,
          organizationId: user.organizationId,
          before,
          after: user,
        },
        tx,
      );

      return user;
    });
  }

  async delete(id: string, actor: AuthUser): Promise<void> {
    return this.userRepo.withTransaction(async (tx) => {
      const before = await this.userRepo.findById(id, tx);
      if (!before) throw new NotFoundError('User');

      if (!actor.isAdmin && before.organizationId !== actor.organizationId) {
        throw new NotFoundError('User');
      }

      if (before.id === actor.id) {
        throw new ConflictError('Cannot delete your own account');
      }

      await this.userRepo.deleteById(id, tx);
      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'delete',
          entityType: 'user',
          entityId: id,
          organizationId: before.organizationId,
          before,
          after: null,
        },
        tx,
      );
    });
  }
}
