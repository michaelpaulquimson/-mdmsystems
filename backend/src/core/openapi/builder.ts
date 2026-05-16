import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import type { Application } from 'express';
import * as swaggerUi from 'swagger-ui-express';

import { registry } from './registry.js';

export function mountDocs(app: Application): void {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  const document = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'MDM Systems API',
      version: '1.0.0',
      description: 'Admin API for Organizations, Teams, Users, Roles, and Content management.',
    },
    servers: [{ url: '/api/v1' }],
  });

  app.get('/api/v1/openapi.json', (_req, res) => res.json(document));
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(document));
}
