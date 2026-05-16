import type { ListFilters } from '@mdm/shared';
import type { Request, Response } from 'express';

import type { IUserService } from './user.service.js';

function parseFilters(req: Request): ListFilters {
  const q = req.query as Record<string, string | undefined>;
  return {
    limit: q['limit'] ? Number(q['limit']) : undefined,
    offset: q['offset'] ? Number(q['offset']) : undefined,
    search: q['search'],
    organizationId: q['organizationId'],
  };
}

export class UserController {
  constructor(private readonly service: IUserService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.list(req.user!, parseFilters(req));
    res.json(result);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.get(req.params['id']!, req.user!);
    res.json(user);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.create(req.body, req.user!);
    res.status(201).json(user);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.update(req.params['id']!, req.body, req.user!);
    res.json(user);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.service.delete(req.params['id']!, req.user!);
    res.status(204).send();
  };
}
