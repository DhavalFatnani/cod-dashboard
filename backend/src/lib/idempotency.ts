import { randomUUID } from "crypto";

export type IdempotencyRecord = {
  key: string;
  method: string;
  path: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: string;
};

const memoryStore = new Map<string, IdempotencyRecord>();

export function getOrCreateIdempotent(
  key: string | undefined,
  method: string,
  path: string,
  compute: () => Promise<{ status: number; body: unknown }>
) {
  if (!key) return compute();
  const existing = memoryStore.get(key);
  if (existing) {
    return Promise.resolve({ status: existing.responseStatus, body: existing.responseBody });
  }
  return compute().then((result) => {
    memoryStore.set(key, {
      key,
      method,
      path,
      responseStatus: result.status,
      responseBody: result.body,
      createdAt: new Date().toISOString(),
    });
    return result;
  });
}

export function generateRequestId(): string {
  return randomUUID();
}
