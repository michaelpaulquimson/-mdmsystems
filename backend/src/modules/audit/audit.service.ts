import type { AuthUser, Paginated } from '@mdm/shared';
import type { PoolClient } from 'pg';

import type {
  AuditFilters,
  AuditLogEntry,
  CreateAuditInput,
  IAuditRepository,
} from './audit.repository.js';
import { ForbiddenError } from '../../core/errors/http-errors.js';

export interface IAuditService {
  record(input: CreateAuditInput, client?: PoolClient): Promise<void>;
  list(filters: AuditFilters, actor: AuthUser): Promise<Paginated<AuditLogEntry>>;
}

export class AuditService implements IAuditService {
  constructor(private readonly repo: IAuditRepository) {}

  async record(input: CreateAuditInput, client?: PoolClient): Promise<void> {
    await this.repo.create(input, client);
  }

  async list(filters: AuditFilters, actor: AuthUser): Promise<Paginated<AuditLogEntry>> {
    if (!actor.isAdmin) {
      throw new ForbiddenError('Admin access required');
    }
    return this.repo.findAll(filters);
  }
}
