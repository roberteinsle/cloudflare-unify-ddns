import type { RecordType } from './ip.js';
import { log } from './logger.js';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

// In-memory zone cache: apex domain → zone ID
// Zone IDs are stable per Cloudflare account, no need to persist across restarts.
// Note: apex detection uses the last 2 hostname parts (e.g. einsle.com, einsle.cloud).
// Two-part eTLDs like co.uk are not supported in v1.
const zoneCache = new Map<string, string>();

export interface CfDnsRecord {
  id: string;
  name: string;
  type: RecordType;
  content: string;
  proxied: boolean;
  ttl: number;
  tags?: string[];
}

export interface UpdateResult {
  hostname: string;
  changed: boolean;
  error?: string;
}

function apexDomain(hostname: string): string {
  const parts = hostname.split('.');
  return parts.slice(-2).join('.');
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function getZoneId(apex: string, token: string): Promise<string> {
  const cached = zoneCache.get(apex);
  if (cached !== undefined) {
    return cached;
  }

  const url = `${CF_API_BASE}/zones?name=${encodeURIComponent(apex)}&status=active&per_page=1`;
  const res = await fetch(url, { headers: authHeaders(token) });

  if (!res.ok) {
    throw new Error(`CF zones API returned ${res.status} for apex ${apex}`);
  }

  const data = (await res.json()) as { result: Array<{ id: string; name: string }> };
  const zone = data.result[0];

  if (!zone) {
    throw new Error(`No active Cloudflare zone found for apex domain: ${apex}`);
  }

  log.debug(`Resolved zone ${apex} → ${zone.id}`);
  zoneCache.set(apex, zone.id);
  return zone.id;
}

async function listRecord(
  zoneId: string,
  hostname: string,
  type: RecordType,
  token: string,
): Promise<CfDnsRecord | null> {
  const url = `${CF_API_BASE}/zones/${zoneId}/dns_records?name=${encodeURIComponent(hostname)}&type=${type}`;
  const res = await fetch(url, { headers: authHeaders(token) });

  if (!res.ok) {
    throw new Error(`CF dns_records list returned ${res.status} for ${hostname}`);
  }

  const data = (await res.json()) as { result: CfDnsRecord[] };
  log.debug(`listRecord ${hostname} ${type}: ${data.result.length} result(s)`);
  return data.result[0] ?? null;
}

async function patchRecord(
  zoneId: string,
  recordId: string,
  ip: string,
  token: string,
): Promise<void> {
  const url = `${CF_API_BASE}/zones/${zoneId}/dns_records/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ content: ip }),
  });

  if (!res.ok) {
    const body = await res.text();
    log.debug(`PATCH response body: ${body}`);
    throw new Error(`CF PATCH dns_record returned ${res.status} for record ${recordId}`);
  }
}

async function createRecord(
  zoneId: string,
  hostname: string,
  type: RecordType,
  ip: string,
  token: string,
): Promise<void> {
  const url = `${CF_API_BASE}/zones/${zoneId}/dns_records`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ type, name: hostname, content: ip, ttl: 1, proxied: false }),
  });

  if (!res.ok) {
    const body = await res.text();
    log.debug(`POST response body: ${body}`);
    throw new Error(`CF POST dns_record returned ${res.status} for ${hostname}`);
  }
}

export async function updateHostname(
  hostname: string,
  ip: string,
  type: RecordType,
  token: string,
): Promise<UpdateResult> {
  try {
    const apex = apexDomain(hostname);
    const zoneId = await getZoneId(apex, token);
    const existing = await listRecord(zoneId, hostname, type, token);

    if (existing !== null) {
      if (existing.content === ip) {
        log.debug(`${hostname}: already ${ip}, skipping`);
        return { hostname, changed: false };
      }
      log.info(`${hostname}: updating ${existing.content} → ${ip}`);
      await patchRecord(zoneId, existing.id, ip, token);
      return { hostname, changed: true };
    }

    log.info(`${hostname}: record missing, creating ${type} ${ip}`);
    await createRecord(zoneId, hostname, type, ip, token);
    return { hostname, changed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`${hostname}: ${message}`);
    return { hostname, changed: false, error: message };
  }
}
