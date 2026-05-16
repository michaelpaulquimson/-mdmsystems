import type { Request, Response } from 'express';

import type { IAuthService } from './auth.service.js';

export class AuthController {
  constructor(private readonly service: IAuthService) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const ctx = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    const result = await this.service.login(req.body, ctx);
    res.status(200).json(result);
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const ctx = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    const result = await this.service.refresh(req.body, ctx);
    res.status(200).json(result);
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body as { refreshToken?: string };
    const ctx = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    await this.service.logout(refreshToken ?? '', req.user!, ctx);
    res.status(204).send();
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const user = await this.service.me(req.user!);
    res.status(200).json(user);
  };
}
