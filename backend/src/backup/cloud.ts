import { BackupEntry, BackupError, EntryRef, PausedError, StoreKind, StoreSpec, validateEntry } from './types';

const ROOT = 'https://apis.roblox.com';
const enc = encodeURIComponent;
export type Check = () => void;
export class CloudError extends BackupError {
  constructor(status: number, message: string) { super(message, status); }
}
type Budget = { nextAt: number; blockedUntil: number; tail: Promise<void> };
export class RobloxCloud {
  private budgets = new Map<string, Budget>();
  constructor(private fetcher: typeof fetch = fetch, private intervalMs = 250) {}
  private async wait(ms: number, check: Check) {
    const end = Date.now() + ms;
    while (Date.now() < end) { check(); await new Promise(resolve => setTimeout(resolve, Math.min(200, end - Date.now()))); }
    check();
  }
  private budget(universe: string, kind: StoreKind, op: string): Budget {
    const id = [universe, kind, op].join(':');
    if (!this.budgets.has(id)) this.budgets.set(id, { nextAt: 0, blockedUntil: 0, tail: Promise.resolve() });
    return this.budgets.get(id)!;
  }
  async request(universe: string, kind: StoreKind, op: 'list' | 'read' | 'write', key: string, route: string, init: RequestInit = {}, check: Check = () => {}, onRetry = () => {}): Promise<any> {
    if (!key?.trim()) throw new BackupError('Open Cloud API key belum diisi.');
    const budget = this.budget(universe, kind, op);
    for (let attempt = 0; attempt < 7; attempt++) {
      const turn = budget.tail.then(async () => {
        while (Math.max(budget.nextAt, budget.blockedUntil) > Date.now()) await this.wait(Math.max(budget.nextAt, budget.blockedUntil) - Date.now(), check);
        check();
        budget.nextAt = Date.now() + this.intervalMs;
      });
      budget.tail = turn.catch(() => {});
      await turn;
      try {
        const response = await this.fetcher(ROOT + route, { ...init, headers: { 'Content-Type': 'application/json', 'x-api-key': key.trim(), ...init.headers }, signal: AbortSignal.timeout(25000), redirect: 'error' });
        const text = await response.text();
        let data: any;
        try { data = text ? JSON.parse(text) : {}; } catch { if (response.ok) throw new CloudError(502, 'Roblox mengembalikan respons non-JSON.'); data = {}; }
        if (response.ok) return data;
        if ((response.status === 429 || response.status >= 500) && attempt < 6) {
          onRetry();
          const retryAfter = response.headers.get('retry-after');
          const seconds = Number(retryAfter);
          const retryMs = retryAfter ? (Number.isFinite(seconds) ? seconds * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now())) : 0;
          const delay = Math.max(Number.isFinite(retryMs) ? retryMs : 0, Math.min(30000, 1000 * 2 ** attempt));
          budget.blockedUntil = Math.max(budget.blockedUntil, Date.now() + delay);
          continue;
        }
        const detail = String(data.message || data.errors?.[0]?.message || data.error?.message || 'HTTP ' + response.status).slice(0, 300);
        throw new CloudError(response.status, 'Roblox ' + response.status + ': ' + detail);
      } catch (error) {
        if (error instanceof CloudError || error instanceof PausedError || attempt === 6) throw error;
        check(); onRetry();
        await this.wait(Math.min(15000, 1000 * 2 ** attempt), check);
      }
    }
    throw new CloudError(502, 'Roblox tidak merespons setelah beberapa percobaan.');
  }
  async stores(universe: string, key: string) {
    const result: { name: string; createdTime?: string }[] = [];
    let pageToken = '';
    const seen = new Set<string>();
    do {
      const query = new URLSearchParams({ maxPageSize: '100', ...(pageToken ? { pageToken } : {}) });
      const data = await this.request(universe, 'standard', 'list', key, '/cloud/v2/universes/' + enc(universe) + '/data-stores?' + query);
      for (const store of data.dataStores || []) if (store.state !== 'DELETED') result.push({ name: store.id || decodeURIComponent(store.path.split('/').pop()), createdTime: store.createTime });
      pageToken = data.nextPageToken || '';
      if (pageToken && seen.has(pageToken)) throw new CloudError(502, 'Cursor daftar store berulang.');
      seen.add(pageToken);
    } while (pageToken);
    return result;
  }
  collection(universe: string, store: StoreSpec): string {
    return '/cloud/v2/universes/' + enc(universe) + '/' + (store.kind === 'standard' ? 'data-stores' : 'ordered-data-stores') + '/' + enc(store.name) + '/scopes/' + enc(store.scope) + '/entries';
  }
  async list(universe: string, key: string, store: StoreSpec, cursor: string, check: Check, onRetry: () => void): Promise<{ entries: EntryRef[]; nextCursor: string }> {
    // v1 is retained only for its explicit allScopes enumeration; values use v2.
    if (store.kind === 'standard' && store.scope === '*') {
      const query = new URLSearchParams({ datastoreName: store.name, allScopes: 'true', limit: '100', ...(cursor ? { cursor } : {}) });
      const data = await this.request(universe, store.kind, 'list', key, '/datastores/v1/universes/' + enc(universe) + '/standard-datastores/datastore/entries?' + query, {}, check, onRetry);
      const entries = (data.keys || []).map((item: any) => {
        if (typeof item !== 'object' || typeof item.key !== 'string' || typeof item.scope !== 'string') throw new CloudError(502, 'Roblox tidak mengembalikan identitas scope. Pilih scope tertentu untuk store ini.');
        return { key: item.key, scope: item.scope };
      });
      return { entries, nextCursor: data.nextPageCursor || '' };
    }
    const query = new URLSearchParams({ maxPageSize: '100', ...(cursor ? { pageToken: cursor } : {}) });
    const data = await this.request(universe, store.kind, 'list', key, this.collection(universe, store) + '?' + query, {}, check, onRetry);
    const entries = (data[store.kind === 'standard' ? 'dataStoreEntries' : 'orderedDataStoreEntries'] || []).filter((item: any) => item.state !== 'DELETED').map((item: any) => {
      const keyId = item.id || (typeof item.path === 'string' ? decodeURIComponent(item.path.split('/').pop()) : '');
      if (!keyId) throw new CloudError(502, 'Roblox tidak mengembalikan identitas key.');
      return { key: keyId, scope: store.scope, ...(store.kind === 'ordered' && Object.prototype.hasOwnProperty.call(item, 'value') ? { value: item.value } : {}) };
    });
    return { entries, nextCursor: data.nextPageToken || '' };
  }
  async read(universe: string, key: string, store: StoreSpec, entryKey: string, check: Check, onRetry: () => void): Promise<any> {
    return this.request(universe, store.kind, 'read', key, this.collection(universe, store) + '/' + enc(entryKey), {}, check, onRetry);
  }
  async capture(universe: string, key: string, store: StoreSpec, entryKey: string, check: Check, onRetry: () => void): Promise<BackupEntry> {
    const value = await this.read(universe, key, store, entryKey, check, onRetry);
    if (value.state === 'DELETED') throw new CloudError(404, 'Key sudah dihapus.');
    return validateEntry({ ...store, key: entryKey, value: value.value, users: value.users, attributes: value.attributes, revisionId: value.revisionId, capturedAt: new Date().toISOString() });
  }
  async write(universe: string, key: string, entry: BackupEntry, overwrite: boolean, check: Check, onRetry: () => void): Promise<any> {
    const payload = entry.kind === 'standard' ? { value: entry.value, users: entry.users || [], attributes: entry.attributes || {} } : { value: entry.value };
    const route = overwrite ? this.collection(universe, entry) + '/' + enc(entry.key) + '?allowMissing=true' : this.collection(universe, entry) + '?' + new URLSearchParams({ id: entry.key });
    return this.request(universe, entry.kind, 'write', key, route, { method: overwrite ? 'PATCH' : 'POST', body: JSON.stringify(payload) }, check, onRetry);
  }
}
