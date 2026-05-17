import type {
  AuthUser,
  CreateTeamInput,
  ListFilters,
  Paginated,
  Team,
  UpdateTeamInput,
} from '@mdm/shared';

import type { ITeamRepository } from './team.repository.js';
import { NotFoundError } from '../../core/errors/http-errors.js';
import type { AuditService } from '../audit/audit.service.js';
import type { IOrganizationRepository } from '../organizations/organization.repository.js';

export interface ITeamService {
  list(actor: AuthUser, filters: ListFilters): Promise<Paginated<Team>>;
  get(id: string, actor: AuthUser): Promise<Team>;
  create(input: CreateTeamInput, actor: AuthUser): Promise<Team>;
  update(id: string, input: UpdateTeamInput, actor: AuthUser): Promise<Team>;
  delete(id: string, actor: AuthUser): Promise<void>;
}

export class TeamService implements ITeamService {
  constructor(
    private readonly repo: ITeamRepository,
    private readonly orgRepo: IOrganizationRepository,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser, filters: ListFilters): Promise<Paginated<Team>> {
    const scopedFilters = actor.isAdmin
      ? filters
      : { ...filters, organizationId: actor.organizationId ?? undefined };
    return this.repo.findAll(scopedFilters);
  }

  async get(id: string, actor: AuthUser): Promise<Team> {
    const team = await this.repo.findById(id);
    if (!team) throw new NotFoundError('Team');
    if (!actor.isAdmin && team.organizationId !== actor.organizationId) {
      throw new NotFoundError('Team');
    }
    return team;
  }

  async create(input: CreateTeamInput, actor: AuthUser): Promise<Team> {
    return this.repo.withTransaction(async (tx) => {
      // Verify org exists
      const org = await this.orgRepo.findById(input.organizationId, tx);
      if (!org) throw new NotFoundError('Organization');

      const team = await this.repo.create(input, tx);
      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'create',
          entityType: 'team',
          entityId: team.id,
          organizationId: team.organizationId,
          before: null,
          after: team,
        },
        tx,
      );
      return team;
    });
  }

  async update(id: string, input: UpdateTeamInput, actor: AuthUser): Promise<Team> {
    return this.repo.withTransaction(async (tx) => {
      const before = await this.repo.findById(id, tx);
      if (!before) throw new NotFoundError('Team');
      if (!actor.isAdmin && before.organizationId !== actor.organizationId) {
        throw new NotFoundError('Team');
      }

      if (input.organizationId) {
        const org = await this.orgRepo.findById(input.organizationId, tx);
        if (!org) throw new NotFoundError('Organization');
      }

      const team = await this.repo.update(id, input, tx);
      if (!team) throw new NotFoundError('Team');

      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'update',
          entityType: 'team',
          entityId: team.id,
          organizationId: team.organizationId,
          before,
          after: team,
        },
        tx,
      );
      return team;
    });
  }

  async delete(id: string, actor: AuthUser): Promise<void> {
    return this.repo.withTransaction(async (tx) => {
      const before = await this.repo.findById(id, tx);
      if (!before) throw new NotFoundError('Team');
      if (!actor.isAdmin && before.organizationId !== actor.organizationId) {
        throw new NotFoundError('Team');
      }

      await this.repo.deleteById(id, tx);
      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'delete',
          entityType: 'team',
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
