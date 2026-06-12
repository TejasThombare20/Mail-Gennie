import { Pool, PoolClient } from "pg";
import { JobQueue, EnqueueOptions } from "./job-queue";

/** A queryable: the shared pool or a client bound to an open transaction. */
type Queryable = Pool | PoolClient;

/**
 * GraphileJobQueue — JobQueue implementation backed by graphile-worker, whose
 * job state lives in Postgres (graphile_worker schema). This is the single home
 * for the `graphile_worker.add_job(...)` SQL that previously sat inline in
 * EmailEnqueueService.
 *
 * Because the backend is Postgres, passing a transaction client makes the
 * enqueue commit atomically with the caller's other writes — the property the
 * enqueue path relies on.
 */
export class GraphileJobQueue implements JobQueue {
  constructor(private pool: Pool, private defaultMaxAttempts = 5) {}

  async enqueue(
    task: string,
    payload: unknown,
    opts: EnqueueOptions = {},
    tx?: PoolClient
  ): Promise<void> {
    const db: Queryable = tx ?? this.pool;
    const maxAttempts = opts.maxAttempts ?? this.defaultMaxAttempts;

    await db.query(
      `SELECT graphile_worker.add_job(
          $1::text,
          payload := $2::json,
          queue_name := $3::text,
          run_at := $4::timestamptz,
          job_key := $5::text,
          max_attempts := $6::int
       )`,
      [
        task,
        JSON.stringify(payload),
        opts.queueName ?? null,
        opts.runAt ? opts.runAt.toISOString() : null,
        opts.jobKey ?? null,
        maxAttempts,
      ]
    );
  }
}
