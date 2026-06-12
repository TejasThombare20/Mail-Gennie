# Mail-App Monorepo

npm-workspaces + turborepo. Four runnable pieces + one shared library.

```
packages/
  shared/            @app/shared — config, logger, db pool, Gmail factory,
                     bounce/reply detection, render utils, repositories, types
services/
  mail-app/          @app/mail-app      — HTTP API (enqueues jobs, returns 202)
  client/            React/Vite frontend
  queue-service/     @app/queue-service — graphile-worker: drains send jobs
  pubsub-service/    @app/pubsub-service — Gmail Pub/Sub consumer (bounce/reply)
```

## Design patterns used

- **Singleton** — `EnvConfig`, `Database`/pool, `TemplateCache`, `GmailSender`, `QueueWorker`.
- **Factory** — `GmailClientFactory` (OAuth + refresh + invalid_grant probe).
- **Strategy** — `BounceSignalDetector`, `BounceDetector`/`ReplyDetector` (message classification), `TemplateRenderer`.
- **Command** — `sendEmailTask` (one job == one self-describing, retryable unit of work).
- **Repository** — `TokenRepository`, `TemplateRepository`, `SendJobRepository`, `WatchStateRepository`, `InboxEventRepository`.

## Build

```bash
npm install            # once, links workspaces
npx turbo run build    # builds all packages in dependency order
```

## Run (each in its own process; use pm2/systemd with restart-always)

```bash
# API
npm run dev   --workspace=@app/mail-app      # dev (nodemon)
npm run start --workspace=@app/mail-app      # prod (dist)

# Queue worker (sends emails; per-session 2.5s pacing)
npm run start --workspace=@app/queue-service
#   env: QUEUE_CONCURRENCY (default 5) = max parallel sessions

# Pub/Sub consumer (bounce + reply detection) — needs GCP env (below)
npm run start --workspace=@app/pubsub-service
```

The graphile-worker schema (`graphile_worker`, incl. `add_job`) is created by
mail-app on startup, so the transactional enqueue works even before the worker
boots. The worker also installs/verifies the schema on its own startup.

## Sending flow (the 75s-block fix)

1. `POST /api/email/:templateId` → mail-app resolves template + attachments
   ONCE, then in a single transaction creates the session + per-recipient
   `email_logs` (status `queued`) + enqueues one `send_email` job per recipient
   under queue `session_<sessionId>`. Returns **202** immediately with
   `{ sessionId, queued, scheduledFor }`.
2. `queue-service` drains the jobs. Same-session jobs are serial (queue name)
   with a 2.5s gap; different sessions run in parallel (up to `QUEUE_CONCURRENCY`).
3. Client polls `GET /api/email/session/:sessionId/status` for progress.

**Scheduling:** include `scheduledAt` (ISO timestamp) in the POST body — the
jobs get `run_at = scheduledAt` and fire when the worker is next awake at/after
that time (late, never dropped, if the laptop was asleep).

## DB migrations to apply

```
services/mail-app/src/db/migrations/add_outreach_and_validity-11-06-26.sql   (existing)
services/mail-app/src/db/migrations/add_gmail_watch_state-11-06-26.sql        (new: pubsub)
```
Also ensure `email_sessions.status` allows the `'queued'` value.

## GCP setup for pubsub-service (do once, then set env)

1. Create a Pub/Sub **topic** (e.g. `gmail-notifications`).
2. Grant Gmail permission to publish:
   `gmail-api-push@system.gserviceaccount.com` → **Pub/Sub Publisher** on the topic.
3. Create a **pull** subscription on that topic (e.g. `gmail-notifications-sub`).
4. Set env for pubsub-service:
   ```
   GCP_PROJECT_ID=<project>
   GMAIL_PUBSUB_TOPIC=projects/<project>/topics/gmail-notifications
   GMAIL_PUBSUB_SUBSCRIPTION=gmail-notifications-sub
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json   # for the Pub/Sub client
   ```
5. Arm a user's watch (needs valid Google tokens stored for that user):
   ```bash
   npm run arm-watch --workspace=@app/pubsub-service -- <userId>
   ```
6. Renew before the 7-day expiry (cron/systemd-timer, daily):
   ```bash
   npm run renew-watches --workspace=@app/pubsub-service
   ```

Until these env vars are set, pubsub-service logs what's missing and exits
cleanly (no crash loop). The legacy `bounceScan` cron in mail-app remains as a
backstop and can be retired once Pub/Sub is verified.
