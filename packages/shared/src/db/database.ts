import { Pool } from "pg";
import { env } from "../config/env.config";
import logger from "../utils/logger";

/**
 * Database — Singleton wrapper around a single pg Pool.
 *
 * Pattern: Singleton. Every service shares one connection pool per process, so
 * we never accidentally open multiple pools. Repositories receive the Pool via
 * constructor injection (so they stay testable), but the pool itself is created
 * exactly once here.
 */
export class Database {
  private static instance: Database;
  readonly pool: Pool;

  private constructor() {
    this.pool = new Pool({
      user: env.db.user,
      host: env.db.host,
      database: env.db.database,
      password: env.db.password,
      port: env.db.port,
    });
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      logger.info("PostgreSQL connected successfully!");
      client.release();
    } catch (err) {
      logger.error("Error connecting to PostgreSQL:", err);
      process.exit(1);
    }
  }
}

/** Convenience accessor: the shared pool used across all services. */
export const getPool = (): Pool => Database.getInstance().pool;

/** Back-compat with the old `connectDB()` export from mail-app. */
export const connectDB = (): Promise<void> => Database.getInstance().connect();
