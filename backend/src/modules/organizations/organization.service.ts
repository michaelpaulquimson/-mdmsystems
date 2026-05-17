import type {
  AuthUser,
  CreateOrganizationInput,
  ListFilters,
  Organization,
  Paginated,
  UpdateOrganizationInput,
} from '@mdm/shared';

import type { IOrganizationRepository } from './organization.repository.js';
import { NotFoundError } from '../../core/errors/http-errors.js';
import type { AuditService } from '../audit/audit.service.js';

export interface IOrganizationService {
  list(actor: AuthUser, filters: ListFilters): Promise<Paginated<Organization>>;
  get(id: string, actor: AuthUser): Promise<Organization>;
  create(input: CreateOrganizationInput, actor: AuthUser): Promise<Organization>;
  update(id: string, input: UpdateOrganizationInput, actor: AuthUser): Promise<Organization>;
  delete(id: string, actor: AuthUser): Promise<void>;
}

export class OrganizationService implements IOrganizationService {
  constructor(
    private readonly repo: IOrganizationRepository,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser, filters: ListFilters): Promise<Paginated<Organization>> {
    if (!actor.isAdmin && actor.organizationId) {
      // Non-admins can only see their own organization
      const org = await this.repo.findById(actor.organizationId);
      return {
        data: org ? [org] : [],
        pagination: { total: org ? 1 : 0, limit: 1, offset: 0 },
      };
    }
    return this.repo.findAll(filters);
  }

  async get(id: string, actor: AuthUser): Promise<Organization> {
    if (!actor.isAdmin && id !== actor.organizationId) {
      throw new NotFoundError('Organization');
    }
    const org = await this.repo.findById(id);
    if (!org) throw new NotFoundError('Organization');
    return org;
  }

  async create(input: CreateOrganizationInput, actor: AuthUser): Promise<Organization> {
    return this.repo.withTransaction(async (tx) => {
      const org = await this.repo.create(input, tx);
      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'create',
          entityType: 'organization',
          entityId: org.id,
          organizationId: org.id,
          before: null,
          after: org,
        },
        tx,
      );
      return org;
    });
  }

  async update(id: string, input: UpdateOrganizationInput, actor: AuthUser): Promise<Organization> {
    return this.repo.withTransaction(async (tx) => {
      const before = await this.repo.findById(id, tx);
      if (!before) throw new NotFoundError('Organization');

      const org = await this.repo.update(id, input, tx);
      if (!org) throw new NotFoundError('Organization');

      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'update',
          entityType: 'organization',
          entityId: org.id,
          organizationId: org.id,
          before,
          after: org,
        },
        tx,
      );
      return org;
    });
  }

  async delete(id: string, actor: AuthUser): Promise<void> {
    return this.repo.withTransaction(async (tx) => {
      const before = await this.repo.findById(id, tx);
      if (!before) throw new NotFoundError('Organization');

      await this.repo.deleteById(id, tx);
      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'delete',
          entityType: 'organization',
          entityId: id,
          organizationId: null, // org already deleted — FK would fail if set
          before,
          after: null,
        },
        tx,
      );
    });
  }
}
