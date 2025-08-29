# NoBotsPls — Cloudflare Worker

Server-side bot checks for sensitive routes (signup, checkout, APIs) with **no CAPTCHA and no client JS**.
The Worker calls `GET /probe` on NoBotsPls and either:
- **monitor**: forwards the request, adds `X-Bot-Decision` header
- **enforce**: returns `403` when decision is `block`

## Deploy

1. Copy `wrangler.toml.example` to `wrangler.toml` and edit vars.
2. Login and publish:
   ```bash
   npm i -g wrangler
   wrangler login
   wrangler publish
```
3. Add a route in Cloudflare → Workers & Routes (or add to wrangler.toml).

Configure
```
AFK_MODE: monitor (default) or enforce
AFK_API_KEY: your afk_… key
API_BASE: defaults to https://nobotspls.com
```

Edit PROTECT regexes in worker.js to choose which paths are guarded.

## Verify
```
curl -I https://yourdomain.com/signup
```
# Look for: X-Bot-Decision: allow|block
# Fail-open: if the probe errors, traffic is allowed and X-Bot-Error: probe-failed is added.

