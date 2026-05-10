export interface Config {
  cfApiToken: string;
  ddnsHostnames: string[];
  ddnsSharedSecret: string;
  ddnsBasicAuthUser: string;
  logLevel: string;
  statePath: string;
}

export function parseConfig(): Config {
  const required = {
    CF_API_TOKEN: process.env['CF_API_TOKEN'],
    DDNS_HOSTNAMES: process.env['DDNS_HOSTNAMES'],
    DDNS_SHARED_SECRET: process.env['DDNS_SHARED_SECRET'],
  };

  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const hostnames = required['DDNS_HOSTNAMES']!
    .split(',')
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  if (hostnames.length === 0) {
    throw new Error('DDNS_HOSTNAMES must contain at least one hostname');
  }

  return {
    cfApiToken: required['CF_API_TOKEN']!,
    ddnsHostnames: hostnames,
    ddnsSharedSecret: required['DDNS_SHARED_SECRET']!,
    ddnsBasicAuthUser: process.env['DDNS_BASIC_AUTH_USER'] ?? 'unifi',
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    statePath: process.env['STATE_PATH'] ?? '/data/state.json',
  };
}
