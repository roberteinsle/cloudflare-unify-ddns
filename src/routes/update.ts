import type { Context } from 'hono';
import type { Config } from '../config.js';
import { validateIp, recordTypeFor } from '../ip.js';
import { readState, writeState } from '../state.js';
import { updateHostname } from '../cloudflare.js';
import { log } from '../logger.js';

export function makeUpdateHandler(config: Config) {
  return async (c: Context): Promise<Response> => {
    const ip = c.req.query('ip') ?? '';

    if (!ip || !validateIp(ip)) {
      log.info(`Invalid or missing ip param: "${ip}"`);
      return c.text('badip', 400);
    }

    const type = recordTypeFor(ip);
    log.debug(`/update called ip=${ip} type=${type}`);

    // Compare against cached last IP — skip all CF calls if unchanged.
    // State is a non-critical optimization: if it can't be read (e.g. volume
    // permission issue), proceed and let the per-record CF compare handle it.
    let state: Awaited<ReturnType<typeof readState>> = null;
    try {
      state = await readState(config.statePath);
    } catch (err) {
      log.error(`readState failed (${config.statePath}): ${err instanceof Error ? err.message : err}`);
    }
    if (state !== null && state.lastIp === ip) {
      log.info(`IP unchanged (${ip}), responding nochg`);
      return c.text(`nochg ${ip}`);
    }

    // Update all hostnames in parallel; each call catches its own errors
    const results = await Promise.all(
      config.ddnsHostnames.map((hostname) =>
        updateHostname(hostname, ip, type, config.cfApiToken),
      ),
    );

    const errors = results.filter((r) => r.error !== undefined);
    const changed = results.filter((r) => r.changed);

    if (errors.length > 0) {
      log.error(
        `${errors.length}/${results.length} hostname(s) failed: ${errors.map((e) => e.hostname).join(', ')}`,
      );
      return c.text('dnserr', 500);
    }

    // Persist new IP only when all updates succeeded.
    // Failure to persist must not break the response — losing state only
    // costs one extra CF compare on the next call.
    try {
      await writeState(config.statePath, {
        lastIp: ip,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      log.error(`writeState failed (${config.statePath}): ${err instanceof Error ? err.message : err}`);
    }

    if (changed.length > 0) {
      log.info(`Updated ${changed.length} record(s) to ${ip}`);
      return c.text(`good ${ip}`);
    }

    // All records already had correct IP (e.g. record content matched via CF API check)
    log.info(`All records already correct for ${ip}`);
    return c.text(`nochg ${ip}`);
  };
}
