import { isIPv4, isIPv6 } from 'node:net';

export type RecordType = 'A' | 'AAAA';

export function validateIp(ip: string): boolean {
  return isIPv4(ip) || isIPv6(ip);
}

export function recordTypeFor(ip: string): RecordType {
  return isIPv4(ip) ? 'A' : 'AAAA';
}
