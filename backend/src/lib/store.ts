type Order = { id: string; orderCode: string; amountCents: number; state: string };
type RiderBundle = { id: string; riderId: string; sealed: boolean; orderIds: string[] };

const memory = {
  orders: new Map<string, Order>(),
  riderBundles: new Map<string, RiderBundle>(),
  superbundles: new Map<string, { id: string; asmId: string; riderBundleIds: string[] }>(),
  depositBundles: new Map<string, { id: string; smId: string; superbundleIds: string[]; slipUrl?: string }>(),
};

export function resetStore() {
  memory.orders.clear();
  memory.riderBundles.clear();
  memory.superbundles.clear();
  memory.depositBundles.clear();
}

export function createRiderBundle(riderId: string, orderIds: string[]) {
  const id = crypto.randomUUID();
  const bundle: RiderBundle = { id, riderId, sealed: false, orderIds };
  memory.riderBundles.set(id, bundle);
  return bundle;
}

export function listRiderBundles() {
  return Array.from(memory.riderBundles.values());
}

export function sealRiderBundle(id: string) {
  const b = memory.riderBundles.get(id);
  if (!b) return null;
  b.sealed = true;
  return b;
}

export function createSuperbundle(asmId: string, riderBundleIds: string[]) {
  const id = crypto.randomUUID();
  const sb = { id, asmId, riderBundleIds };
  memory.superbundles.set(id, sb);
  return sb;
}

export function listPendingSuperbundles() {
  return Array.from(memory.superbundles.values());
}

export function createDepositBundle(smId: string, superbundleIds: string[]) {
  const id = crypto.randomUUID();
  const db = { id, smId, superbundleIds } as { id: string; smId: string; superbundleIds: string[]; slipUrl?: string };
  memory.depositBundles.set(id, db);
  return db;
}

export function uploadSlip(depositBundleId: string, slipUrl: string) {
  const db = memory.depositBundles.get(depositBundleId);
  if (!db) return null;
  db.slipUrl = slipUrl;
  return db;
}

export function listDeposits() {
  return Array.from(memory.depositBundles.values());
}
