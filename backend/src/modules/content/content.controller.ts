import type { ListFilters } from '@mdm/shared';
import type { Request, Response } from 'express';

import type { IContentService } from './content.service.js';

function parseFilters(req: Request): ListFilters & { assignedToUserId?: string } {
  const q = req.query as Record<string, string | undefined>;
  return {
    limit: q['limit'] ? Number(q['limit']) : undefined,
    offset: q['offset'] ? Number(q['offset']) : undefined,
    search: q['search'],
    organizationId: q['organizationId'],
    assignedToUserId: q['assignedToUserId'],
  };
}

export class ContentController {
  constructor(private readonly service: IContentService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.list(req.user!, parseFilters(req));
    res.json(result);
  };

  getAssignedToUser = async (req: Request, res: Response): Promise<void> => {
    const items = await this.service.getAssignedToUser(req.params['userId']!, req.user!);
    res.json(items);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const item = await this.service.create(req.body, req.user!);
    res.status(201).json(item);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const item = await this.service.update(req.params['id']!, req.body, req.user!);
    res.json(item);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params['id']!, req.user!);
    res.status(204).send();
  };
}
