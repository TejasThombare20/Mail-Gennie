/**
 * Re-export of the shared logger. Implementation now lives in @app/shared so all
 * services log in the same format. Preserves `import logger from "../utils/logger"`.
 */
import { logger } from "@app/shared";

export default logger;
