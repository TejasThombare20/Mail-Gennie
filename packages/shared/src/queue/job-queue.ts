import { PoolClient } from "pg";

/**
 * JobQueue — the port (interface) the enqueue side depends on instead of a
 * concrete queue backend. Today the only implementation is GraphileJobQueue
 * (Postgres-backed graphile-worker); swapping to BullMQ/SQS/etc. later means
 * adding a new implementation of THIS interface, not rewriting the enqueue
 * logic. Pattern: Strategy / Hexagonal port.
 */
export interface EnqueueOptions {
  /**
   * Serial-queue name. Jobs sharing a queueName run strictly one-at-a-time
   * (used for per-session pacing); different names run in parallel.
   */
  queueName?: string;
  /** Schedule the job for this time; omit/undefined = run as soon as possible. */
  runAt?: Date | null;
  /** Idempotency key — an existing job with the same key is not re-added. */
  jobKey?: string;
  /** Max attempts before the job is treated as permanently failed. */
  maxAttempts?: number;
}

/**
 * JobConsumer — the worker-side counterpart of JobQueue: something that runs
 * enqueued jobs. QueueWorker (graphile-worker runner) implements this. A future
 * backend swaps in its own consumer without the rest of the service caring.
 */
export interface JobConsumer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface JobQueue {
  /**
   * Enqueue one job.
   *
   * @param task     the task identifier (e.g. TASK_SEND_EMAIL).
   * @param payload  JSON-serializable job payload.
   * @param opts     scheduling / queueing options.
   * @param tx       OPTIONAL transaction client. When provided, the enqueue runs
   *                 on that client so it commits atomically with the caller's
   *                 other writes (e.g. the session + log rows). This is the whole
   *                 reason the port exposes `tx`: we must never persist a session
   *                 whose jobs were lost, or vice-versa.
   */
  enqueue(
    task: string,
    payload: unknown,
    opts?: EnqueueOptions,
    tx?: PoolClient
  ): Promise<void>;
}
