import type { Request, Response } from 'express';

import type { AuditFilters } from './audit.repository.js';
import type { IAuditService } from './audit.service.js';

function parseFilters(req: Request): AuditFilters {
  const q = req.query as Record<string, string | undefined>;
  return {
    limit: q['limit'] ? Number(q['limit']) : undefined,
    offset: q['offset'] ? Number(q['offset']) : undefined,
    actorUserId: q['actorUserId'],
    entityType: q['entityType'],
    entityId: q['entityId'],
    organizationId: q['organizationId'],
    from: q['from'],
    to: q['to'],
  };
}

export class AuditController {
  constructor(private readonly service: IAuditService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.list(parseFilters(req), req.user!);
    res.json(result);
  };
}
