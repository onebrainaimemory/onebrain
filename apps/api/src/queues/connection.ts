import { config } from '../config.js';

/**
 * Shared BullMQ Redis connection options.
 * Returns null when Redis is not configured (dev/test fallback).
 */
export function getQueueConnectionOptions() {
  if (!config.redis.url) return null;

  return {
    connection: { url: config.redis.url },
  };
}

/**
 * Returns true if queue infrastructure is available (Redis configured).
 */
export function isQueueEnabled(): boolean {
  return !!config.redis.url;
}
