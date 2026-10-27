import { BASE_URL } from './api';

export interface BackupStore { kind: 'standard' | 'ordered'; name: string; scope: string }
export interface BackupJobView {
  id: string; mode: 'backup' | 'migrate' | 'restore'; status: 'queued' | 'running' | 'paused' | 'failed' | 'completed';
  phase: 'capture' | 'apply' | 'done'; sourceUniverseId: string; targetUniverseId?: string;
  stores: (BackupStore & { done: boolean })[]; captureComplete: boolean;
  captured: number; written: number; skipped: number; unchanged: number; disappeared: number;
  retries: number; processed: number; perMinute: number; total: number | null; estimatedSeconds: number | null;
  pauseRequested: boolean; createdAt: string; updatedAt: string; currentStore?: string; error?: string;
  conflict: 'skip' | 'overwrite'; verifyReadback: boolean; skipUnchanged: boolean;
}
export interface BackupHandle { id: string; token: string; job: BackupJobView }
export interface BackupCredentials { sourceKey?: string; targetKey?: string }
export interface CreateBackup extends BackupCredentials {
  mode: BackupJobView['mode']; sourceUniverseId?: string; targetUniverseId?: string;
  stores?: BackupStore[]; conflict?: 'skip' | 'overwrite'; skipUnchanged?: boolean;
  verifyReadback?: boolean; backupJobId?: string; backupToken?: string; confirmedTarget?: string;
}
export class BackupApiError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}
const root = BASE_URL.replace(/\/+$/, '') + '/api/backup';
async function request<T = unknown>(route: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(root + route, init); }
  catch { throw new BackupApiError('Backend tidak dapat dihubungi. Pastikan server Disperser aktif.'); }
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new BackupApiError('Endpoint Backup Server belum tersedia. Deploy atau restart backend terbaru.', response.status); }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data ? String(data.error) : 'Permintaan backup gagal.';
    throw new BackupApiError(message, response.status);
  }
  return data as T;
}
const auth = (token: string) => ({ Authorization: 'Bearer ' + token });
const json = (body: unknown, token?: string): RequestInit => ({
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? auth(token) : {}) }, body: JSON.stringify(body)
});
export const backupApi = {
  stores: (universe: string, key: string) => request('/stores/' + encodeURIComponent(universe), { headers: { 'x-api-key': key } }) as Promise<{ stores: { name: string; createdTime?: string }[] }>,
  inspect: (universe: string, sourceKey: string, stores: BackupStore[]) => request('/inspect', json({ universeId: universe, sourceKey, stores })),
  create: (body: CreateBackup) => request('/jobs', json(body)) as Promise<{ job: BackupJobView; token: string }>,
  status: (handle: BackupHandle) => request('/jobs/' + handle.id, { headers: auth(handle.token) }) as Promise<{ job: BackupJobView }>,
  pause: (handle: BackupHandle) => request('/jobs/' + handle.id + '/pause', json({}, handle.token)) as Promise<{ job: BackupJobView }>,
  resume: (handle: BackupHandle, keys: BackupCredentials) => request('/jobs/' + handle.id + '/resume', json(keys, handle.token)) as Promise<{ job: BackupJobView }>,
  importFile: async (file: File): Promise<{ job: BackupJobView; token: string }> => {
    const body = new FormData(); body.append('backup', file);
    return request('/imports', { method: 'POST', body });
  },
  download: async (handle: BackupHandle) => {
    let response: Response;
    try { response = await fetch(root + '/jobs/' + handle.id + '/download', { headers: auth(handle.token) }); }
    catch { throw new BackupApiError('Koneksi unduhan terputus. Coba unduh lagi.'); }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new BackupApiError(data.error || 'Backup gagal diunduh.', response.status);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'disperser-' + handle.job.sourceUniverseId + '-' + handle.id + '.jsonl.gz';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
};
