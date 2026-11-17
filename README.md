# TeXeR Backend

NestJS 11 API behind [texer.org](https://texer.org). Postgres via Prisma, S3-compatible object storage for uploads and compiled output, Resend for sign-in codes, Stripe for billing, and a separate [compiler service](https://github.com/texer-org/compiler) for running TeX Live.

Part of TeXeR alongside the [frontend](https://github.com/texer-org/frontend) and the [compiler](https://github.com/texer-org/compiler).

## What it does

- **Authentication.** Passwordless. Sign-in is a one-time code sent by email, exchanged for a JWT bound to a revocable session. TOTP two-factor is available. Login, signup and resend return identical responses for known and unknown addresses so the API cannot be used to test whether someone has an account.
- **Projects.** Multi-file LaTeX projects with owner, editor and viewer roles, invitations, per-file version history (30-day retention), published revisions, and an undo stack.
- **Real-time collaboration.** A Socket.IO gateway carrying Yjs CRDT updates. The server holds the authoritative document, persists it to Postgres, and flushes it back to `project_files` when a room empties or the process shuts down.
- **Conversion.** Images (snips) and PDFs to LaTeX through external inference providers, metered against the user's plan.
- **Compilation.** Proxies to the compiler service with a shared internal secret, including SyncTeX reverse lookup.
- **Templates and TikZ assets.** Serves prebuilt PDFs and PNGs from object storage; scripts in `scripts/` generate them.
- **Billing.** Stripe checkout, portal, and signature-verified webhooks.
- **Audit log.** Append-only record of security-relevant events.

Every resource is scoped to its owner or project. Unauthorised access returns 404, not 403, so ids cannot be enumerated. See [`SECURITY.md`](../SECURITY.md) at the repository root for the full threat model.

## Requirements

- Node 20+
- Postgres 14+
- Redis (optional; falls back to in-memory for OTP attempts, pending signups and session cache)
- S3-compatible storage with two buckets: one for user assets, one for builds
- The compiler service running and reachable

## Setup

```bash
npm install
# create .env with the variables listed below
npx prisma migrate deploy
npx prisma generate
npm run start:dev
```

The API listens on `PORT`, default `2161`. The frontend expects it there in development.

## Environment

Nothing here has a safe default. The server refuses to start in production without `JWT_SECRET`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Optional. Omit to use in-memory fallbacks |
| `JWT_SECRET`, `JWT_EXPIRATION` | Token signing. Expiration defaults to 7 days |
| `DOMAIN_NAME` | The one address setting, for example `texer.org`. The site, `api.`, `admin.`, `cdn.`, and `compile.` are worked out from it (`src/common/site.ts`), and it decides which origins the API accepts |
| `FRONTEND_URL` | Optional override of `https://<DOMAIN_NAME>`, for local development. Used in invitation emails and Stripe redirects |
| `PORT` | Default `2161` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sign-in codes and invitations |
| `RESEND_WEBHOOK_SECRET` | The signing secret of Resend's webhook (`whsec_…`). Resend reports what happened to each email (delivered, opened, bounced, …) to `POST /email/webhook`, and the admin panel's Email page shows it. Unset, the webhook refuses every call |
| `CONTACT_TO` | The contact form's inbox (default `contact@texer.org`). Outside production the form only logs messages |
| `INTERNAL_API_SECRET` | Signs every call to the Axya service (`X-Internal-Timestamp`, `X-Internal-Body-SHA256`, `X-Internal-Signature`, over the exact body; `src/common/internal-hmac.ts`). Must be the same value as on the Axya service, which refuses unsigned calls |
| `ASSETS_BUCKET_*` | Uploads: `NAME`, `REGION`, `ENDPOINT_URL`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY` |
| `BUILDS_BUCKET_*` | Compiled output and prebuilt assets, same five keys |
| `COMPILER_URL` | Optional override of `https://compile.<DOMAIN_NAME>`: localhost in development, or the compiler's private address |
| `COMPILER_INTERNAL_SECRET` | Shared with the compiler. Lets the API and prebuild scripts bypass its anonymous rate limit |
| `AXYA_SERVICE_URL` | Axya, the research AI used for PDF extraction and dictation. Defaults to `https://ai.axya.org`. The old name `AXEOM_SERVICE_URL` still works |
| `AI_CHAT_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_CHAT_MODEL` | AI assistant and OCR. Provider is `openai` or `anthropic` |
| `ADMIN_EMAIL` | The root administrator of the admin panel, and the only account that can make others administrators. It must be a mailbox someone reads: there are no passwords, and every administrator signs in with a code emailed to them. Other administrators are accounts whose `isAdmin` flag is on. The panel sends codes only to administrators, at most 10 requests an hour from one IP address, and one code a minute and 5 an hour to one mailbox |
| `AI_CHAT_LIVE_IN_DEV` | Optional. Outside production the assistant and dictation answer from a local script and call no model; `true` uses the real providers |
| `METRICS_TOKEN` | Optional. The bearer token Prometheus sends to `GET /metrics`. Unset, the endpoint answers 404 in production |
| `TRUST_PROXY_HOPS` | Proxies in front of the API, default `1` (Railway). Client addresses are taken from that hop, never from a header the client can set |
| `REVIEWER_EMAILS` | Optional. Comma-separated accounts that approve shared templates. Unset means no one can, and shared templates stay hidden |
| `SESSION_COOKIE_DOMAIN` | Optional. Domain for the HttpOnly sign-in cookie. Leave unset to keep it on the API host only |
| `GITHUB_TOKEN_KEY` | Optional. At least 32 characters; encrypts the GitHub tokens people give for GitHub sync. Unset, a key is derived from `JWT_SECRET`, so changing that secret means relinking repositories |
| `GITHUB_API_URL` | Optional. GitHub's API, for GitHub Enterprise. Defaults to `https://api.github.com` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Billing |
| `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_YEARLY_PRICE_ID`, `STRIPE_TEAM_MONTHLY_PRICE_ID`, `STRIPE_TEAM_YEARLY_PRICE_ID` | Plan price ids. The `STRIPE_PRICE_PRO_MONTHLY` spelling also works |

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Development server with reload |
| `npm run build` / `npm run start:prod` | Production build and run |
| `npm test` | Unit tests. Focused on tenant isolation and auth |
| `npm run lint` | ESLint with autofix |
| `npm run prisma:migrate` | Create and apply a migration in development |
| `npm run prisma:deploy` | Apply pending migrations (production) |
| `npm run prisma:studio` | Browse the database |
| `npm run prebuild:tikz` | Compile every TikZ library example to PNG and upload to the builds bucket |
| `npm run prebuild:templates` | Same for document templates, as PDF and thumbnail |
| `npm run prebuild:assets` | Both of the above |

Run `prebuild:assets` after deploying the compiler or changing examples. It needs `COMPILER_URL`, `COMPILER_INTERNAL_SECRET` and the `BUILDS_BUCKET_*` variables. Without the secret the compiler rate-limits the run to one request per second.

## Layout

```
src/
  auth/            passwordless login, sessions, 2FA
  projects/        projects, files, collaborators, history, revisions, undo
  collaboration/   Socket.IO gateway + Yjs persistence
  snips/ pdfs/     image and PDF conversion
  compile/         proxy to the compiler service
  templates/ tikz/ prebuilt asset serving
  billing/         Stripe
  api-keys/        programmatic access keys
  usage/           plan quotas and statistics
  audit/           append-only security log
  common/          guards, decorators, DTOs, Redis, scheduled cleanup
prisma/            schema and migrations
scripts/           asset prebuild
```

## Operations

- `GET /health` answers while the process is up. `GET /ready` answers 200 only when the database does: point the uptime check there. `GET /metrics` is the Prometheus scrape, behind `METRICS_TOKEN`. The stack that reads them, and when to add capacity, is in `ops/README.md`.
- `src/admin` serves the operators' panel: accounts, sessions with their country, AI usage, the audit log, and system health. It is session-only (an API key is refused) and never selects what people wrote: no project titles or files, no snip or PDF contents. It only reads, with one exception: the root administrator can give or take another account's administrator flag. Opening one account, and every change of the flag, is written to the audit log.
- `src/ai/ai-usage.service.ts` records how much of the paid models each person uses (requests, tokens, audio size), never the content.
- The country of a session is looked up on this server from public-domain registry data (`src/common/geo/country.ts`); no address is sent anywhere.
- Resend: in Resend's dashboard, Webhooks → Add endpoint `https://api.<domain>/email/webhook` with the email events (sent, delivered, delivery delayed, opened, clicked, bounced, complained, failed), and set its signing secret as `RESEND_WEBHOOK_SECRET`. Each email this API sends is recorded with its kind (sign-in code, invitation, contact), never a sign-in code's subject, and Resend's events fill in what happened to it.
- Stripe: point the webhook at `POST /billing/webhook` and send it `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, and `invoice.payment_failed`. Plans are given and taken by those events alone.
- The API runs as one instance: live collaboration is held in its memory. See the scaling notes in `ops/README.md` before adding a second.

## Public API

The REST API is documented at [texer.org/docs/api](https://texer.org/docs/api). Base URL is `https://api.texer.org`, no version prefix.

## License

[MIT](LICENSE)
