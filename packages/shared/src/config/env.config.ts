import dotenv from "dotenv";

dotenv.config();

/**
 * EnvConfig — Singleton holding validated, typed access to environment variables.
 *
 * Pattern: Singleton. A single source of truth for configuration across every
 * service (mail-app, queue-service, pubsub-service). Services never read
 * process.env directly; they ask EnvConfig, so missing-var failures surface in
 * one place and the shape is typed.
 */
export class EnvConfig {
  private static instance: EnvConfig;

  readonly db: {
    user?: string;
    host?: string;
    database?: string;
    password?: string;
    port: number;
  };

  readonly google: {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
  };

  /** Which LLM provider the agents use. Selects the concrete LLMProvider impl. */
  readonly llm: {
    provider: string;
  };

  /** Gemini (Google AI) config for the first-name + product-info agents. */
  readonly gemini: {
    apiKey?: string;
    model: string;
  };

  /** Gmail Pub/Sub watch config (shared so mail-app can auto-arm at login). */
  readonly pubsub: {
    /** Fully-qualified topic: projects/<PROJECT>/topics/<TOPIC>. */
    topicName?: string;
    /** Re-arm watches expiring within this many hours. */
    watchRenewThresholdHours: number;
  };

  readonly logLevel: string;

  private constructor() {
    this.db = {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT) || 5432,
    };
    this.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    };
    this.llm = {
      provider: (process.env.LLM_PROVIDER || "gemini").toLowerCase(),
    };
    this.gemini = {
      // Accept either GEMINI_API_KEY or GOOGLE_API_KEY (the SDK's default name).
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    };
    this.pubsub = {
      topicName: process.env.GMAIL_PUBSUB_TOPIC,
      watchRenewThresholdHours:
        Number(process.env.WATCH_RENEW_THRESHOLD_HOURS) || 24,
    };
    this.logLevel = process.env.LOG_LEVEL || "http";
  }

  static getInstance(): EnvConfig {
    if (!EnvConfig.instance) {
      EnvConfig.instance = new EnvConfig();
    }
    return EnvConfig.instance;
  }

  /** Postgres connection string, for tools (e.g. graphile-worker) that want a URL. */
  get databaseUrl(): string {
    const { user, password, host, port, database } = this.db;
    return `postgres://${user}:${password}@${host}:${port}/${database}`;
  }
}

export const env = EnvConfig.getInstance();
