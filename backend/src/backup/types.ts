export type StoreKind = 'standard' | 'ordered';
export interface StoreSpec { kind: StoreKind; name: string; scope: string }
export interface BackupEntry extends StoreSpec {
  key: string; value: unknown; users?: string[]; attributes?: Record<string, unknown>;
  revisionId?: string; capturedAt?: string;
}
export interface Credentials { sourceKey?: string; targetKey?: string }
export interface EntryRef { key: string; scope: string; value?: number }
export interface StoreProgress extends StoreSpec {
  cursor: string; pending?: { entries: EntryRef[]; nextCursor: string }; done: boolean;
}
export interface BackupJob {
  id: string; tokenHash: string; mode: 'backup' | 'migrate' | 'restore';
  status: 'queued' | 'running' | 'paused' | 'failed' | 'completed';
  phase: 'capture' | 'apply' | 'done'; sourceUniverseId: string; targetUniverseId?: string;
  dataJobId: string; stores: StoreProgress[]; conflict: 'skip' | 'overwrite';
  skipUnchanged: boolean; verifyReadback: boolean; captureComplete: boolean;
  captured: number; written: number; skipped: number; unchanged: number;
  disappeared: number; retries: number; createdAt: string; updatedAt: string;
  activeMs: number; currentStore?: string; error?: string;
}
export interface StartJob extends Credentials {
  mode: 'backup' | 'migrate' | 'restore'; sourceUniverseId?: string; targetUniverseId?: string;
  stores?: StoreSpec[]; conflict?: 'skip' | 'overwrite'; skipUnchanged?: boolean;
  verifyReadback?: boolean; backupJobId?: string; backupToken?: string; confirmedTarget?: string;
}
export class BackupError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export class PausedError extends Error { constructor() { super('Proses dijeda.'); } }
export function universeId(value: unknown): string {
  const id = String(value || '').trim();
  if (!/^[1-9]\d{0,19}$/.test(id)) throw new BackupError('Universe ID harus berupa angka positif, bukan Place ID atau URL.');
  return id;
}
export function namePart(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.length || Buffer.byteLength(value, 'utf8') > 50 || /[\x00-\x1f]/.test(value)) {
    throw new BackupError(label + ' harus berisi 1–50 byte tanpa karakter kontrol.');
  }
  return value;
}
export function storeSpecs(value: unknown): StoreSpec[] {
  if (!Array.isArray(value) || !value.length || value.length > 200) throw new BackupError('Pilih 1–200 kombinasi store dan scope.');
  const unique = new Map<string, StoreSpec>();
  for (const item of value) {
    if (!item || !['standard', 'ordered'].includes(item.kind)) throw new BackupError('Jenis store tidak valid.');
    const store = { kind: item.kind as StoreKind, name: namePart(item.name, 'Nama store'), scope: namePart(item.scope || 'global', 'Scope') };
    if (store.kind === 'ordered' && store.scope === '*') throw new BackupError('OrderedDataStore memerlukan scope tertentu, misalnya global.');
    unique.set(JSON.stringify([store.kind, store.name, store.scope]), store);
  }
  const result = [...unique.values()];
  return result.filter(s => s.scope === '*' || !result.some(other => other.kind === s.kind && other.name === s.name && other.scope === '*'));
}
function containsTaggedNumber(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.m === null && record.t === 'numeric' && ['inf', '-inf', 'nan'].includes(String(record.v))) return true;
  return Object.values(record).some(containsTaggedNumber);
}
export function validateEntry(value: any): BackupEntry {
  const [store] = storeSpecs([value]);
  if (store.scope === '*') throw new BackupError('Entry backup harus memiliki scope tertentu.');
  const key = namePart(value.key, 'Key');
  if (containsTaggedNumber(value.value)) throw new BackupError('Entry berisi angka non-finite dari Luau. Migrasi dihentikan agar tipe data tidak berubah.');
  if (!Object.prototype.hasOwnProperty.call(value, 'value') || value.value === undefined) throw new BackupError('Entry backup tidak memiliki nilai.');
  if (store.kind === 'ordered' && !Number.isSafeInteger(value.value)) throw new BackupError('Nilai OrderedDataStore harus berupa integer yang aman untuk JSON/JavaScript.');
  if (value.users !== undefined && (!Array.isArray(value.users) || value.users.some((u: unknown) => typeof u !== 'string' || !/^users\/[1-9]\d*$/.test(u)))) throw new BackupError('Metadata users tidak valid.');
  if (value.attributes !== undefined && (!value.attributes || typeof value.attributes !== 'object' || Array.isArray(value.attributes))) throw new BackupError('Metadata attributes tidak valid.');
  return { ...store, key, value: value.value, ...(store.kind === 'standard' ? { users: value.users || [], attributes: value.attributes || {}, revisionId: value.revisionId } : {}), capturedAt: value.capturedAt };
}
