import type { ListFilters } from '@mdm/shared';
import type { Request, Response } from 'express';

import type { IOrganizationService } from './organization.service.js';

function parseFilters(req: Request): ListFilters {
  const q = req.query as Record<string, string | undefined>;
  return {
    limit: q['limit'] ? Number(q['limit']) : undefined,
    offset: q['offset'] ? Number(q['offset']) : undefined,
    search: q['search'],
  };
}

export class OrganizationController {
  constructor(private readonly service: IOrganizationService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.list(req.user!, parseFilters(req));
    res.json(result);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const org = await this.service.get(req.params['id']!, req.user!);
    res.json(org);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const org = await this.service.create(req.body, req.user!);
    res.status(201).json(org);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const org = await this.service.update(req.params['id']!, req.body, req.user!);
    res.json(org);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params['id']!, req.user!);
    res.status(204).send();
  };
}
