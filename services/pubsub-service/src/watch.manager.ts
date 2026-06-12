/**
 * WatchManager now lives in @app/shared so mail-app (auto-arm at login) and the
 * pubsub-service (renewal loop) share one implementation. Re-exported here to
 * preserve the existing `./watch.manager` import path.
 */
export { WatchManager } from "@app/shared";
