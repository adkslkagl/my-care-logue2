// src/lib/redis.ts
import Redis from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis || new Redis(process.env.REDIS_URL as string);

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;