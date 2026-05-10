import { serve } from '@hono/node-server';
import { parseConfig } from './config.js';
import { createApp } from './app.js';
import { log } from './logger.js';

let config;
try {
  config = parseConfig();
} catch (err) {
  console.error('[FATAL]', err instanceof Error ? err.message : err);
  process.exit(1);
}

const app = createApp(config);

serve({ fetch: app.fetch, port: 3000 }, () => {
  log.info(`cloudflare-unify-ddns listening on port 3000`);
  log.info(`Hostnames: ${config.ddnsHostnames.join(', ')}`);
});
