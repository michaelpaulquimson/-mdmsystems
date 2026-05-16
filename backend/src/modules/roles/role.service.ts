import type {
  AuthUser,
  CreateRoleInput,
  ListFilters,
  Paginated,
  Role,
  UpdateRoleInput,
} from '@mdm/shared';

import type { IRoleRepository } from './role.repository.js';
import { NotFoundError } from '../../core/errors/http-errors.js';
import type { AuditService } from '../audit/audit.service.js';

export interface IRoleService {
  list(actor: AuthUser, filters: ListFilters): Promise<Paginated<Role>>;
  get(id: string, actor: AuthUser): Promise<Role>;
  create(input: CreateRoleInput, actor: AuthUser): Promise<Role>;
  update(id: string, input: UpdateRoleInput, actor: AuthUser): Promise<Role>;
  delete(id: string, actor: AuthUser): Promise<void>;
}

export class RoleService implements IRoleService {
  constructor(
    private readonly repo: IRoleRepository,
    private readonly auditService: AuditService,
  ) {}

  async list(_actor: AuthUser, filters: ListFilters): Promise<Paginated<Role>> {
    return this.repo.findAll(filters);
  }

  async get(id: string, _actor: AuthUser): Promise<Role> {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundError('Role');
    return role;
  }

  async create(input: CreateRoleInput, actor: AuthUser): Promise<Role> {
    return this.repo.withTransaction(async (tx) => {
      const role = await this.repo.create(input, tx);
      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'create',
          entityType: 'role',
          entityId: role.id,
          organizationId: null,
          before: null,
          after: role,
        },
        tx,
      );
      return role;
    });
  }

  async update(id: string, input: UpdateRoleInput, actor: AuthUser): Promise<Role> {
    return this.repo.withTransaction(async (tx) => {
      const before = await this.repo.findById(id, tx);
      if (!before) throw new NotFoundError('Role');

      const role = await this.repo.update(id, input, tx);
      if (!role) throw new NotFoundError('Role');

      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'update',
          entityType: 'role',
          entityId: role.id,
          organizationId: null,
          before,
          after: role,
        },
        tx,
      );
      return role;
    });
  }

  async delete(id: string, actor: AuthUser): Promise<void> {
    return this.repo.withTransaction(async (tx) => {
      const before = await this.repo.findById(id, tx);
      if (!before) throw new NotFoundError('Role');

      await this.repo.deleteById(id, tx);
      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'delete',
          entityType: 'role',
          entityId: id,
          organizationId: null,
          before,
          after: null,
        },
        tx,
      );
    });
  }
}
