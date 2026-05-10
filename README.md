# cloudflare-unify-ddns

Self-hosted DDNS endpoint for UniFi OS that updates multiple Cloudflare DNS records simultaneously when your WAN IP changes.

**One UniFi DDNS entry — any number of hostnames.**

## How it works

UniFi sends a single HTTP request with the new WAN IP. The container holds the list of hostnames to update as an environment variable and updates all matching Cloudflare DNS records in parallel. No Cloudflare Worker, no Wrangler, just a container.

```
UniFi UDM ──HTTP──> Traefik (TLS) ──> Container ──HTTPS──> api.cloudflare.com
```

## Quick start

```bash
docker run -d \
  -e CF_API_TOKEN=<your_token> \
  -e DDNS_HOSTNAMES=home.example.com,nas.example.com \
  -e DDNS_SHARED_SECRET=<strong_secret> \
  -v ddns-data:/data \
  -p 3000:3000 \
  ghcr.io/roberteinsle/cloudflare-unify-ddns:latest
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CF_API_TOKEN` | yes | — | Cloudflare API Token with `Zone:DNS:Edit` scope |
| `DDNS_HOSTNAMES` | yes | — | Comma-separated hostnames, e.g. `home.example.com,nas.example.com` |
| `DDNS_SHARED_SECRET` | yes | — | Basic Auth password sent by UniFi |
| `DDNS_BASIC_AUTH_USER` | no | `unifi` | Basic Auth username |
| `LOG_LEVEL` | no | `info` | `info`, `debug`, or `error` |
| `STATE_PATH` | no | `/data/state.json` | Path for last-known-IP cache |

## API

### `GET /update?ip=<ip>`

Auth: HTTP Basic (`DDNS_BASIC_AUTH_USER` / `DDNS_SHARED_SECRET`)

Responses (dyndns2-compatible):

| Response | Meaning |
|---|---|
| `200 good <ip>` | At least one record updated |
| `200 nochg <ip>` | All records already correct |
| `400 badip` | Missing or invalid IP parameter |
| `401 badauth` | Basic Auth failed |
| `500 dnserr` | Cloudflare API error (check logs) |

### `GET /healthz`

Returns `200 ok`. No auth. Used by Coolify/Traefik health checks.

## UniFi configuration

Add a single custom DDNS entry per WAN interface:

| Field | Value |
|---|---|
| Service | `custom` |
| Hostname | any placeholder, e.g. `ddns` |
| Username | value of `DDNS_BASIC_AUTH_USER` (default: `unifi`) |
| Password | value of `DDNS_SHARED_SECRET` |
| Server | `ddns.einsle.cloud/update?ip=%i` (no `https://`) |

## Cloudflare API Token

Create a token at **Cloudflare > My Profile > API Tokens > Create Token**:

- Template: *Edit zone DNS*
- Permissions: `Zone → DNS → Edit`
- Zone Resources: include only the zones used by your hostnames

## Coolify deployment

1. Add Application → point to this repo → Dockerfile build
2. Set all required ENV variables
3. Add persistent volume `/data`
4. Set health check path: `/healthz`
5. Domain: e.g. `ddns.einsle.cloud` (Traefik handles TLS)

## Security notes

- The Cloudflare API token is **never sent to UniFi** — it lives only in the container ENV
- An attacker who intercepts the Shared Secret can only update the hostnames listed in `DDNS_HOSTNAMES`, not arbitrary DNS records
- Container runs as non-root (distroless `:nonroot`, uid 65532)
- Records are updated with PATCH, not PUT — `proxied` status, TTL, and tags set in the CF dashboard are preserved

## Local development

```bash
cp .env.example .env
# fill in real values
npm install
npm run dev
```

```bash
curl http://localhost:3000/healthz
curl -u unifi:$DDNS_SHARED_SECRET "http://localhost:3000/update?ip=1.2.3.4"
```

## Build

```bash
npm run build          # type-check + esbuild bundle → dist/index.js
docker build -t cloudflare-unify-ddns .
```
