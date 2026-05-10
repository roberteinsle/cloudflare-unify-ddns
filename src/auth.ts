import type { Context, Next } from 'hono';

export function basicAuthMiddleware(expectedUser: string, expectedSecret: string) {
  return async (c: Context, next: Next) => {
    const header = c.req.header('Authorization') ?? '';

    if (!header.startsWith('Basic ')) {
      return c.text('badauth', 401);
    }

    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      return c.text('badauth', 401);
    }

    const user = decoded.slice(0, colonIndex);
    const pass = decoded.slice(colonIndex + 1);

    if (user !== expectedUser || pass !== expectedSecret) {
      return c.text('badauth', 401);
    }

    await next();
  };
}
