import { run, Runner, TaskList } from "graphile-worker";
import { env, logger, TASK_SEND_EMAIL, JobConsumer } from "@app/shared";
import { sendEmailTask } from "./tasks/send-email.task";

/**
 * QueueWorker — Singleton wrapper around the graphile-worker runner.
 *
 * graphile-worker stores all job state in Postgres (graphile_worker schema), so
 * the worker process itself is stateless: on restart it reconnects and resumes
 * pending/scheduled jobs, and re-releases jobs whose lock expired when a prior
 * process died. `concurrency` caps how many DIFFERENT session-queues run at once.
 */
export class QueueWorker implements JobConsumer {
  private static instance: QueueWorker;
  private runner: Runner | null = null;

  private readonly taskList: TaskList = {
    [TASK_SEND_EMAIL]: sendEmailTask,
  };

  static getInstance(): QueueWorker {
    if (!QueueWorker.instance) {
      QueueWorker.instance = new QueueWorker();
    }
    return QueueWorker.instance;
  }

  async start(): Promise<void> {
    if (this.runner) return;

    this.runner = await run({
      connectionString: env.databaseUrl,
      concurrency: Number(process.env.QUEUE_CONCURRENCY) || 5,
      // graphile-worker installs its schema on first run.
      noHandleSignals: false,
      pollInterval: 2000,
      taskList: this.taskList,
    });

    logger.info("[QueueWorker] started", {
      concurrency: Number(process.env.QUEUE_CONCURRENCY) || 5,
      tasks: Object.keys(this.taskList),
    });

    this.runner.promise.catch((err) => {
      logger.error("[QueueWorker] runner exited with error", { error: err?.message });
      process.exit(1);
    });
  }

  async stop(): Promise<void> {
    if (this.runner) {
      await this.runner.stop();
      this.runner = null;
      logger.info("[QueueWorker] stopped");
    }
  }
}
