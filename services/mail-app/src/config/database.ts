/**
 * Re-export of the shared Database singleton.
 *
 * The pool, connection logic, and config now live in @app/shared so every
 * service uses one implementation. This shim preserves the historical import
 * shape used throughout mail-app:
 *     import pool, { connectDB } from "../config/database";
 */
import { getPool, connectDB } from "@app/shared";

export { connectDB };
export default getPool();
