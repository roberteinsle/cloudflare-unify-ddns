import type { Context } from 'hono';

export function healthzHandler(c: Context): Response {
  return c.text('ok');
}
