import type {
  AuthUser,
  ContentItem,
  CreateContentInput,
  ListFilters,
  Paginated,
  UpdateContentInput,
} from '@mdm/shared';

import type { ContentListFilters, IContentRepository } from './content.repository.js';
import { ForbiddenError, NotFoundError } from '../../core/errors/http-errors.js';
import type { AuditService } from '../audit/audit.service.js';
import type { IUserRepository } from '../users/user.repository.js';

export interface IContentService {
  list(
    actor: AuthUser,
    filters: ListFilters & { assignedToUserId?: string },
  ): Promise<Paginated<ContentItem>>;
  getAssignedToUser(userId: string, actor: AuthUser): Promise<ContentItem[]>;
  create(input: CreateContentInput, actor: AuthUser): Promise<ContentItem>;
  update(id: string, input: UpdateContentInput, actor: AuthUser): Promise<ContentItem>;
  delete(id: string, actor: AuthUser): Promise<void>;
}

export class ContentService implements IContentService {
  constructor(
    private readonly contentRepo: IContentRepository,
    private readonly userRepo: IUserRepository,
    private readonly auditService: AuditService,
  ) {}

  async list(
    actor: AuthUser,
    filters: ListFilters & { assignedToUserId?: string },
  ): Promise<Paginated<ContentItem>> {
    const contentFilters: ContentListFilters = {
      ...filters,
    };

    if (!actor.isAdmin) {
      contentFilters.organizationId = actor.organizationId ?? undefined;
    }

    return this.contentRepo.findAll(contentFilters);
  }

  async getAssignedToUser(userId: string, actor: AuthUser): Promise<ContentItem[]> {
    const targetUser = await this.userRepo.findById(userId);
    if (!targetUser) throw new NotFoundError('User');

    if (!actor.isAdmin && targetUser.organizationId !== actor.organizationId) {
      throw new NotFoundError('User');
    }

    const organizationId = actor.isAdmin ? targetUser.organizationId : actor.organizationId;
    return this.contentRepo.findAssignedToUser(userId, organizationId);
  }

  async create(input: CreateContentInput, actor: AuthUser): Promise<ContentItem> {
    if (!actor.organizationId && !actor.isAdmin) {
      throw new ForbiddenError('User is not associated with an organization');
    }

    // Non-admins must belong to an org; admins could too but we require org context for content
    const organizationId = actor.organizationId;
    if (!organizationId) {
      throw new ForbiddenError('Cannot create content without an organization context');
    }

    return this.contentRepo.withTransaction(async (tx) => {
      if (input.assignedToUserId) {
        const assignee = await this.userRepo.findById(input.assignedToUserId, tx);
        if (!assignee) throw new NotFoundError('Assigned user');
        if (!actor.isAdmin && assignee.organizationId !== organizationId) {
          throw new ForbiddenError('Assigned user does not belong to your organization');
        }
      }

      const item = await this.contentRepo.create(
        { ...input, organizationId, createdByUserId: actor.id },
        tx,
      );
      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'create',
          entityType: 'content_item',
          entityId: item.id,
          organizationId: item.organizationId,
          before: null,
          after: item,
        },
        tx,
      );
      return item;
    });
  }

  async update(id: string, input: UpdateContentInput, actor: AuthUser): Promise<ContentItem> {
    return this.contentRepo.withTransaction(async (tx) => {
      if (input.assignedToUserId !== undefined && input.assignedToUserId !== null) {
        const assignee = await this.userRepo.findById(input.assignedToUserId, tx);
        if (!assignee) throw new NotFoundError('Assigned user');
        if (!actor.isAdmin && assignee.organizationId !== actor.organizationId) {
          throw new ForbiddenError('Assigned user does not belong to your organization');
        }
      }

      const before = await this.contentRepo.findById(id, tx);
      if (!before) throw new NotFoundError('ContentItem');

      let organizationId: string;
      if (actor.isAdmin) {
        organizationId = before.organizationId;
      } else {
        if (!actor.organizationId) {
          throw new ForbiddenError('User is not associated with an organization');
        }
        if (before.organizationId !== actor.organizationId) {
          throw new NotFoundError('ContentItem');
        }
        organizationId = actor.organizationId;
      }
      const item = await this.contentRepo.update(id, input, organizationId, tx);
      if (!item) throw new NotFoundError('ContentItem');

      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'update',
          entityType: 'content_item',
          entityId: item.id,
          organizationId: item.organizationId,
          before,
          after: item,
        },
        tx,
      );
      return item;
    });
  }

  async delete(id: string, actor: AuthUser): Promise<void> {
    return this.contentRepo.withTransaction(async (tx) => {
      const before = await this.contentRepo.findById(id, tx);
      if (!before) throw new NotFoundError('ContentItem');

      if (!actor.isAdmin && before.organizationId !== actor.organizationId) {
        throw new NotFoundError('ContentItem');
      }

      await this.contentRepo.deleteById(id, tx);
      await this.auditService.record(
        {
          actorUserId: actor.id,
          action: 'delete',
          entityType: 'content_item',
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
