import { Hono } from 'hono';
import type { Config } from './config.js';
import { basicAuthMiddleware } from './auth.js';
import { healthzHandler } from './routes/healthz.js';
import { makeUpdateHandler } from './routes/update.js';

export function createApp(config: Config): Hono {
  const app = new Hono();

  // Health check — no auth, for Coolify/Traefik health probes
  app.get('/healthz', healthzHandler);

  // Protected routes — Basic Auth required
  app.use('/update', basicAuthMiddleware(config.ddnsBasicAuthUser, config.ddnsSharedSecret));
  app.get('/update', makeUpdateHandler(config));

  return app;
}
