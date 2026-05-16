import type { ListFilters } from '@mdm/shared';
import type { Request, Response } from 'express';

import type { IRoleService } from './role.service.js';

function parseFilters(req: Request): ListFilters {
  const q = req.query as Record<string, string | undefined>;
  return {
    limit: q['limit'] ? Number(q['limit']) : undefined,
    offset: q['offset'] ? Number(q['offset']) : undefined,
    search: q['search'],
  };
}

export class RoleController {
  constructor(private readonly service: IRoleService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.list(req.user!, parseFilters(req));
    res.json(result);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const role = await this.service.get(req.params['id']!, req.user!);
    res.json(role);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const role = await this.service.create(req.body, req.user!);
    res.status(201).json(role);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const role = await this.service.update(req.params['id']!, req.body, req.user!);
    res.json(role);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params['id']!, req.user!);
    res.status(204).send();
  };
}
