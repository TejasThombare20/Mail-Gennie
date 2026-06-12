import { ITemplate, TemplateRepository, getPool, logger } from "@app/shared";

/**
 * TemplateCache — Singleton in-memory cache for templates.
 *
 * Each session's recipients all use the same template, and the worker processes
 * one job per recipient. Without a cache the worker would re-fetch the same
 * template from Postgres for every recipient. This caches by `${templateId}:${userId}`
 * with a short TTL so a burst of same-session jobs hits the DB once.
 */
export class TemplateCache {
  private static instance: TemplateCache;
  private readonly repo: TemplateRepository;
  private readonly cache = new Map<string, { template: ITemplate; at: number }>();
  private readonly ttlMs = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.repo = new TemplateRepository(getPool());
  }

  static getInstance(): TemplateCache {
    if (!TemplateCache.instance) {
      TemplateCache.instance = new TemplateCache();
    }
    return TemplateCache.instance;
  }

  async get(templateId: string, userId: string): Promise<ITemplate | null> {
    const key = `${templateId}:${userId}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) {
      return hit.template;
    }

    const template = await this.repo.getTemplateById(templateId, userId);
    if (template) {
      this.cache.set(key, { template, at: Date.now() });
    } else {
      logger.warn("[TemplateCache] Template not found", { templateId, userId });
    }
    return template;
  }
}
