import type { Request, Response } from 'express';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import * as promClient from 'prom-client';

import { env } from './core/config/env.js';
import { AuditController } from './modules/audit/audit.controller.js';
import { AuditRepository } from './modules/audit/audit.repository.js';
import { buildAuditRoutes } from './modules/audit/audit.routes.js';
import { AuditService } from './modules/audit/audit.service.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { buildAuthRoutes } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { RefreshTokenRepository } from './modules/auth/refresh-token.repository.js';
import { ContentController } from './modules/content/content.controller.js';
import { ContentRepository } from './modules/content/content.repository.js';
import { buildContentRoutes } from './modules/content/content.routes.js';
import { ContentService } from './modules/content/content.service.js';
import { OrganizationController } from './modules/organizations/organization.controller.js';
import { OrganizationRepository } from './modules/organizations/organization.repository.js';
import { buildOrganizationRoutes } from './modules/organizations/organization.routes.js';
import { OrganizationService } from './modules/organizations/organization.service.js';
import { RoleController } from './modules/roles/role.controller.js';
import { RoleRepository } from './modules/roles/role.repository.js';
import { buildRoleRoutes } from './modules/roles/role.routes.js';
import { RoleService } from './modules/roles/role.service.js';
import { TeamController } from './modules/teams/team.controller.js';
import { TeamRepository } from './modules/teams/team.repository.js';
import { buildTeamRoutes } from './modules/teams/team.routes.js';
import { TeamService } from './modules/teams/team.service.js';
import { UserController } from './modules/users/user.controller.js';
import { UserRepository } from './modules/users/user.repository.js';
import { buildUserRoutes } from './modules/users/user.routes.js';
import { UserService } from './modules/users/user.service.js';

interface CompositionRoot {
  router: Router;
  metricsHandler: (req: Request, res: Response) => void;
  healthReadyHandler: (req: Request, res: Response) => Promise<void>;
}

export function buildCompositionRoot(pool: Pool): CompositionRoot {
  // ─── Prometheus ────────────────────────────────────────────────────────────
  promClient.collectDefaultMetrics();

  // Registered with the default registry on construction; used by /metrics endpoint
  new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
  });

  const poolGauge = new promClient.Gauge({
    name: 'pg_pool_connections',
    help: 'PostgreSQL pool connection counts',
    labelNames: ['state'],
  });

  setInterval(() => {
    poolGauge.set({ state: 'total' }, pool.totalCount);
    poolGauge.set({ state: 'idle' }, pool.idleCount);
    poolGauge.set({ state: 'waiting' }, pool.waitingCount);
  }, 5_000).unref();

  // ─── Repositories ──────────────────────────────────────────────────────────
  const orgRepo = new OrganizationRepository(pool);
  const teamRepo = new TeamRepository(pool);
  const userRepo = new UserRepository(pool);
  const roleRepo = new RoleRepository(pool);
  const contentRepo = new ContentRepository(pool);
  const refreshTokenRepo = new RefreshTokenRepository(pool);
  const auditRepo = new AuditRepository(pool);

  // ─── Services ─────────────────────────────────────────────────────────────
  const auditService = new AuditService(auditRepo);
  const authService = new AuthService(userRepo, refreshTokenRepo, auditService);
  const orgService = new OrganizationService(orgRepo, auditService);
  const teamService = new TeamService(teamRepo, orgRepo, auditService);
  const userService = new UserService(userRepo, orgRepo, teamRepo, roleRepo, auditService);
  const roleService = new RoleService(roleRepo, auditService);
  const contentService = new ContentService(contentRepo, userRepo, auditService);

  // ─── Controllers ──────────────────────────────────────────────────────────
  const authController = new AuthController(authService);
  const orgController = new OrganizationController(orgService);
  const teamController = new TeamController(teamService);
  const userController = new UserController(userService);
  const roleController = new RoleController(roleService);
  const contentController = new ContentController(contentService);
  const auditController = new AuditController(auditService);

  // ─── Router ───────────────────────────────────────────────────────────────
  const router = Router();

  const isTest = env.NODE_ENV === 'test';
  const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, skip: () => isTest });
  const refreshLimiter = rateLimit({ windowMs: 5 * 60_000, max: 30, skip: () => isTest });

  router.use('/auth', buildAuthRoutes(authController, loginLimiter, refreshLimiter));
  router.use('/organizations', buildOrganizationRoutes(orgController));
  router.use('/teams', buildTeamRoutes(teamController));
  router.use('/users', buildUserRoutes(userController));
  router.use('/roles', buildRoleRoutes(roleController));
  router.use('/content', buildContentRoutes(contentController));
  router.use('/audit', buildAuditRoutes(auditController));

  // ─── OpenAPI docs ─────────────────────────────────────────────────────────
  // Mounted on the full Express app from index.ts — done here only if needed
  // (mountDocs is called separately in app if needed)

  // ─── Operational handlers ─────────────────────────────────────────────────
  const metricsHandler = async (_req: Request, res: Response): Promise<void> => {
    if (env.METRICS_TOKEN && _req.headers['x-metrics-token'] !== env.METRICS_TOKEN) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Invalid metrics token' } });
      return;
    }
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  };

  const healthReadyHandler = async (_req: Request, res: Response): Promise<void> => {
    try {
      await pool.query('SELECT 1');
      const { rows } = await pool.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM schema_migrations',
      );
      res.json({ status: 'ready', migrations: Number(rows[0]?.count ?? 0) });
    } catch {
      res.status(503).json({ status: 'not_ready' });
    }
  };

  return { router, metricsHandler, healthReadyHandler };
}
